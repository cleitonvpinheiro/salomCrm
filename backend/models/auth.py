"""Auth models — users and login payloads. Mirrors frontend/src/lib/userContext.ts."""

from pydantic import BaseModel, EmailStr, field_validator


class UserPublic(BaseModel):
    id: str
    name: str
    email: str
    role: str  # "admin" | "staff"
    active: bool = True


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    role: str = "staff"
    password: str

    @field_validator("role")
    @classmethod
    def _role_ok(cls, v: str) -> str:
        if v not in ("admin", "staff"):
            raise ValueError("role must be admin or staff")
        return v
