"""Password recovery tokens are scoped, single-use, and delivered over configured SMTP."""

from datetime import timedelta
from email.message import EmailMessage
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from lib import password_recovery
from models.auth import PasswordResetConfirm, PasswordResetRequest
from models.salon import utcnow
from routers import auth


class FakeCollection:
    def __init__(self, documents=None):
        self.documents = list(documents or [])

    async def find_one(self, query, projection=None):
        return next(
            (
                document
                for document in self.documents
                if all(document.get(key) == value for key, value in query.items())
            ),
            None,
        )

    async def insert_one(self, document):
        self.documents.append(document.copy())

    async def delete_many(self, query):
        self.documents = [
            document
            for document in self.documents
            if not all(document.get(key) == value for key, value in query.items())
        ]

    async def delete_one(self, query):
        await self.delete_many(query)

    async def find_one_and_delete(self, query):
        for index, document in enumerate(self.documents):
            matches = all(
                document.get(key) == value
                for key, value in query.items()
                if not isinstance(value, dict)
            )
            expiry = query.get("expires_at", {}).get("$gt")
            if matches and expiry and document.get("expires_at") > expiry:
                return self.documents.pop(index)
        return None

    async def update_one(self, query, update):
        document = await self.find_one(query)
        if not document:
            return SimpleNamespace(matched_count=0)
        document.update(update["$set"])
        return SimpleNamespace(matched_count=1)


def fake_database(**collections):
    return SimpleNamespace(
        **{
            name: collection if isinstance(collection, FakeCollection) else FakeCollection(collection)
            for name, collection in collections.items()
        }
    )


@pytest.mark.asyncio
async def test_tenant_reset_email_is_generic_and_token_is_tenant_scoped(monkeypatch):
    tenant = {"id": "tenant-1", "slug": "salon", "active": True}
    user = {"id": "user-1", "tenant_id": "tenant-1", "email": "owner@example.com", "active": True}
    database = fake_database(
        tenants=[tenant],
        users=[user],
        platform_users=[],
        password_reset_tokens=[],
    )
    monkeypatch.setattr(auth, "raw_db", database)
    monkeypatch.setattr(auth, "recovery_is_configured", lambda: True)
    sent = []
    monkeypatch.setattr(
        auth,
        "send_password_reset_email",
        lambda *args: sent.append(args),
    )

    response = await auth.request_password_reset(
        PasswordResetRequest(
            email="owner@example.com",
            account_type="tenant",
            tenant_slug="SALON",
        )
    )

    assert response["message"] == "If the account exists, a recovery email has been sent."
    assert len(sent) == 1
    assert sent[0][0] == "owner@example.com"
    assert sent[0][2:] == ("tenant", "salon")
    stored = database.password_reset_tokens.documents[0]
    assert stored["account_type"] == "tenant"
    assert stored["tenant_id"] == "tenant-1"
    assert stored["token_hash"] != sent[0][1]


@pytest.mark.asyncio
async def test_password_reset_consumes_token_and_invalidates_tenant_sessions(monkeypatch):
    token = "reset-token-that-is-long-enough-for-testing"
    user = {
        "id": "user-1",
        "tenant_id": "tenant-1",
        "email": "owner@example.com",
        "active": True,
        "password_hash": auth.hash_password("original-password"),
    }
    token_record = {
        "token_hash": auth._reset_token_hash(token),
        "account_type": "tenant",
        "user_id": "user-1",
        "tenant_id": "tenant-1",
        "expires_at": utcnow() + timedelta(minutes=30),
    }
    sessions = FakeCollection(
        [
            {"user_id": "user-1", "tenant_id": "tenant-1"},
            {"user_id": "user-2", "tenant_id": "tenant-1"},
        ]
    )
    database = fake_database(
        users=[user],
        platform_users=[],
        password_reset_tokens=[token_record],
        sessions=sessions,
        platform_sessions=[],
    )
    monkeypatch.setattr(auth, "raw_db", database)

    result = await auth.reset_password(
        PasswordResetConfirm(token=token, password="new-password-123")
    )

    assert result["message"].startswith("Password updated.")
    assert auth.verify_password("new-password-123", user["password_hash"])
    assert sessions.documents == [{"user_id": "user-2", "tenant_id": "tenant-1"}]
    assert database.password_reset_tokens.documents == []
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as error:
        await auth.reset_password(
            PasswordResetConfirm(token=token, password="another-password-123")
        )
    assert getattr(error.value, "status_code", None) == 400


def test_smtp_sender_uses_tls_and_builds_reset_link(monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_FROM_EMAIL", "Atelier <no-reply@example.com>")
    monkeypatch.setenv("SMTP_USERNAME", "smtp-user")
    monkeypatch.setenv("SMTP_PASSWORD", "smtp-secret")
    monkeypatch.setenv("PUBLIC_APP_URL", "https://salon.example.com")
    smtp = MagicMock()
    smtp.__enter__.return_value = smtp
    monkeypatch.setattr(password_recovery.smtplib, "SMTP", MagicMock(return_value=smtp))

    password_recovery.send_password_reset_email(
        "owner@example.com",
        "opaque-reset-token",
        "tenant",
        "salon",
    )

    smtp.starttls.assert_called_once()
    smtp.login.assert_called_once_with("smtp-user", "smtp-secret")
    message = smtp.send_message.call_args.args[0]
    assert isinstance(message, EmailMessage)
    assert "https://salon.example.com/reset-password?" in message.get_content()
    assert "opaque-reset-token" in message.get_content()
    assert "tenant=salon" in message.get_content()


def test_password_recovery_is_unavailable_without_smtp_configuration(monkeypatch):
    for key in ("SMTP_HOST", "SMTP_FROM_EMAIL", "PUBLIC_APP_URL"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("SMTP_PORT", "587")

    assert not password_recovery.recovery_is_configured()


@pytest.mark.asyncio
async def test_platform_owner_bootstrap_does_not_overwrite_recovered_password(monkeypatch):
    from routers import tenants

    users = SimpleNamespace(update_one=AsyncMock())
    monkeypatch.setattr(tenants, "raw_db", SimpleNamespace(platform_users=users))
    monkeypatch.setenv("PLATFORM_OWNER_EMAIL", "owner@example.com")
    monkeypatch.setenv("PLATFORM_OWNER_PASSWORD", "bootstrap-password")

    await tenants.ensure_platform_owner()

    update = users.update_one.await_args.args[1]
    assert "password_hash" not in update["$set"]
    assert tenants.verify_password(
        "bootstrap-password",
        update["$setOnInsert"]["password_hash"],
    )
