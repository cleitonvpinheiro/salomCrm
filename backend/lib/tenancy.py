"""Request context for isolating shared MongoDB collections by tenant."""

from http.cookies import SimpleCookie

from lib.db import _current_tenant_id, raw_db


class TenantContextMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not scope["path"].startswith("/api/"):
            await self.app(scope, receive, send)
            return

        cookies = SimpleCookie()
        for key, value in scope.get("headers", []):
            if key.lower() == b"cookie":
                cookies.load(value.decode("latin-1"))
                break
        session_cookie = cookies.get("atelier_session")
        session = (
            await raw_db.sessions.find_one({"token": session_cookie.value})
            if session_cookie
            else None
        )
        tenant_id = session.get("tenant_id") if session else None
        context_token = _current_tenant_id.set(tenant_id)
        try:
            await self.app(scope, receive, send)
        finally:
            _current_tenant_id.reset(context_token)
