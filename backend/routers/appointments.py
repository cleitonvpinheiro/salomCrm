"""Appointments — the day agenda. Completing one stamps the client's last visit."""

import asyncio
import secrets
import time as monotonic_time
from contextlib import AsyncExitStack, asynccontextmanager
from datetime import datetime, time as time_type, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from lib.dates import normalize_doc_dt, today_iso
from lib.db import current_tenant_id, db
from models.pagination import Page
from models.salon import (
    AppointmentCreate,
    AppointmentRead,
    AppointmentServiceRead,
    AppointmentUpdate,
    new_id,
    utcnow,
)
from routers.auth import require_admin, require_user

router = APIRouter(dependencies=[Depends(require_user)])


async def _resolve_maps(appointments: list[dict]):
    client_ids = {a["client_id"] for a in appointments}
    stylist_ids = {a["stylist_id"] for a in appointments if a.get("stylist_id")}
    service_ids = {
        service_id
        for appointment in appointments
        for service_id in appointment.get("service_ids", [appointment["service_id"]])
    }
    clients = {
        d["id"]: d
        for d in await db.clients.find(
            {"id": {"$in": list(client_ids)}}, {"id": 1, "name": 1}
        ).to_list(None)
    }
    stylists = {
        d["id"]: d
        for d in await db.stylists.find(
            {"id": {"$in": list(stylist_ids)}}, {"id": 1, "name": 1}
        ).to_list(None)
    }
    services = {
        d["id"]: d
        for d in await db.services.find(
            {"id": {"$in": list(service_ids)}},
            {"id": 1, "name": 1, "price": 1, "duration_min": 1},
        ).to_list(None)
    }
    return clients, stylists, services


def _read(doc: dict, clients: dict, stylists: dict, services: dict) -> AppointmentRead:
    normalize_doc_dt(doc)
    client = clients.get(doc.get("client_id"))
    stylist = stylists.get(doc.get("stylist_id") or "")
    service_ids = doc.get("service_ids") or [doc["service_id"]]
    saved_items = {
        item["service_id"]: item for item in doc.get("service_items", [])
    }
    service_items = []
    for service_id in service_ids:
        saved = saved_items.get(service_id, {})
        service = services.get(service_id, {})
        service_items.append(
            AppointmentServiceRead(
                service_id=service_id,
                service_name=saved.get("service_name") or service.get("name"),
                service_price=saved.get(
                    "service_price",
                    doc.get("service_price", service.get("price", 0.0))
                    if len(service_ids) == 1
                    else service.get("price", 0.0),
                ),
                service_duration_min=saved.get(
                    "service_duration_min",
                    doc.get("service_duration_min", service.get("duration_min", 0))
                    if len(service_ids) == 1
                    else service.get("duration_min", 0),
                ),
            )
        )
    service_names = [
        item.service_name for item in service_items if item.service_name
    ]
    return AppointmentRead(
        **{
            **doc,
            "service_id": service_ids[0],
            "service_ids": service_ids,
            "service_names": service_names,
            "service_items": service_items,
            "client_name": client["name"] if client else None,
            "stylist_name": stylist["name"] if stylist else None,
            "service_name": ", ".join(service_names) or None,
            "service_price": doc.get(
                "service_price",
                sum(item.service_price for item in service_items),
            ),
            "service_duration_min": doc.get(
                "service_duration_min",
                sum(item.service_duration_min for item in service_items),
            ),
        }
    )


def _service_ids(appointment: dict) -> list[str]:
    return appointment.get("service_ids") or [appointment["service_id"]]


async def _load(appointment_id: str) -> dict:
    doc = await db.appointments.find_one({"id": appointment_id})
    if not doc:
        raise HTTPException(status_code=404, detail="appointment not found")
    return doc


@asynccontextmanager
async def _resource_lock(resource: str):
    key = f"appointment:{current_tenant_id()}:{resource}"
    token = secrets.token_hex(16)
    deadline = monotonic_time.monotonic() + 15
    while True:
        now = utcnow()
        try:
            lock = await db.appointment_locks.find_one_and_update(
                {
                    "_id": key,
                    "$or": [
                        {"expires_at": {"$lte": now}},
                        {"expires_at": {"$exists": False}},
                    ],
                },
                {
                    "$set": {
                        "token": token,
                        "expires_at": now + timedelta(minutes=2),
                    }
                },
                upsert=True,
                return_document=ReturnDocument.AFTER,
            )
        except DuplicateKeyError:
            lock = None

        if lock and lock.get("token") == token:
            break
        if monotonic_time.monotonic() >= deadline:
            raise HTTPException(status_code=503, detail="Could not reserve the appointment slot")
        await asyncio.sleep(0.05)

    try:
        yield
    finally:
        await db.appointment_locks.delete_one({"_id": key, "token": token})


@asynccontextmanager
async def _schedule_locks(resources: set[tuple[str, str]]):
    async with AsyncExitStack() as stack:
        for stylist_id, date in sorted(resources):
            await stack.enter_async_context(
                _resource_lock(f"schedule:{stylist_id}:{date}")
            )
        yield


async def _assert_no_conflict(
    date: str,
    time: str,
    stylist_id: str | None,
    duration_min: int,
    exclude_appointment_id: str | None = None,
) -> None:
    day = datetime.strptime(date, "%Y-%m-%d").date()
    candidate_start = datetime.combine(
        day, datetime.strptime(time, "%H:%M").time()
    )
    candidate_end = candidate_start + timedelta(minutes=duration_min)
    day_end = datetime.combine(day + timedelta(days=1), time_type.min)
    if candidate_end > day_end:
        raise HTTPException(
            status_code=400, detail="Appointment must end before the next day"
        )
    if not stylist_id:
        return

    query = {
        "date": {"$in": [date, (day - timedelta(days=1)).isoformat()]},
        "stylist_id": stylist_id,
        "status": {"$ne": "cancelled"},
    }
    if exclude_appointment_id:
        query["id"] = {"$ne": exclude_appointment_id}

    existing = await db.appointments.find(query).to_list(None)
    service_durations = {
        item["id"]: item["duration_min"]
        for item in await db.services.find({}, {"id": 1, "duration_min": 1}).to_list(1000)
    }
    for appointment in existing:
        other_day = datetime.strptime(appointment["date"], "%Y-%m-%d").date()
        other_start = datetime.combine(
            other_day, datetime.strptime(appointment["time"], "%H:%M").time()
        )
        other_duration = appointment.get("service_duration_min")
        if other_duration is None:
            other_duration = sum(
                service_durations.get(service_id, 0)
                for service_id in _service_ids(appointment)
            )
        other_end = other_start + timedelta(minutes=other_duration)
        if candidate_start < other_end and candidate_end > other_start:
            raise HTTPException(
                status_code=409,
                detail="The stylist already has an overlapping appointment",
            )


@router.get(
    "/appointments", response_model=list[AppointmentRead] | Page[AppointmentRead]
)
async def list_appointments(
    date: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    client_id: str | None = None,
    stylist_id: str | None = None,
    status: str | None = None,
    page: int | None = Query(default=None, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
) -> list[AppointmentRead] | Page[AppointmentRead]:
    query: dict = {}
    if date:
        query["date"] = date
    elif from_date or to_date:
        rng: dict = {}
        if from_date:
            rng["$gte"] = from_date
        if to_date:
            rng["$lte"] = to_date
        query["date"] = rng
    if client_id:
        query["client_id"] = client_id
    if stylist_id:
        query["stylist_id"] = stylist_id
    if status:
        query["status"] = status

    cursor = db.appointments.find(query).sort(
        [("date", 1), ("time", 1), ("id", 1)]
    )
    if page is None:
        docs = await cursor.to_list(None)
    else:
        docs = await cursor.skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    clients, stylists, services = await _resolve_maps(docs)
    items = [_read(d, clients, stylists, services) for d in docs]
    if page is None:
        return items
    return Page(
        items=items,
        total=await db.appointments.count_documents(query),
        page=page,
        page_size=page_size,
    )


@router.post("/appointments", response_model=AppointmentRead, status_code=201)
async def create_appointment(input: AppointmentCreate, user: dict = Depends(require_user)):
    client = await db.clients.find_one({"id": input.client_id})
    if not client:
        raise HTTPException(status_code=404, detail="client not found")
    if client.get("active", True) is False:
        raise HTTPException(status_code=400, detail="client is archived")
    selected_services = await db.services.find(
        {"id": {"$in": input.service_ids}}
    ).to_list(None)
    services_by_id = {service["id"]: service for service in selected_services}
    for service_id in input.service_ids:
        service = services_by_id.get(service_id)
        if not service:
            raise HTTPException(status_code=404, detail="service not found")
        if service.get("active", True) is False:
            raise HTTPException(status_code=400, detail="service is inactive")
    if input.stylist_id:
        stylist = await db.stylists.find_one({"id": input.stylist_id})
        if not stylist:
            raise HTTPException(status_code=404, detail="stylist not found")
        if stylist.get("active", True) is False:
            raise HTTPException(status_code=400, detail="stylist is inactive")

    service_items = [
        {
            "service_id": service_id,
            "service_name": services_by_id[service_id]["name"],
            "service_price": services_by_id[service_id]["price"],
            "service_duration_min": services_by_id[service_id]["duration_min"],
        }
        for service_id in input.service_ids
    ]
    duration_min = sum(item["service_duration_min"] for item in service_items)
    doc = {
        "id": new_id(),
        **input.model_dump(),
        "service_price": sum(item["service_price"] for item in service_items),
        "service_duration_min": duration_min,
        "service_items": service_items,
        "status": "scheduled",
        "created_by": user["id"],
        "created_at": utcnow(),
    }
    if input.stylist_id:
        async with _schedule_locks({(input.stylist_id, input.date)}):
            await _assert_no_conflict(
                input.date, input.time, input.stylist_id, duration_min
            )
            await db.appointments.insert_one(doc)
    else:
        await _assert_no_conflict(
            input.date, input.time, None, duration_min
        )
        await db.appointments.insert_one(doc)
    clients, stylists, services = await _resolve_maps([doc])
    return _read(doc, clients, stylists, services)


@router.put("/appointments/{appointment_id}", response_model=AppointmentRead)
async def update_appointment(appointment_id: str, input: AppointmentUpdate):
    initial = await _load(appointment_id)
    requested = input.model_dump(exclude_unset=True)
    requested_date = requested.get("date", initial["date"])
    requested_stylist_id = requested.get("stylist_id", initial.get("stylist_id"))
    resources = {
        (stylist_id, date)
        for stylist_id, date in (
            (initial.get("stylist_id"), initial["date"]),
            (requested_stylist_id, requested_date),
        )
        if stylist_id
    }
    async with _resource_lock(f"record:{appointment_id}"):
        async with _schedule_locks(resources):
            doc = await _load(appointment_id)
            if any(
                doc.get(field) != initial.get(field)
                for field in ("date", "time", "stylist_id", "service_id", "service_ids", "status")
            ):
                raise HTTPException(
                    status_code=409,
                    detail="appointment changed; refresh and try again",
                )
            return await _update_appointment_locked(appointment_id, input, doc)


async def _update_appointment_locked(
    appointment_id: str, input: AppointmentUpdate, doc: dict
) -> AppointmentRead:
    update = input.model_dump(exclude_unset=True)
    client_id = update.get("client_id", doc["client_id"])
    previous_service_ids = _service_ids(doc)
    service_ids = (
        update["service_ids"]
        if "service_ids" in update
        else [update["service_id"]]
        if "service_id" in update
        else previous_service_ids
    )
    service_ids = service_ids or previous_service_ids
    update["service_ids"] = service_ids
    update["service_id"] = service_ids[0]
    stylist_id = update.get("stylist_id", doc.get("stylist_id"))
    selected_services = await db.services.find(
        {"id": {"$in": service_ids}}
    ).to_list(None)
    services_by_id = {service["id"]: service for service in selected_services}
    previous_items = {
        item["service_id"]: item for item in doc.get("service_items", [])
    }
    if not previous_items and len(previous_service_ids) == 1:
        previous_items[previous_service_ids[0]] = {
            "service_id": previous_service_ids[0],
            "service_name": services_by_id.get(previous_service_ids[0], {}).get("name"),
            "service_price": doc.get("service_price", 0.0),
            "service_duration_min": doc.get("service_duration_min", 0),
        }

    service_items = []
    for service_id in service_ids:
        service = services_by_id.get(service_id)
        previous_item = previous_items.get(service_id)
        if not service and not previous_item:
            raise HTTPException(status_code=404, detail="service not found")
        if service and service.get("active", True) is False and service_id not in previous_service_ids:
            raise HTTPException(status_code=400, detail="service is inactive")
        if previous_item:
            service_items.append(previous_item)
        else:
            service_items.append(
                {
                    "service_id": service_id,
                    "service_name": service["name"],
                    "service_price": service["price"],
                    "service_duration_min": service["duration_min"],
                }
            )

    client = await db.clients.find_one({"id": client_id})
    if not client:
        raise HTTPException(status_code=404, detail="client not found")
    if client.get("active", True) is False and client_id != doc["client_id"]:
        raise HTTPException(status_code=400, detail="client is archived")
    if stylist_id:
        stylist = await db.stylists.find_one({"id": stylist_id})
        if not stylist:
            raise HTTPException(status_code=404, detail="stylist not found")
        if stylist.get("active", True) is False and stylist_id != doc.get("stylist_id"):
            raise HTTPException(status_code=400, detail="stylist is inactive")

    date = update.get("date", doc["date"])
    time = update.get("time", doc["time"])
    duration_min = sum(item["service_duration_min"] for item in service_items)
    schedule_changed = any(
        key in update and update[key] != doc.get(key)
        for key in ("date", "time", "stylist_id", "service_id", "service_ids")
    )
    if doc.get("status") != "cancelled" and schedule_changed:
        await _assert_no_conflict(
            date, time, stylist_id, duration_min, exclude_appointment_id=appointment_id
        )

    update["service_items"] = service_items
    update["service_price"] = sum(item["service_price"] for item in service_items)
    update["service_duration_min"] = duration_min
    if update:
        result = await db.appointments.update_one(
            {
                "id": appointment_id,
                "date": doc["date"],
                "time": doc["time"],
                "service_id": doc["service_id"],
                "status": doc["status"],
            },
            {"$set": update},
        )
        if result.matched_count == 0:
            raise HTTPException(
                status_code=409, detail="appointment changed; refresh and try again"
            )
        doc.update(update)
    clients, stylists, services = await _resolve_maps([doc])
    return _read(doc, clients, stylists, services)


@router.post("/appointments/{appointment_id}/complete", response_model=AppointmentRead)
async def complete_appointment(appointment_id: str):
    doc = await _load(appointment_id)
    if doc.get("status") == "cancelled":
        raise HTTPException(status_code=409, detail="cancelled appointments cannot be completed")
    transition = await db.appointments.update_one(
        {"id": appointment_id, "status": {"$ne": "cancelled"}},
        {"$set": {"status": "completed"}},
    )
    if transition.matched_count == 0:
        doc = await _load(appointment_id)
        if doc.get("status") == "cancelled":
            raise HTTPException(
                status_code=409, detail="cancelled appointments cannot be completed"
            )
    doc["status"] = "completed"

    client = await db.clients.find_one({"id": doc["client_id"]})
    if client:
        today = today_iso()
        visit_date = doc["date"] if doc["date"] <= today else today
        await db.clients.update_one(
            {"id": client["id"]}, {"$max": {"last_visit": visit_date}}
        )
        try:
            await db.notes.insert_one(
                {
                    "id": new_id(),
                    "appointment_id": appointment_id,
                    "client_id": client["id"],
                    "kind": "visit",
                    "body": "Appointment completed — "
                    + (
                        ", ".join(
                            item.get("service_name", "service")
                            for item in doc.get("service_items", [])
                        )
                        if doc.get("service_items")
                        else (await db.services.find_one({"id": doc["service_id"]}) or {}).get(
                            "name", "service"
                        )
                    )
                    + ".",
                    "created_at": utcnow(),
                }
            )
        except DuplicateKeyError:
            if not await db.notes.find_one({"appointment_id": appointment_id}):
                raise
    clients, stylists, services = await _resolve_maps([doc])
    return _read(doc, clients, stylists, services)


@router.post("/appointments/{appointment_id}/cancel", response_model=AppointmentRead)
async def cancel_appointment(appointment_id: str):
    doc = await _load(appointment_id)
    if doc.get("status") == "completed":
        raise HTTPException(status_code=409, detail="completed appointments cannot be cancelled")
    if doc.get("status") != "cancelled":
        transition = await db.appointments.update_one(
            {"id": appointment_id, "status": "scheduled"},
            {"$set": {"status": "cancelled"}},
        )
        if transition.matched_count == 0:
            doc = await _load(appointment_id)
            if doc.get("status") != "cancelled":
                raise HTTPException(
                    status_code=409,
                    detail="appointment status changed; refresh and try again",
                )
        doc["status"] = "cancelled"
    clients, stylists, services = await _resolve_maps([doc])
    return _read(doc, clients, stylists, services)


@router.delete("/appointments/{appointment_id}", dependencies=[Depends(require_admin)])
async def delete_appointment(appointment_id: str):
    res = await db.appointments.delete_one({"id": appointment_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="appointment not found")
    return {"ok": True}
