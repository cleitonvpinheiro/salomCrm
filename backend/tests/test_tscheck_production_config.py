"""Production settings must fail closed when security requirements are missing."""

import pytest

from lib.config import validate_runtime_config
from lib.security_headers import SecurityHeadersMiddleware


PRODUCTION_ENV = {
    "APP_ENV": "production",
    "MONGO_URL": "mongodb+srv://app-user:example-only-secret@cluster.example.net/salon?retryWrites=true&w=majority",
    "DB_NAME": "salon",
    "DEFAULT_TENANT_SLUG": "salon",
    "PLATFORM_OWNER_EMAIL": "owner@example.com",
    "PLATFORM_OWNER_PASSWORD": "a-long-random-secret-value",
    "COOKIE_SECURE": "true",
    "CORS_ORIGINS": "https://salon.example.com",
    "PUBLIC_APP_URL": "https://salon.example.com",
    "SMTP_HOST": "smtp.example.com",
    "SMTP_PORT": "587",
    "SMTP_FROM_EMAIL": "Atelier <no-reply@salon.example.com>",
}


def test_valid_production_configuration_is_accepted():
    validate_runtime_config(PRODUCTION_ENV)


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("PLATFORM_OWNER_EMAIL", ""),
        ("PLATFORM_OWNER_PASSWORD", "short"),
        ("COOKIE_SECURE", "false"),
        ("CORS_ORIGINS", "*"),
        ("CORS_ORIGINS", "http://salon.example.com"),
        ("CORS_ORIGINS", "https://salon.example.com/path"),
        ("MONGO_URL", "mongodb://mongo.example.com/salon"),
        ("MONGO_URL", "mongodb://127.0.0.1/salon?tls=true"),
        ("MONGO_URL", "mongodb+srv://cluster.example.net/salon"),
        ("DEFAULT_TENANT_SLUG", ""),
        ("PUBLIC_APP_URL", "http://salon.example.com"),
        ("SMTP_HOST", ""),
        ("SMTP_FROM_EMAIL", ""),
        ("SMTP_PORT", "70000"),
        ("SMTP_USERNAME", "smtp-user"),
    ],
)
def test_insecure_production_configuration_is_rejected(key: str, value: str):
    settings = {**PRODUCTION_ENV, key: value}
    with pytest.raises(RuntimeError):
        validate_runtime_config(settings)


@pytest.mark.asyncio
async def test_security_headers_middleware_adds_hsts_only_when_enabled():
    response_messages = []

    async def send(message):
        response_messages.append(message)

    async def app(scope, receive, send):
        await send(
            {
                "type": "http.response.start",
                "status": 200,
                "headers": [],
            }
        )
        await send({"type": "http.response.body", "body": b"ok"})

    middleware = SecurityHeadersMiddleware(app, hsts_enabled=True)
    await middleware(
        {"type": "http", "method": "GET", "path": "/health/live"},
        None,
        send,
    )

    headers = dict(response_messages[0]["headers"])
    assert headers[b"x-content-type-options"] == b"nosniff"
    assert headers[b"x-frame-options"] == b"DENY"
    assert headers[b"strict-transport-security"].startswith(b"max-age=")
