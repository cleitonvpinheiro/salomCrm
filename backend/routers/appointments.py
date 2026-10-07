"""Appointments — the day agenda. Completing one stamps the client's last visit."""

from fastapi import APIRouter, Depends, HTTPException

from lib.dates import normalize_doc_dt, today_iso
from lib.db import db
from models.salon import (
    AppointmentCreate,
    AppointmentRead,
    AppointmentUpdate,
    new_id,
    utcnow,
)
from routers.auth import require_admin, require_user

router = APIRouter(dependencies=[Depends(require_user)])


async def _resolve_maps():
    clients = {d["id"]: d for d in await db.clients.find({}, {"id": 1, "name": 1}).to_list(1000)}
    stylists = {d["id"]: d for d in await db.stylists.find({}, {"id": 1, "name": 1}).to_list(1000)}
    services = {
        d["id"]: d
        for d in await db.services.find(
            {}, {"id": 1, "name": 1, "price": 1, "duration_min": 1}
        ).to_list(1000)
    }
    return clients, stylists, services


def _read(doc: dict, clients: dict, stylists: dict, services: dict) -> AppointmentRead:
    normalize_doc_dt(doc)
    client = clients.get(doc.get("client_id"))
    stylist = stylists.get(doc.get("stylist_id") or "")
    service = services.get(doc.get("service_id"))
    return AppointmentRead(
        **doc,
        client_name=client["name"] if client else None,
        stylist_name=stylist["name"] if stylist else None,
        service_name=service["name"] if service else None,
        service_price=service["price"] if service else 0.0,
        service_duration_min=service["duration_min"] if service else 0,
    )


async def _load(appointment_id: str) -> dict:
    doc = await db.appointments.find_one({"id": appointment_id})
    if not doc:
        raise HTTPException(status_code=404, detail="appointment not found")
    return doc


@router.get("/appointments", response_model=list[AppointmentRead])
async def list_appointments(
    date: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    client_id: str | None = None,
    stylist_id: str | None = None,
    status: str | None = None,
):
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

    docs = await db.appointments.find(query).sort([("date", 1), ("time", 1)]).to_list(1000)
    clients, stylists, services = await _resolve_maps()
    return [_read(d, clients, stylists, services) for d in docs]


@router.post("/appointments", response_model=AppointmentRead, status_code=201)
async def create_appointment(input: AppointmentCreate, user: dict = Depends(require_user)):
    if not await db.clients.find_one({"id": input.client_id}):
        raise HTTPException(status_code=404, detail="client not found")
    if not await db.services.find_one({"id": input.service_id}):
        raise HTTPException(status_code=404, detail="service not found")
    if input.stylist_id and not await db.stylists.find_one({"id": input.stylist_id}):
        raise HTTPException(status_code=404, detail="stylist not found")

    doc = {
        "id": new_id(),
        **input.model_dump(),
        "status": "scheduled",
        "created_by": user["id"],
        "created_at": utcnow(),
    }
    await db.appointments.insert_one(doc)
    clients, stylists, services = await _resolve_maps()
    return _read(doc, clients, stylists, services)


@router.put("/appointments/{appointment_id}", response_model=AppointmentRead)
async def update_appointment(appointment_id: str, input: AppointmentUpdate):
    doc = await _load(appointment_id)
    update = input.model_dump(exclude_unset=True)
    if "client_id" in update and not await db.clients.find_one({"id": update["client_id"]}):
        raise HTTPException(status_code=404, detail="client not found")
    if "service_id" in update and not await db.services.find_one({"id": update["service_id"]}):
        raise HTTPException(status_code=404, detail="service not found")
    if "stylist_id" in update and update["stylist_id"] and not await db.stylists.find_one(
        {"id": update["stylist_id"]}
    ):
        raise HTTPException(status_code=404, detail="stylist not found")
    if update:
        await db.appointments.update_one({"id": appointment_id}, {"$set": update})
        doc.update(update)
    clients, stylists, services = await _resolve_maps()
    return _read(doc, clients, stylists, services)


@router.post("/appointments/{appointment_id}/complete", response_model=AppointmentRead)
async def complete_appointment(appointment_id: str):
    doc = await _load(appointment_id)
    if doc.get("status") != "completed":
        await db.appointments.update_one(
            {"id": appointment_id}, {"$set": {"status": "completed"}}
        )
        doc["status"] = "completed"

        service = await db.services.find_one({"id": doc["service_id"]}) or {}
        client = await db.clients.find_one({"id": doc["client_id"]})
        if client:
            # a visit can't be in the future — stamp the appointment day, or today
            today = today_iso()
            visit_date = doc["date"] if doc["date"] <= today else today
            await db.clients.update_one(
                {"id": client["id"]}, {"$set": {"last_visit": visit_date}}
            )
            await db.notes.insert_one(
                {
                    "id": new_id(),
                    "client_id": client["id"],
                    "kind": "visit",
                    "body": f"Appointment completed — {service.get('name', 'service')}.",
                    "created_at": utcnow(),
                }
            )
    clients, stylists, services = await _resolve_maps()
    return _read(doc, clients, stylists, services)


@router.post("/appointments/{appointment_id}/cancel", response_model=AppointmentRead)
async def cancel_appointment(appointment_id: str):
    doc = await _load(appointment_id)
    if doc.get("status") != "cancelled":
        await db.appointments.update_one(
            {"id": appointment_id}, {"$set": {"status": "cancelled"}}
        )
        doc["status"] = "cancelled"
    clients, stylists, services = await _resolve_maps()
    return _read(doc, clients, stylists, services)


@router.delete("/appointments/{appointment_id}", dependencies=[Depends(require_admin)])
async def delete_appointment(appointment_id: str):
    res = await db.appointments.delete_one({"id": appointment_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="appointment not found")
    return {"ok": True}
