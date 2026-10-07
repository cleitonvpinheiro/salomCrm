"""Cookie-session auth: login / logout / me, plus the role dependencies.

Sessions are httpOnly cookies — never tokens in JSON. All guarded routes import
`require_user` / `require_admin` from here.
"""

import secrets
from datetime import timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from passlib.context import CryptContext

from lib.db import db
from models.auth import LoginRequest, UserPublic
from models.salon import utcnow

router = APIRouter()

SESSION_COOKIE = "atelier_session"
SESSION_TTL = timedelta(days=30)

# pbkdf2_sha256 — pure-python passlib scheme, no native backend needed in the pod.
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)


async def require_user(request: Request) -> dict:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="not signed in")
    session = await db.sessions.find_one({"token": token})
    if not session:
        raise HTTPException(status_code=401, detail="not signed in")
    expires_at = session.get("expires_at")
    if expires_at is not None and expires_at.tzinfo is None:
        # motor hands naive datetimes back — re-anchor to UTC before comparing
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at is not None and expires_at < utcnow():
        raise HTTPException(status_code=401, detail="session expired")
    user = await db.users.find_one({"id": session["user_id"]})
    if not user or not user.get("active", True):
        raise HTTPException(status_code=401, detail="account disabled")
    user.pop("password_hash", None)
    return user


async def require_admin(user: dict = Depends(require_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="admin only")
    return user


def _public(user: dict) -> UserPublic:
    return UserPublic(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        role=user.get("role", "staff"),
        active=user.get("active", True),
    )


@router.post("/auth/login", response_model=UserPublic)
async def login(input: LoginRequest, response: Response):
    email = input.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(input.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="invalid email or password")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="account disabled")

    token = secrets.token_hex(32)
    await db.sessions.insert_one(
        {
            "token": token,
            "user_id": user["id"],
            "created_at": utcnow(),
            "expires_at": utcnow() + SESSION_TTL,
        }
    )
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        samesite="lax",
        max_age=int(SESSION_TTL.total_seconds()),
        path="/",
    )
    return _public(user)


@router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        await db.sessions.delete_one({"token": token})
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@router.get("/auth/me", response_model=UserPublic)
async def me(user: dict = Depends(require_user)):
    return _public(user)
