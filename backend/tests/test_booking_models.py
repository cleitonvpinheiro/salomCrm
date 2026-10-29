import base64
import struct
import zlib
import pytest
from pydantic import ValidationError

import routers.bookings as bookings
from models.booking import (
    BookingSettings,
    HoursWindow,
    PublicBookingRequest,
    SalonBrandingUpdate,
    WeeklyHours,
)


def _png_chunk(kind, data):
    checksum = zlib.crc32(kind + data).to_bytes(4, "big")
    return len(data).to_bytes(4, "big") + kind + data + checksum


def _one_pixel_png():
    header = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + _png_chunk(b"IHDR", header)
        + _png_chunk(b"IDAT", zlib.compress(b"\x00\x00\x00\x00"))
        + _png_chunk(b"IEND", b"")
    )


def test_hours_window_accepts_closed_day_and_valid_range():
    assert HoursWindow().start is None
    assert HoursWindow(start="09:00", end="18:00").end == "18:00"


@pytest.mark.parametrize(
    "values",
    [
        {"start": "09:00"},
        {"end": "18:00"},
        {"start": "18:00", "end": "09:00"},
        {"start": "not-a-time", "end": "18:00"},
    ],
)
def test_hours_window_rejects_invalid_range(values):
    with pytest.raises(ValidationError):
        HoursWindow(**values)


def test_booking_settings_default_to_closed_and_disabled():
    settings = BookingSettings()
    assert settings.enabled is False
    assert settings.salon_hours.mon.start is None


def test_public_booking_request_normalizes_fields():
    booking = PublicBookingRequest(
        name="  Alex Doe  ",
        phone="  +1 555 123 4567 ",
        service_id="service-1",
        date="2026-10-28",
        time="09:30",
    )
    assert booking.name == "Alex Doe"
    assert booking.phone == "+1 555 123 4567"


@pytest.mark.parametrize(
    "field,value",
    [
        ("date", "tomorrow"),
        ("time", "9am"),
    ],
)
def test_public_booking_request_rejects_invalid_date_and_time(field, value):
    payload = {
        "name": "Alex Doe",
        "phone": "5551234567",
        "service_id": "service-1",
        "date": "2026-10-28",
        "time": "09:30",
        field: value,
    }
    with pytest.raises(ValidationError):
        PublicBookingRequest(**payload)


def test_public_booking_request_rejects_blank_names_and_short_phone():
    with pytest.raises(ValidationError):
        PublicBookingRequest(
            name="   ",
            phone="5551234567",
            service_id="service-1",
            date="2026-10-28",
            time="09:30",
        )
    with pytest.raises(ValidationError):
        PublicBookingRequest(
            name="Alex Doe",
            phone="12",
            service_id="service-1",
            date="2026-10-28",
            time="09:30",
        )


def test_slot_window_is_intersection_of_salon_and_professional_hours():
    settings = BookingSettings(
        salon_hours=WeeklyHours(mon=HoursWindow(start="09:00", end="18:00")),
        stylist_hours={
            "stylist-1": WeeklyHours(mon=HoursWindow(start="10:00", end="16:00"))
        },
    )
    assert bookings._day_window(settings, "stylist-1", "mon") == ("10:00", "16:00")
    assert bookings._day_window(settings, "stylist-2", "mon") == (None, None)


class _Cursor:
    def __init__(self, items):
        self.items = items

    async def to_list(self, _limit=None):
        return self.items


class _Collection:
    def __init__(self, items):
        self.items = items

    def find(self, *_args, **_kwargs):
        return _Cursor(self.items)


@pytest.mark.asyncio
async def test_available_slots_exclude_overlapping_appointments(monkeypatch):
    from datetime import date, timedelta

    booking_date = date.today() + timedelta(days=1)
    day_key = bookings.WEEKDAYS[booking_date.weekday()]
    hours = WeeklyHours(**{day_key: HoursWindow(start="09:00", end="11:00")})
    settings = BookingSettings(
        enabled=True,
        salon_hours=hours,
        stylist_hours={"stylist-1": hours},
    )
    monkeypatch.setattr(
        bookings.db,
        "appointments",
        _Collection(
            [
                {
                    "stylist_id": "stylist-1",
                    "time": "09:30",
                    "service_duration_min": 30,
                    "service_id": "existing-service",
                }
            ]
        ),
        raising=False,
    )
    monkeypatch.setattr(bookings.db, "services", _Collection([]), raising=False)

    slots = await bookings._available_slots(
        booking_date,
        {"duration_min": 60},
        settings,
        [{"id": "stylist-1"}],
    )
    assert [slot.time for slot in slots] == ["10:00"]


def test_salon_branding_accepts_supported_logo_and_colors():
    png = base64.b64encode(_one_pixel_png()).decode("ascii")
    branding = SalonBrandingUpdate(
        salon_name="  Studio Rosa  ",
        logo_data=f"data:image/png;base64,{png}",
        primary_color="#aabbcc",
        accent_color="#123456",
    )
    assert branding.salon_name == "Studio Rosa"
    assert branding.primary_color == "#AABBCC"
    assert branding.accent_color == "#123456"


@pytest.mark.parametrize(
    "values",
    [
        {"primary_color": "red"},
        {"accent_color": "#123"},
        {"logo_data": "data:image/svg+xml;base64,PHN2Zy8+"},
        {"logo_data": "data:image/png;base64,PGh0bWw+"},
    ],
)
def test_salon_branding_rejects_unsafe_colors_and_logos(values):
    with pytest.raises(ValidationError):
        SalonBrandingUpdate(salon_name="Studio Rosa", **values)


def test_salon_branding_rejects_logo_larger_than_limit():
    too_large = _one_pixel_png() + b"x" * (2 * 1024 * 1024)
    encoded = base64.b64encode(too_large).decode("ascii")
    with pytest.raises(ValidationError):
        SalonBrandingUpdate(
            salon_name="Studio Rosa",
            logo_data=f"data:image/png;base64,{encoded}",
        )
