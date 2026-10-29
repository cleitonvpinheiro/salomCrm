"""Public online-booking request and configuration models."""

import base64
import binascii
import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

MAX_LOGO_BYTES = 2 * 1024 * 1024
ALLOWED_LOGO_MIME_TYPES = {
    "image/png": lambda data: (
        len(data) >= 45
        and data.startswith(b"\x89PNG\r\n\x1a\n")
        and data[12:16] == b"IHDR"
        and data[-12:] == b"\x00\x00\x00\x00IEND\xaeB`\x82"
    ),
    "image/jpeg": lambda data: (
        len(data) >= 4
        and data.startswith(b"\xff\xd8")
        and data.endswith(b"\xff\xd9")
    ),
    "image/webp": lambda data: (
        len(data) >= 20
        and data.startswith(b"RIFF")
        and int.from_bytes(data[4:8], "little") + 8 == len(data)
        and data[8:12] == b"WEBP"
        and data[12:16] in {b"VP8 ", b"VP8L", b"VP8X"}
    ),
}


class HoursWindow(BaseModel):
    start: str | None = None
    end: str | None = None

    @model_validator(mode="after")
    def validate_window(self):
        if self.start is None and self.end is None:
            return self
        if self.start is None or self.end is None:
            raise ValueError("Both start and end are required for an open day")
        start = datetime.strptime(self.start, "%H:%M").time()
        end = datetime.strptime(self.end, "%H:%M").time()
        if end <= start:
            raise ValueError("End time must be after start time")
        return self

    @field_validator("start", "end")
    @classmethod
    def validate_time(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return datetime.strptime(value, "%H:%M").strftime("%H:%M")


class WeeklyHours(BaseModel):
    mon: HoursWindow = Field(default_factory=HoursWindow)
    tue: HoursWindow = Field(default_factory=HoursWindow)
    wed: HoursWindow = Field(default_factory=HoursWindow)
    thu: HoursWindow = Field(default_factory=HoursWindow)
    fri: HoursWindow = Field(default_factory=HoursWindow)
    sat: HoursWindow = Field(default_factory=HoursWindow)
    sun: HoursWindow = Field(default_factory=HoursWindow)


class BookingSettings(BaseModel):
    enabled: bool = False
    salon_hours: WeeklyHours = Field(default_factory=WeeklyHours)
    stylist_hours: dict[str, WeeklyHours] = Field(default_factory=dict)


class BookingSettingsUpdate(BookingSettings):
    pass


class SalonBranding(BaseModel):
    salon_name: str = Field(min_length=2, max_length=100)
    slug: str
    logo_data: str | None = None
    primary_color: str = "#8F4E34"
    accent_color: str = "#D97757"


class SalonBrandingUpdate(BaseModel):
    salon_name: str = Field(min_length=2, max_length=100)
    logo_data: str | None = None
    primary_color: str = "#8F4E34"
    accent_color: str = "#D97757"

    @field_validator("salon_name")
    @classmethod
    def clean_salon_name(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 2:
            raise ValueError("Salon name must contain at least two characters")
        return cleaned

    @field_validator("primary_color", "accent_color")
    @classmethod
    def validate_color(cls, value: str) -> str:
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
            raise ValueError("Color must use the #RRGGBB format")
        return value.upper()

    @field_validator("logo_data")
    @classmethod
    def validate_logo_data(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if len(value) > 2_800_100:
            raise ValueError("Logo must be no larger than 2 MB")
        match = re.fullmatch(
            r"data:(image/png|image/jpeg|image/webp);base64,([A-Za-z0-9+/]+={0,2})",
            value,
        )
        if not match:
            raise ValueError("Logo must be a PNG, JPEG, or WebP data URL")
        mime_type, encoded = match.groups()
        try:
            image_data = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("Logo data is invalid") from exc
        if not image_data or len(image_data) > MAX_LOGO_BYTES:
            raise ValueError("Logo must be no larger than 2 MB")
        if not ALLOWED_LOGO_MIME_TYPES[mime_type](image_data):
            raise ValueError("Logo contents do not match the selected image type")
        return value


class BookingStylist(BaseModel):
    id: str
    name: str
    title: str = ""
    color: str = "#8F4E34"


class BookingService(BaseModel):
    id: str
    name: str
    duration_min: int
    price: float


class PublicBookingInfo(BaseModel):
    salon_name: str
    slug: str
    logo_data: str | None = None
    primary_color: str = "#8F4E34"
    accent_color: str = "#D97757"
    services: list[BookingService]
    stylists: list[BookingStylist]


class PublicAvailabilitySlot(BaseModel):
    time: str
    stylist_id: str


class PublicBookingRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=8, max_length=30)
    service_id: str
    stylist_id: str | None = None
    date: str
    time: str

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 2:
            raise ValueError("Name must contain at least two characters")
        return cleaned

    @field_validator("phone")
    @classmethod
    def clean_phone(cls, value: str) -> str:
        cleaned = value.strip()
        if len(re.sub(r"\D", "", cleaned)) < 8:
            raise ValueError("Enter a valid phone number")
        return cleaned

    @field_validator("date")
    @classmethod
    def validate_date(cls, value: str) -> str:
        return datetime.strptime(value, "%Y-%m-%d").strftime("%Y-%m-%d")

    @field_validator("time")
    @classmethod
    def validate_time(cls, value: str) -> str:
        return datetime.strptime(value, "%H:%M").strftime("%H:%M")


class PublicBookingConfirmation(BaseModel):
    salon_name: str
    service_name: str
    stylist_name: str
    date: str
    time: str
