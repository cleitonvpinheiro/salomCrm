"""Auth models — users and login payloads. Mirrors frontend/src/lib/userContext.ts."""

from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserPublic(BaseModel):
    id: str
    name: str
    email: str
    role: str  # "admin" | "staff"
    active: bool = True
    tenant_slug: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    tenant_slug: str | None = None


class PasswordResetRequest(BaseModel):
    email: EmailStr
    account_type: Literal["tenant", "platform"]
    tenant_slug: str | None = Field(default=None, min_length=2, max_length=48)


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=32, max_length=128)
    password: str = Field(min_length=10, max_length=128)


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    role: str = "staff"
    password: str = Field(min_length=10)

    @field_validator("role")
    @classmethod
    def _role_ok(cls, v: str) -> str:
        if v not in ("admin", "staff"):
            raise ValueError("role must be admin or staff")
        return v


class UserUpdate(BaseModel):
    role: str | None = None
    active: bool | None = None

    @field_validator("role")
    @classmethod
    def _role_ok(cls, value: str | None) -> str | None:
        if value is not None and value not in ("admin", "staff"):
            raise ValueError("role must be admin or staff")
        return value
