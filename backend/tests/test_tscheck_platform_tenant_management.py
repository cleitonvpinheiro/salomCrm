"""Platform tenant status changes are scoped and cannot disable the default workspace."""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from models.tenancy import PlatformPasswordChange, TenantUpdate
from routers import tenants


class FakeTenants:
    def __init__(self, records):
        self.records = {record["id"]: record.copy() for record in records}
        self.updates = []

    async def find_one(self, query):
        return next(
            (
                record.copy()
                for record in self.records.values()
                if all(record.get(key) == value for key, value in query.items())
            ),
            None,
        )

    async def update_one(self, query, update):
        self.updates.append((query, update))
        self.records[query["id"]].update(update["$set"])


class FakePlatformUsers:
    def __init__(self, user):
        self.user = user

    async def update_one(self, query, update):
        if (
            self.user["id"] != query["id"]
            or self.user["password_hash"] != query["password_hash"]
            or not self.user.get("active", True)
        ):
            return SimpleNamespace(matched_count=0)
        self.user.update(update["$set"])
        return SimpleNamespace(matched_count=1)


class FakePlatformSessions:
    def __init__(self, sessions):
        self.sessions = sessions
        self.deleted_query = None

    async def delete_many(self, query):
        self.deleted_query = query
        current_token = query["token"]["$ne"]
        self.sessions = [
            session
            for session in self.sessions
            if session["user_id"] != query["user_id"]
            or session["token"] == current_token
        ]


@pytest.mark.asyncio
async def test_platform_can_deactivate_non_default_workspace(monkeypatch):
    database = SimpleNamespace(
        tenants=FakeTenants(
            [
                {
                    "id": "tenant-1",
                    "name": "Salon",
                    "slug": "salon",
                    "active": True,
                    "created_at": tenants.utcnow(),
                }
            ]
        )
    )
    monkeypatch.setattr(tenants, "raw_db", database)
    monkeypatch.setattr(tenants, "db_name", "default")
    monkeypatch.setenv("DEFAULT_TENANT_SLUG", "default")

    result = await tenants.update_tenant(
        "tenant-1",
        TenantUpdate(active=False),
        {},
    )

    assert result.active is False
    assert result.is_default is False
    assert database.tenants.records["tenant-1"]["active"] is False


@pytest.mark.asyncio
async def test_platform_cannot_deactivate_default_workspace(monkeypatch):
    database = SimpleNamespace(
        tenants=FakeTenants(
            [
                {
                    "id": "tenant-default",
                    "name": "Default",
                    "slug": "default",
                    "active": True,
                    "created_at": tenants.utcnow(),
                }
            ]
        )
    )
    monkeypatch.setattr(tenants, "raw_db", database)
    monkeypatch.setattr(tenants, "db_name", "default")
    monkeypatch.setenv("DEFAULT_TENANT_SLUG", "default")

    with pytest.raises(HTTPException) as error:
        await tenants.update_tenant(
            "tenant-default",
            TenantUpdate(active=False),
            {},
        )

    assert error.value.status_code == 409
    assert database.tenants.updates == []


@pytest.mark.asyncio
async def test_platform_tenant_status_returns_not_found_for_unknown_workspace(monkeypatch):
    database = SimpleNamespace(tenants=FakeTenants([]))
    monkeypatch.setattr(tenants, "raw_db", database)

    with pytest.raises(HTTPException) as error:
        await tenants.update_tenant(
            "missing",
            TenantUpdate(active=False),
            {},
        )

    assert error.value.status_code == 404


@pytest.mark.asyncio
async def test_platform_password_change_keeps_current_session_and_revokes_others(monkeypatch):
    user = {
        "id": "owner-1",
        "active": True,
        "password_hash": tenants.hash_password("old-password-123"),
    }
    users = FakePlatformUsers(user)
    sessions = FakePlatformSessions(
        [
            {"user_id": "owner-1", "token": "current-session"},
            {"user_id": "owner-1", "token": "other-session"},
            {"user_id": "different-owner", "token": "other-owner-session"},
        ]
    )
    monkeypatch.setattr(
        tenants,
        "raw_db",
        SimpleNamespace(platform_users=users, platform_sessions=sessions),
    )
    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/platform/auth/password",
            "headers": [
                (
                    b"cookie",
                    f"{tenants.PLATFORM_COOKIE}=current-session".encode(),
                )
            ],
            "query_string": b"",
            "server": ("testserver", 80),
            "client": ("testclient", 123),
            "scheme": "http",
            "http_version": "1.1",
            "root_path": "",
            "app": None,
            "router": None,
            "asgi": {"version": "3.0", "spec_version": "2.3"},
        }
    )

    result = await tenants.change_platform_password(
        PlatformPasswordChange(
            current_password="old-password-123",
            new_password="new-password-123",
        ),
        request,
        user,
    )

    assert result["message"] == "Password updated successfully"
    assert tenants.verify_password("new-password-123", user["password_hash"])
    assert sessions.sessions == [
        {"user_id": "owner-1", "token": "current-session"},
        {"user_id": "different-owner", "token": "other-owner-session"},
    ]


@pytest.mark.asyncio
async def test_platform_password_change_rejects_incorrect_current_password(monkeypatch):
    user = {
        "id": "owner-1",
        "active": True,
        "password_hash": tenants.hash_password("old-password-123"),
    }
    users = FakePlatformUsers(user)
    sessions = FakePlatformSessions(
        [{"user_id": "owner-1", "token": "current-session"}]
    )
    monkeypatch.setattr(
        tenants,
        "raw_db",
        SimpleNamespace(platform_users=users, platform_sessions=sessions),
    )
    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/platform/auth/password",
            "headers": [
                (
                    b"cookie",
                    f"{tenants.PLATFORM_COOKIE}=current-session".encode(),
                )
            ],
            "query_string": b"",
            "server": ("testserver", 80),
            "client": ("testclient", 123),
            "scheme": "http",
            "http_version": "1.1",
            "root_path": "",
            "app": None,
            "router": None,
            "asgi": {"version": "3.0", "spec_version": "2.3"},
        }
    )

    with pytest.raises(HTTPException) as error:
        await tenants.change_platform_password(
            PlatformPasswordChange(
                current_password="incorrect-password",
                new_password="new-password-123",
            ),
            request,
            user,
        )

    assert error.value.status_code == 401
    assert tenants.verify_password("old-password-123", user["password_hash"])
    assert sessions.deleted_query is None
