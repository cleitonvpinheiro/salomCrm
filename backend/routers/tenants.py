"""Platform owner tenant provisioning and tenant administrator team management."""

import os
import secrets
from datetime import timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pymongo.errors import DuplicateKeyError
import logging

from lib.auth_rate_limit import enforce_auth_rate_limit
from lib.db import db, db_name, raw_db
from models.auth import UserPublic, UserUpdate
from models.salon import new_id, utcnow
from models.tenancy import (
    PlatformLoginRequest,
    PlatformPasswordChange,
    PlatformUserPublic,
    TeamUserCreate,
    TenantCreate,
    TenantPublic,
    TenantUpdate,
)
from routers.auth import (
    COOKIE_SECURE,
    SESSION_TTL,
    hash_password,
    require_admin,
    verify_password,
)

router = APIRouter()
PLATFORM_COOKIE = "atelier_platform_session"
logger = logging.getLogger(__name__)


def _platform_public(user: dict) -> PlatformUserPublic:
    return PlatformUserPublic(
        id=user["id"],
        name=user["name"],
        email=user["email"],
    )


def _tenant_public(tenant: dict) -> TenantPublic:
    return TenantPublic(
        id=tenant["id"],
        name=tenant["name"],
        slug=tenant["slug"],
        active=tenant.get("active", True),
        is_default=tenant["slug"]
        == os.environ.get("DEFAULT_TENANT_SLUG", db_name).strip().lower(),
        created_at=tenant["created_at"],
    )


async def ensure_platform_owner() -> None:
    email = os.environ.get("PLATFORM_OWNER_EMAIL", "").strip().lower()
    password = os.environ.get("PLATFORM_OWNER_PASSWORD", "")
    if not email and not password:
        logger.warning(
            "Platform owner is not bootstrapped; configure "
            "PLATFORM_OWNER_EMAIL and PLATFORM_OWNER_PASSWORD"
        )
        return
    if not email or not password:
        raise RuntimeError(
            "Set both PLATFORM_OWNER_EMAIL and PLATFORM_OWNER_PASSWORD to bootstrap "
            "the platform owner"
        )
    await raw_db.platform_users.update_one(
        {"email": email},
        {
            "$set": {
                "name": os.environ.get("PLATFORM_OWNER_NAME", "Platform Owner"),
                "email": email,
                "active": True,
            },
            "$setOnInsert": {
                "id": new_id(),
                "password_hash": hash_password(password),
                "created_at": utcnow(),
            }
        },
        upsert=True,
    )


async def require_platform_owner(request: Request) -> dict:
    token = request.cookies.get(PLATFORM_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="platform owner not signed in")
    session = await raw_db.platform_sessions.find_one({"token": token})
    if not session:
        raise HTTPException(status_code=401, detail="platform owner not signed in")
    expires_at = session.get("expires_at")
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at is not None and expires_at < utcnow():
        raise HTTPException(status_code=401, detail="platform session expired")
    user = await raw_db.platform_users.find_one(
        {"id": session["user_id"], "active": True}
    )
    if not user:
        raise HTTPException(status_code=401, detail="platform account disabled")
    return user


@router.post("/platform/auth/login", response_model=PlatformUserPublic)
async def platform_login(
    input: PlatformLoginRequest, request: Request, response: Response
):
    await enforce_auth_rate_limit(
        request, action="platform-login", limit=20, window_seconds=15 * 60
    )
    email = input.email.strip().lower()
    user = await raw_db.platform_users.find_one({"email": email, "active": True})
    if not user:
        raise HTTPException(
            status_code=503,
            detail="Platform owner is not configured",
        )
    if not verify_password(input.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="invalid email or password")
    token = secrets.token_hex(32)
    await raw_db.platform_sessions.insert_one(
        {
            "token": token,
            "user_id": user["id"],
            "created_at": utcnow(),
            "expires_at": utcnow() + SESSION_TTL,
        }
    )
    response.set_cookie(
        PLATFORM_COOKIE,
        token,
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        max_age=int(SESSION_TTL.total_seconds()),
        path="/",
    )
    return _platform_public(user)


@router.post("/platform/auth/logout")
async def platform_logout(request: Request, response: Response):
    token = request.cookies.get(PLATFORM_COOKIE)
    if token:
        await raw_db.platform_sessions.delete_one({"token": token})
    response.delete_cookie(PLATFORM_COOKIE, path="/")
    return {"ok": True}


@router.get("/platform/auth/me", response_model=PlatformUserPublic)
async def platform_me(user: dict = Depends(require_platform_owner)):
    return _platform_public(user)


@router.post("/platform/auth/password")
async def change_platform_password(
    input: PlatformPasswordChange,
    request: Request,
    user: dict = Depends(require_platform_owner),
):
    if not verify_password(input.current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="current password is incorrect")

    current_hash = user["password_hash"]
    result = await raw_db.platform_users.update_one(
        {"id": user["id"], "password_hash": current_hash, "active": True},
        {"$set": {"password_hash": hash_password(input.new_password)}},
    )
    if not result.matched_count:
        raise HTTPException(
            status_code=409,
            detail="The password changed concurrently. Sign in again and retry.",
        )

    current_token = request.cookies.get(PLATFORM_COOKIE)
    await raw_db.platform_sessions.delete_many(
        {"user_id": user["id"], "token": {"$ne": current_token}}
    )
    return {"message": "Password updated successfully"}


@router.get("/platform/tenants", response_model=list[TenantPublic])
async def list_tenants(_: dict = Depends(require_platform_owner)):
    tenants = await raw_db.tenants.find().sort("created_at", -1).to_list(None)
    return [_tenant_public(tenant) for tenant in tenants]


@router.patch("/platform/tenants/{tenant_id}", response_model=TenantPublic)
async def update_tenant(
    tenant_id: str,
    update: TenantUpdate,
    _: dict = Depends(require_platform_owner),
):
    tenant = await raw_db.tenants.find_one({"id": tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="workspace not found")
    default_slug = os.environ.get("DEFAULT_TENANT_SLUG", db_name).strip().lower()
    if not update.active and tenant["slug"] == default_slug:
        raise HTTPException(
            status_code=409,
            detail="The default workspace cannot be deactivated",
        )
    await raw_db.tenants.update_one(
        {"id": tenant_id},
        {"$set": {"active": update.active}},
    )
    tenant["active"] = update.active
    return _tenant_public(tenant)


@router.post("/platform/tenants", response_model=TenantPublic, status_code=201)
async def create_tenant(
    input: TenantCreate,
    _: dict = Depends(require_platform_owner),
):
    tenant = {
        "id": new_id(),
        "name": input.name.strip(),
        "slug": input.slug.strip().lower(),
        "active": True,
        "created_at": utcnow(),
    }
    try:
        await raw_db.tenants.insert_one(tenant)
        await raw_db.users.insert_one(
            {
                "id": new_id(),
                "tenant_id": tenant["id"],
                "name": input.admin_name.strip(),
                "email": input.admin_email.strip().lower(),
                "role": "admin",
                "active": True,
                "password_hash": hash_password(input.admin_password),
                "created_at": utcnow(),
            }
        )
    except DuplicateKeyError as exc:
        await raw_db.tenants.delete_one({"id": tenant["id"]})
        raise HTTPException(
            status_code=409,
            detail="Tenant slug or administrator e-mail already exists",
        ) from exc
    except Exception:
        await raw_db.tenants.delete_one({"id": tenant["id"]})
        raise
    return _tenant_public(tenant)


@router.get("/team/users", response_model=list[UserPublic])
async def list_team_users(user: dict = Depends(require_admin)):
    users = await db.users.find().sort("name", 1).to_list(None)
    return [
        UserPublic(
            id=member["id"],
            name=member["name"],
            email=member["email"],
            role=member.get("role", "staff"),
            active=member.get("active", True),
            tenant_slug=user["tenant_slug"],
        )
        for member in users
    ]


@router.post("/team/users", response_model=UserPublic, status_code=201)
async def create_team_user(
    input: TeamUserCreate,
    user: dict = Depends(require_admin),
):
    member = {
        "id": new_id(),
        "name": input.name.strip(),
        "email": input.email.strip().lower(),
        "role": input.role,
        "active": True,
        "password_hash": hash_password(input.password),
        "created_at": utcnow(),
    }
    try:
        await db.users.insert_one(member)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=409, detail="A user with this e-mail already exists"
        ) from exc
    return UserPublic(**{**member, "tenant_slug": user["tenant_slug"]})


@router.patch("/team/users/{user_id}", response_model=UserPublic)
async def update_team_user(
    user_id: str,
    update: UserUpdate,
    user: dict = Depends(require_admin),
):
    member = await db.users.find_one({"id": user_id})
    if not member:
        raise HTTPException(status_code=404, detail="user not found")
    changes = update.model_dump(exclude_unset=True)
    remains_admin = (
        changes.get("role", member.get("role", "staff")) == "admin"
        and changes.get("active", member.get("active", True))
    )
    if member.get("role") == "admin" and member.get("active", True) and not remains_admin:
        active_admins = await db.users.count_documents(
            {"role": "admin", "active": {"$ne": False}}
        )
        if active_admins <= 1:
            raise HTTPException(
                status_code=409, detail="The tenant must retain an active administrator"
            )
    if changes:
        await db.users.update_one({"id": user_id}, {"$set": changes})
        member.update(changes)
    return UserPublic(
        id=member["id"],
        name=member["name"],
        email=member["email"],
        role=member.get("role", "staff"),
        active=member.get("active", True),
        tenant_slug=user["tenant_slug"],
    )
