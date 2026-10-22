"""Cookie-session auth: login / logout / me, plus the role dependencies.

Sessions are httpOnly cookies — never tokens in JSON. All guarded routes import
`require_user` / `require_admin` from here.
"""

import os
import secrets
import asyncio
import hashlib
import logging
from datetime import timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from passlib.context import CryptContext

from lib.db import db_name, raw_db
from lib.password_recovery import (
    recovery_is_configured,
    reset_token_expiry,
    send_password_reset_email,
)
from models.auth import LoginRequest, PasswordResetConfirm, PasswordResetRequest, UserPublic
from models.salon import utcnow

router = APIRouter()

SESSION_COOKIE = "atelier_session"
SESSION_TTL = timedelta(days=30)
COOKIE_SECURE = (
    os.environ["COOKIE_SECURE"].strip().lower() == "true"
    if "COOKIE_SECURE" in os.environ
    else os.environ.get("APP_ENV", "development").strip().lower() == "production"
)

# pbkdf2_sha256 — pure-python passlib scheme, no native backend needed in the pod.
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
logger = logging.getLogger(__name__)


def _reset_token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)


async def require_user(request: Request) -> dict:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="not signed in")
    session = await raw_db.sessions.find_one({"token": token})
    if not session:
        raise HTTPException(status_code=401, detail="not signed in")
    tenant_id = session.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=401, detail="session has no tenant")
    expires_at = session.get("expires_at")
    if expires_at is not None and expires_at.tzinfo is None:
        # motor hands naive datetimes back — re-anchor to UTC before comparing
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at is not None and expires_at < utcnow():
        raise HTTPException(status_code=401, detail="session expired")
    tenant = await raw_db.tenants.find_one({"id": tenant_id, "active": True})
    if not tenant:
        raise HTTPException(status_code=401, detail="tenant is disabled")
    user = await raw_db.users.find_one(
        {"id": session["user_id"], "tenant_id": tenant_id}
    )
    if not user or not user.get("active", True):
        raise HTTPException(status_code=401, detail="account disabled")
    user.pop("password_hash", None)
    user["tenant_slug"] = tenant["slug"]
    return user


async def require_admin(user: dict = Depends(require_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="admin only")
    return user


def _public(user: dict, tenant_slug: str) -> UserPublic:
    return UserPublic(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        role=user.get("role", "staff"),
        active=user.get("active", True),
        tenant_slug=tenant_slug,
    )


@router.post("/auth/login", response_model=UserPublic)
async def login(input: LoginRequest, response: Response):
    email = input.email.strip().lower()
    tenant_slug = (
        input.tenant_slug or os.environ.get("DEFAULT_TENANT_SLUG", db_name)
    ).strip().lower()
    tenant = await raw_db.tenants.find_one({"slug": tenant_slug, "active": True})
    if not tenant:
        raise HTTPException(status_code=401, detail="invalid e-mail or password")
    user = await raw_db.users.find_one(
        {"tenant_id": tenant["id"], "email": email}
    )
    if not user or not verify_password(input.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="invalid email or password")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="account disabled")

    token = secrets.token_hex(32)
    await raw_db.sessions.insert_one(
        {
            "token": token,
            "user_id": user["id"],
            "tenant_id": tenant["id"],
            "created_at": utcnow(),
            "expires_at": utcnow() + SESSION_TTL,
        }
    )
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        max_age=int(SESSION_TTL.total_seconds()),
        path="/",
    )
    return _public(user, tenant["slug"])


@router.post("/auth/password/forgot")
async def request_password_reset(input: PasswordResetRequest):
    if not recovery_is_configured():
        raise HTTPException(
            status_code=503,
            detail="Password recovery email is not configured",
        )

    email = input.email.strip().lower()
    tenant = None
    if input.account_type == "tenant":
        if not input.tenant_slug:
            raise HTTPException(status_code=422, detail="tenant_slug is required")
        tenant = await raw_db.tenants.find_one(
            {"slug": input.tenant_slug.strip().lower(), "active": True}
        )
        user = (
            await raw_db.users.find_one(
                {"tenant_id": tenant["id"], "email": email, "active": True}
            )
            if tenant
            else None
        )
    else:
        user = await raw_db.platform_users.find_one({"email": email, "active": True})

    if not user:
        return {"message": "If the account exists, a recovery email has been sent."}

    token = secrets.token_urlsafe(32)
    token_hash = _reset_token_hash(token)
    account_type = input.account_type
    tenant_slug = tenant["slug"] if tenant else None
    token_record = {
        "token_hash": token_hash,
        "account_type": account_type,
        "user_id": user["id"],
        "created_at": utcnow(),
        "expires_at": reset_token_expiry(),
    }
    if tenant:
        token_record["tenant_id"] = tenant["id"]

    await raw_db.password_reset_tokens.delete_many(
        {"account_type": account_type, "user_id": user["id"]}
    )
    await raw_db.password_reset_tokens.insert_one(token_record)
    try:
        await asyncio.to_thread(
            send_password_reset_email,
            email,
            token,
            account_type,
            tenant_slug,
        )
    except Exception as exc:
        await raw_db.password_reset_tokens.delete_one({"token_hash": token_hash})
        logger.error("Password recovery email delivery failed: %s", exc.__class__.__name__)
        raise HTTPException(
            status_code=503,
            detail="Could not send the recovery email",
        ) from exc
    return {"message": "If the account exists, a recovery email has been sent."}


@router.post("/auth/password/reset")
async def reset_password(input: PasswordResetConfirm):
    token_hash = _reset_token_hash(input.token)
    token_record = await raw_db.password_reset_tokens.find_one_and_delete(
        {"token_hash": token_hash, "expires_at": {"$gt": utcnow()}}
    )
    if not token_record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    password_hash = hash_password(input.password)
    if token_record["account_type"] == "platform":
        result = await raw_db.platform_users.update_one(
            {"id": token_record["user_id"], "active": True},
            {"$set": {"password_hash": password_hash}},
        )
        if result.matched_count:
            await raw_db.platform_sessions.delete_many(
                {"user_id": token_record["user_id"]}
            )
    else:
        result = await raw_db.users.update_one(
            {
                "id": token_record["user_id"],
                "tenant_id": token_record["tenant_id"],
                "active": True,
            },
            {"$set": {"password_hash": password_hash}},
        )
        if result.matched_count:
            await raw_db.sessions.delete_many(
                {
                    "user_id": token_record["user_id"],
                    "tenant_id": token_record["tenant_id"],
                }
            )
    if not result.matched_count:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    return {"message": "Password updated. Sign in with your new password."}


@router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        await raw_db.sessions.delete_one({"token": token})
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@router.get("/auth/me", response_model=UserPublic)
async def me(user: dict = Depends(require_user)):
    return _public(user, user["tenant_slug"])
