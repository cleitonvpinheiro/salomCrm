"""Salon booking settings and public self-service appointment booking."""

import os
import re
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request

from lib.auth_rate_limit import enforce_auth_rate_limit
from lib.dates import today_iso
from lib.db import current_tenant_id, db, raw_db, tenant_scope
from models.booking import (
    BookingService,
    BookingSettings,
    BookingSettingsUpdate,
    BookingStylist,
    HoursWindow,
    PublicAvailabilitySlot,
    PublicBookingConfirmation,
    PublicBookingInfo,
    PublicBookingRequest,
    SalonBranding,
    SalonBrandingUpdate,
)
from models.salon import ClientCreate, new_id, utcnow
from routers.appointments import _assert_no_conflict, _schedule_locks
from routers.auth import require_admin, require_user

router = APIRouter()
WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
DATE_LIMIT_DAYS = 30
SLOT_INTERVAL_MIN = 30


def _default_settings() -> BookingSettings:
    return BookingSettings()


async def _active_tenant(slug: str) -> dict:
    tenant = await raw_db.tenants.find_one({"slug": slug, "active": True})
    if not tenant:
        raise HTTPException(status_code=404, detail="Salon not found")
    return tenant


def _check_booking_date(value: str) -> date:
    try:
        booking_date = date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Date must use YYYY-MM-DD") from exc
    today = date.fromisoformat(today_iso())
    if booking_date < today or booking_date > today + timedelta(days=DATE_LIMIT_DAYS):
        raise HTTPException(
            status_code=400,
            detail=f"Bookings must be within the next {DATE_LIMIT_DAYS} days",
        )
    return booking_date


def _day_window(schedule: BookingSettings | None, stylist_id: str, day: str):
    if not schedule:
        return None, None
    salon_hours = getattr(schedule.salon_hours, day)
    stylist_week = schedule.stylist_hours.get(stylist_id)
    stylist_hours = getattr(stylist_week, day) if stylist_week else HoursWindow()
    if not salon_hours.start or not stylist_hours.start:
        return None, None
    start = max(salon_hours.start, stylist_hours.start)
    end = min(salon_hours.end, stylist_hours.end)
    return (start, end) if start < end else (None, None)


async def _available_slots(
    booking_date: date,
    service: dict,
    settings: BookingSettings,
    stylists: list[dict],
) -> list[PublicAvailabilitySlot]:
    day_key = WEEKDAYS[booking_date.weekday()]
    timezone = ZoneInfo(os.environ.get("APP_TZ", "UTC"))
    now = datetime.now(timezone)
    if booking_date == now.date():
        earliest = now.replace(tzinfo=None)
    else:
        earliest = datetime.combine(booking_date, time.min)

    stylist_ids = [stylist["id"] for stylist in stylists]
    appointments = await db.appointments.find(
        {
            "date": booking_date.isoformat(),
            "stylist_id": {"$in": stylist_ids},
            "status": {"$ne": "cancelled"},
        }
    ).to_list(None)
    services = {
        item["id"]: item["duration_min"]
        for item in await db.services.find({}, {"id": 1, "duration_min": 1}).to_list(1000)
    }

    slots: list[PublicAvailabilitySlot] = []
    for stylist in stylists:
        start_text, end_text = _day_window(settings, stylist["id"], day_key)
        if not start_text or not end_text:
            continue
        start = datetime.combine(
            booking_date, datetime.strptime(start_text, "%H:%M").time()
        )
        end = datetime.combine(
            booking_date, datetime.strptime(end_text, "%H:%M").time()
        )
        minute = start.hour * 60 + start.minute
        minute = ((minute + SLOT_INTERVAL_MIN - 1) // SLOT_INTERVAL_MIN) * SLOT_INTERVAL_MIN
        duration = service["duration_min"]
        while minute + duration <= end.hour * 60 + end.minute:
            candidate = datetime.combine(booking_date, time(minute // 60, minute % 60))
            if candidate >= earliest:
                candidate_end = candidate + timedelta(minutes=duration)
                conflict = False
                for appointment in appointments:
                    if appointment.get("stylist_id") != stylist["id"]:
                        continue
                    existing_start = datetime.strptime(appointment["time"], "%H:%M")
                    existing_start = datetime.combine(booking_date, existing_start.time())
                    existing_duration = appointment.get(
                        "service_duration_min",
                        services.get(appointment.get("service_id"), 0),
                    )
                    existing_end = existing_start + timedelta(minutes=existing_duration)
                    if candidate < existing_end and candidate_end > existing_start:
                        conflict = True
                        break
                if not conflict:
                    slots.append(
                        PublicAvailabilitySlot(
                            time=candidate.strftime("%H:%M"),
                            stylist_id=stylist["id"],
                        )
                    )
            minute += SLOT_INTERVAL_MIN
    return slots


@router.get("/booking/settings")
async def get_booking_settings(_: dict = Depends(require_admin)):
    tenant_id = current_tenant_id()
    tenant = await raw_db.tenants.find_one({"id": tenant_id, "active": True})
    if not tenant:
        raise HTTPException(status_code=404, detail="Salon not found")
    settings = BookingSettings.model_validate(
        tenant.get("booking_settings") or _default_settings().model_dump()
    )
    stylists = await db.stylists.find({"active": {"$ne": False}}).sort("name", 1).to_list(1000)
    return {
        **settings.model_dump(),
        "salon_name": tenant["name"],
        "slug": tenant["slug"],
        "stylists": [
            BookingStylist(
                id=stylist["id"],
                name=stylist["name"],
                title=stylist.get("title", ""),
                color=stylist.get("color", "#8F4E34"),
            ).model_dump()
            for stylist in stylists
        ],
    }


def _tenant_branding(tenant: dict) -> SalonBranding:
    branding = tenant.get("branding") or {}
    return SalonBranding(
        salon_name=tenant["name"],
        slug=tenant["slug"],
        logo_data=branding.get("logo_data"),
        primary_color=branding.get("primary_color", "#8F4E34"),
        accent_color=branding.get("accent_color", "#D97757"),
    )


@router.get("/branding", response_model=SalonBranding)
async def get_salon_branding(_: dict = Depends(require_user)):
    tenant_id = current_tenant_id()
    tenant = await raw_db.tenants.find_one({"id": tenant_id, "active": True})
    if not tenant:
        raise HTTPException(status_code=404, detail="Salon not found")
    return _tenant_branding(tenant)


@router.put("/branding", response_model=SalonBranding)
async def update_salon_branding(
    update: SalonBrandingUpdate, _: dict = Depends(require_admin)
):
    tenant_id = current_tenant_id()
    tenant = await raw_db.tenants.find_one({"id": tenant_id, "active": True})
    if not tenant:
        raise HTTPException(status_code=404, detail="Salon not found")
    result = await raw_db.tenants.update_one(
        {"id": tenant_id, "active": True},
        {
            "$set": {
                "name": update.salon_name,
                "branding": {
                    "logo_data": update.logo_data,
                    "primary_color": update.primary_color,
                    "accent_color": update.accent_color,
                },
            }
        },
    )
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Salon not found")
    tenant["name"] = update.salon_name
    tenant["branding"] = update.model_dump(exclude={"salon_name"})
    return _tenant_branding(tenant)


@router.put("/booking/settings")
async def update_booking_settings(
    update: BookingSettingsUpdate, _: dict = Depends(require_admin)
):
    tenant_id = current_tenant_id()
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Salon session required")
    active_stylist_ids = {
        stylist["id"]
        for stylist in await db.stylists.find(
            {"active": {"$ne": False}}, {"id": 1}
        ).to_list(1000)
    }
    unknown_stylists = set(update.stylist_hours) - active_stylist_ids
    if unknown_stylists:
        raise HTTPException(status_code=400, detail="Unknown or inactive professional")
    if update.enabled:
        has_hours = any(
            _day_window(update, stylist_id, day)[0]
            for stylist_id in active_stylist_ids
            for day in WEEKDAYS
        )
        if not has_hours:
            raise HTTPException(
                status_code=400,
                detail="Set overlapping salon and professional hours before enabling online booking",
            )
        if not await db.services.count_documents({"active": {"$ne": False}}):
            raise HTTPException(
                status_code=400,
                detail="Add an active service before enabling online booking",
            )
    result = await raw_db.tenants.update_one(
        {"id": tenant_id, "active": True},
        {"$set": {"booking_settings": update.model_dump()}},
    )
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Salon not found")
    return {"ok": True}


@router.get("/booking/public/{slug}", response_model=PublicBookingInfo)
async def public_booking_info(slug: str):
    tenant = await _active_tenant(slug)
    settings = BookingSettings.model_validate(
        tenant.get("booking_settings") or _default_settings().model_dump()
    )
    if not settings.enabled:
        raise HTTPException(status_code=404, detail="Online booking is unavailable")
    with tenant_scope(tenant["id"]):
        services = await db.services.find({"active": {"$ne": False}}).sort("name", 1).to_list(1000)
        stylists = await db.stylists.find({"active": {"$ne": False}}).sort("name", 1).to_list(1000)
    return PublicBookingInfo(
        salon_name=tenant["name"],
        slug=tenant["slug"],
        logo_data=(tenant.get("branding") or {}).get("logo_data"),
        primary_color=(tenant.get("branding") or {}).get("primary_color", "#8F4E34"),
        accent_color=(tenant.get("branding") or {}).get("accent_color", "#D97757"),
        services=[BookingService(**service) for service in services],
        stylists=[
            BookingStylist(
                id=stylist["id"],
                name=stylist["name"],
                title=stylist.get("title", ""),
                color=stylist.get("color", "#8F4E34"),
            )
            for stylist in stylists
        ],
    )


@router.get(
    "/booking/public/{slug}/availability",
    response_model=list[PublicAvailabilitySlot],
)
async def public_booking_availability(
    slug: str,
    date: str,
    service_id: str,
    stylist_id: str | None = None,
):
    booking_date = _check_booking_date(date)
    tenant = await _active_tenant(slug)
    settings = BookingSettings.model_validate(
        tenant.get("booking_settings") or _default_settings().model_dump()
    )
    if not settings.enabled:
        raise HTTPException(status_code=404, detail="Online booking is unavailable")
    with tenant_scope(tenant["id"]):
        service = await db.services.find_one({"id": service_id, "active": {"$ne": False}})
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")
        query = {"active": {"$ne": False}}
        if stylist_id:
            query["id"] = stylist_id
        stylists = await db.stylists.find(query).sort("name", 1).to_list(1000)
        return await _available_slots(booking_date, service, settings, stylists)


@router.post(
    "/booking/public/{slug}/appointments",
    response_model=PublicBookingConfirmation,
    status_code=201,
)
async def create_public_booking(
    slug: str, request: Request, booking: PublicBookingRequest
):
    await enforce_auth_rate_limit(
        request, action="public-booking", limit=10, window_seconds=60 * 60
    )
    booking_date = _check_booking_date(booking.date)
    tenant = await _active_tenant(slug)
    settings = BookingSettings.model_validate(
        tenant.get("booking_settings") or _default_settings().model_dump()
    )
    if not settings.enabled:
        raise HTTPException(status_code=404, detail="Online booking is unavailable")

    with tenant_scope(tenant["id"]):
        service = await db.services.find_one(
            {"id": booking.service_id, "active": {"$ne": False}}
        )
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")
        stylist_query = {"active": {"$ne": False}}
        if booking.stylist_id:
            stylist_query["id"] = booking.stylist_id
        stylists = await db.stylists.find(stylist_query).sort("id", 1).to_list(1000)
        if not stylists:
            raise HTTPException(status_code=409, detail="No professional is available")

        async with _schedule_locks(
            {(stylist["id"], booking.date) for stylist in stylists}
        ):
            slots = await _available_slots(booking_date, service, settings, stylists)
            available_stylist_ids = [
                slot.stylist_id for slot in slots if slot.time == booking.time
            ]
            if not available_stylist_ids:
                raise HTTPException(
                    status_code=409,
                    detail="That time is no longer available. Choose another time.",
                )
            stylist = next(
                item for item in stylists if item["id"] in available_stylist_ids
            )
            await _assert_no_conflict(
                booking.date,
                booking.time,
                stylist["id"],
                service["duration_min"],
            )

            phone = booking.phone.strip()
            normalized_phone = re.sub(r"\D", "", phone)
            phone_pattern = r"^\D*" + r"\D*".join(normalized_phone) + r"\D*$"
            client = await db.clients.find_one(
                {
                    "phone": {"$regex": phone_pattern},
                    "active": {"$ne": False},
                }
            )
            if not client:
                client = {
                    "id": new_id(),
                    **ClientCreate(name=booking.name, phone=normalized_phone).model_dump(),
                    "active": True,
                    "created_at": utcnow(),
                }
                await db.clients.insert_one(client)

            appointment = {
                "id": new_id(),
                "client_id": client["id"],
                "stylist_id": stylist["id"],
                "service_id": service["id"],
                "date": booking.date,
                "time": booking.time,
                "notes": "Agendado online",
                "service_price": service["price"],
                "service_duration_min": service["duration_min"],
                "status": "scheduled",
                "created_by": "online-booking",
                "created_at": utcnow(),
            }
            await db.appointments.insert_one(appointment)

    return PublicBookingConfirmation(
        salon_name=tenant["name"],
        service_name=service["name"],
        stylist_name=stylist["name"],
        date=booking.date,
        time=booking.time,
    )
