"""Validate origins on cookie-authenticated state-changing requests."""

import json
from http.cookies import CookieError, SimpleCookie
from urllib.parse import urlsplit

AUTH_COOKIES = {"atelier_session", "atelier_platform_session"}
UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _origin(value: str) -> tuple[str, str, int | None] | None:
    try:
        parsed = urlsplit(value)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username
            or parsed.password
        ):
            return None
        scheme = parsed.scheme.lower()
        port = parsed.port
        if (scheme, port) in {("http", 80), ("https", 443)}:
            port = None
        return (scheme, parsed.hostname.lower(), port)
    except ValueError:
        return None


class CSRFMiddleware:
    def __init__(self, app, *, allowed_origins: list[str]):
        self.app = app
        self.allowed_origins = {
            parsed
            for value in allowed_origins
            if (parsed := _origin(value)) is not None
        }

    async def __call__(self, scope, receive, send):
        if (
            scope["type"] != "http"
            or scope.get("method", "GET").upper() not in UNSAFE_METHODS
            or not scope.get("path", "").startswith("/api/")
        ):
            await self.app(scope, receive, send)
            return

        headers = {
            key.lower().decode("latin-1"): value.decode("latin-1")
            for key, value in scope.get("headers", [])
        }
        cookies = SimpleCookie()
        try:
            cookies.load(headers.get("cookie", ""))
        except CookieError:
            cookies = SimpleCookie()
        if not AUTH_COOKIES.intersection(cookies):
            await self.app(scope, receive, send)
            return

        source = headers.get("origin") or headers.get("referer")
        request_origin = _origin(source) if source else None
        if request_origin in self.allowed_origins:
            await self.app(scope, receive, send)
            return

        body = json.dumps({"detail": "Invalid request origin"}).encode("utf-8")
        await send(
            {
                "type": "http.response.start",
                "status": 403,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode("ascii")),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})
