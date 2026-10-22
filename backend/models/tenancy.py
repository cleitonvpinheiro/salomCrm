"""Tenant and platform-owner API models."""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


class PlatformLoginRequest(BaseModel):
    email: EmailStr
    password: str


class PlatformPasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=10, max_length=128)


class TenantCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    slug: str = Field(min_length=2, max_length=48, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    admin_name: str = Field(min_length=2, max_length=100)
    admin_email: EmailStr
    admin_password: str = Field(min_length=10)


class TenantUpdate(BaseModel):
    active: bool


class TenantPublic(BaseModel):
    id: str
    name: str
    slug: str
    active: bool
    is_default: bool = False
    created_at: datetime


class PlatformUserPublic(BaseModel):
    id: str
    name: str
    email: EmailStr


class TeamUserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    role: str = "staff"
    password: str = Field(min_length=10)

    @field_validator("role")
    @classmethod
    def _role_ok(cls, value: str) -> str:
        if value not in ("admin", "staff"):
            raise ValueError("role must be admin or staff")
        return value
