import json
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from lib import auth_rate_limit
from lib.csrf import CSRFMiddleware


class FakeRateLimitCollection:
    def __init__(self):
        self.documents = {}

    async def find_one_and_update(
        self, query, update, *, upsert=False, return_document=None
    ):
        bucket_id = query["_id"]
        if bucket_id not in self.documents:
            if not upsert:
                return None
            self.documents[bucket_id] = {"_id": bucket_id, "count": 0}
            self.documents[bucket_id].update(update["$setOnInsert"])
        self.documents[bucket_id]["count"] += update["$inc"]["count"]
        return dict(self.documents[bucket_id])


def _request(*, client_host="192.0.2.10", headers=None):
    return SimpleNamespace(
        client=SimpleNamespace(host=client_host),
        headers=headers or {},
    )


@pytest.mark.asyncio
async def test_auth_rate_limit_blocks_requests_after_limit(monkeypatch):
    collection = FakeRateLimitCollection()
    monkeypatch.setattr(
        auth_rate_limit, "raw_db", SimpleNamespace(auth_rate_limits=collection)
    )
    request = _request()

    await auth_rate_limit.enforce_auth_rate_limit(
        request, action="login", limit=2, window_seconds=900
    )
    await auth_rate_limit.enforce_auth_rate_limit(
        request, action="login", limit=2, window_seconds=900
    )
    with pytest.raises(HTTPException) as error:
        await auth_rate_limit.enforce_auth_rate_limit(
            request, action="login", limit=2, window_seconds=900
        )

    assert error.value.status_code == 429
    assert int(error.value.headers["Retry-After"]) > 0
    assert len(collection.documents) == 1
    assert "192.0.2.10" not in next(iter(collection.documents))


def test_rate_limit_uses_forwarded_ip_only_for_trusted_proxy(monkeypatch):
    monkeypatch.setenv("TRUSTED_PROXY_IPS", "10.0.0.0/8")
    request = _request(
        client_host="10.0.0.2",
        headers={"x-forwarded-for": "198.51.100.22, 10.1.2.3"},
    )

    assert auth_rate_limit._client_ip(request) == "198.51.100.22"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("headers", "expected_status", "called"),
    [
        (
            [
                (b"cookie", b"atelier_session=session"),
                (b"origin", b"https://salon.example"),
            ],
            200,
            True,
        ),
        (
            [
                (b"cookie", b"atelier_session=session"),
                (b"origin", b"https://attacker.example"),
            ],
            403,
            False,
        ),
        (
            [(b"cookie", b"atelier_session=session")],
            403,
            False,
        ),
        (
            [(b"origin", b"https://attacker.example")],
            200,
            True,
        ),
    ],
)
async def test_csrf_middleware_checks_cookie_authenticated_mutations(
    headers, expected_status, called
):
    downstream_called = False

    async def app(scope, receive, send):
        nonlocal downstream_called
        downstream_called = True
        await send(
            {"type": "http.response.start", "status": 200, "headers": []}
        )
        await send({"type": "http.response.body", "body": b"ok"})

    messages = []

    async def send(message):
        messages.append(message)

    middleware = CSRFMiddleware(app, allowed_origins=["https://salon.example"])
    await middleware(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/clients",
            "headers": headers,
        },
        None,
        send,
    )

    assert downstream_called == called
    assert messages[0]["status"] == expected_status
    if expected_status == 403:
        assert json.loads(messages[1]["body"]) == {
            "detail": "Invalid request origin"
        }


@pytest.mark.asyncio
async def test_csrf_middleware_accepts_same_origin_referer():
    async def app(scope, receive, send):
        await send(
            {"type": "http.response.start", "status": 200, "headers": []}
        )
        await send({"type": "http.response.body", "body": b"ok"})

    messages = []

    async def send(message):
        messages.append(message)

    middleware = CSRFMiddleware(app, allowed_origins=["https://salon.example"])
    await middleware(
        {
            "type": "http",
            "method": "PATCH",
            "path": "/api/team/users/1",
            "headers": [
                (b"cookie", b"atelier_platform_session=session"),
                (b"referer", b"https://salon.example/settings/team"),
            ],
        },
        None,
        send,
    )

    assert messages[0]["status"] == 200


@pytest.mark.asyncio
async def test_csrf_middleware_accepts_loopback_frontend_origin():
    async def app(scope, receive, send):
        await send(
            {"type": "http.response.start", "status": 200, "headers": []}
        )
        await send({"type": "http.response.body", "body": b"ok"})

    messages = []

    async def send(message):
        messages.append(message)

    middleware = CSRFMiddleware(
        app,
        allowed_origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
    )
    await middleware(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/auth/logout",
            "headers": [
                (b"cookie", b"atelier_session=session"),
                (b"origin", b"http://127.0.0.1:3000"),
            ],
        },
        None,
        send,
    )

    assert messages[0]["status"] == 200
