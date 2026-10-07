"""Pydantic v2 models for the salon CRM — hand-mirrored in frontend/src/lib/types.ts."""

import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, Field, field_validator


def new_id() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---- Stylists ----


class StylistCreate(BaseModel):
    name: str
    title: str = ""
    color: str = "#8F4E34"
    avatar_url: str | None = None
    active: bool = True


class StylistUpdate(BaseModel):
    name: str | None = None
    title: str | None = None
    color: str | None = None
    avatar_url: str | None = None
    active: bool | None = None


class Stylist(StylistCreate):
    id: str = Field(default_factory=new_id)
    created_at: datetime = Field(default_factory=utcnow)
    client_count: int = 0


# ---- Clients ----


class ClientCreate(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None
    birthday: str | None = None
    stylist_id: str | None = None
    hair_type: str | None = None
    last_visit: str | None = None
    formula: str | None = None
    tags: list[str] = Field(default_factory=list)

    @field_validator("last_visit", "birthday")
    @classmethod
    def _iso_date(cls, v: str | None) -> str | None:
        if not v:
            return None
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError as exc:
            raise ValueError("date must be YYYY-MM-DD") from exc
        return v

    @field_validator("tags", mode="before")
    @classmethod
    def _clean_tags(cls, v: object) -> object:
        if isinstance(v, list):
            return [t.strip() for t in v if isinstance(t, str) and t.strip()]
        return v


class ClientUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    birthday: str | None = None
    stylist_id: str | None = None
    hair_type: str | None = None
    last_visit: str | None = None
    formula: str | None = None
    tags: list[str] | None = None

    @field_validator("last_visit", "birthday")
    @classmethod
    def _iso_date(cls, v: str | None) -> str | None:
        if not v:
            return None
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError as exc:
            raise ValueError("date must be YYYY-MM-DD") from exc
        return v

    @field_validator("tags", mode="before")
    @classmethod
    def _clean_tags(cls, v: object) -> object:
        if isinstance(v, list):
            return [t.strip() for t in v if isinstance(t, str) and t.strip()]
        return v


class ClientRead(ClientCreate):
    id: str
    created_at: datetime
    stylist_name: str | None = None
    stylist_color: str | None = None
    days_since_visit: int | None = None
    note_count: int = 0


# ---- Notes ----

NOTE_KINDS = ("visit", "formula", "allergy", "general")


class NoteCreate(BaseModel):
    body: str
    kind: str = "general"
    visit_date: str | None = None

    @field_validator("visit_date")
    @classmethod
    def _iso_date(cls, v: str | None) -> str | None:
        if not v:
            return None
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError as exc:
            raise ValueError("date must be YYYY-MM-DD") from exc
        return v


class Note(BaseModel):
    id: str = Field(default_factory=new_id)
    client_id: str
    kind: str = "general"
    body: str
    created_at: datetime = Field(default_factory=utcnow)


# ---- Workspace stats ----


class Stats(BaseModel):
    today: str
    total_clients: int
    active_stylists: int
    visits_this_month: int
    recall_due: int
    unassigned: int


# ---- Services (admin-managed catalogue; appointments reference them) ----


class ServiceCreate(BaseModel):
    name: str
    description: str | None = None
    duration_min: int = 30
    price: float = 0.0
    active: bool = True


class ServiceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    duration_min: int | None = None
    price: float | None = None
    active: bool | None = None


class Service(ServiceCreate):
    id: str = Field(default_factory=new_id)
    created_at: datetime = Field(default_factory=utcnow)


# ---- Appointments (the agenda) ----

APPT_STATUSES = ("scheduled", "completed", "cancelled")


class AppointmentCreate(BaseModel):
    client_id: str
    stylist_id: str | None = None
    service_id: str
    date: str  # YYYY-MM-DD, salon wall-clock
    time: str  # HH:MM
    notes: str | None = None

    @field_validator("date")
    @classmethod
    def _date_ok(cls, v: str) -> str:
        datetime.strptime(v, "%Y-%m-%d")
        return v

    @field_validator("time")
    @classmethod
    def _time_ok(cls, v: str) -> str:
        return datetime.strptime(v, "%H:%M").strftime("%H:%M")


class AppointmentUpdate(BaseModel):
    client_id: str | None = None
    stylist_id: str | None = None
    service_id: str | None = None
    date: str | None = None
    time: str | None = None
    notes: str | None = None

    @field_validator("date")
    @classmethod
    def _date_ok(cls, v: str | None) -> str | None:
        if v is None:
            return None
        datetime.strptime(v, "%Y-%m-%d")
        return v

    @field_validator("time")
    @classmethod
    def _time_ok(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return datetime.strptime(v, "%H:%M").strftime("%H:%M")


class Appointment(AppointmentCreate):
    id: str = Field(default_factory=new_id)
    status: str = "scheduled"
    created_by: str = ""
    created_at: datetime = Field(default_factory=utcnow)


class AppointmentRead(Appointment):
    client_name: str | None = None
    stylist_name: str | None = None
    service_name: str | None = None
    service_price: float = 0.0
    service_duration_min: int = 0
