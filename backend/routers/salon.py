"""Salon CRM routes: stylist roster, client book, per-client notes, workspace stats."""

import re
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from lib.dates import normalize_doc_dt as _normalize_dt, today_iso
from routers.auth import require_admin, require_user
from lib.db import db
from models.salon import (
    NOTE_KINDS,
    ClientCreate,
    ClientRead,
    ClientUpdate,
    Note,
    NoteCreate,
    Stats,
    Stylist,
    StylistCreate,
    StylistUpdate,
    new_id,
    utcnow,
)
from models.pagination import Page

router = APIRouter(dependencies=[Depends(require_user)])

RECALL_DAYS = 56  # no visit logged in 8 weeks → due for a recall


# ---- shared helpers ----


async def _stylist_map() -> dict[str, dict]:
    docs = await db.stylists.find().to_list(1000)
    return {d["id"]: d for d in docs}


async def _note_counts() -> dict[str, int]:
    rows = await db.notes.aggregate(
        [{"$group": {"_id": "$client_id", "n": {"$sum": 1}}}]
    ).to_list(None)
    return {r["_id"]: r["n"] for r in rows}


async def _client_counts_by_stylist() -> dict[str | None, int]:
    rows = await db.clients.aggregate(
        [
            {"$match": {"active": {"$ne": False}}},
            {"$group": {"_id": "$stylist_id", "n": {"$sum": 1}}},
        ]
    ).to_list(1000)
    return {r["_id"]: r["n"] for r in rows}


def _days_since(iso_date: str | None) -> int | None:
    if not iso_date:
        return None
    try:
        visited = datetime.strptime(iso_date, "%Y-%m-%d").date()
    except ValueError:
        return None
    today = datetime.strptime(today_iso(), "%Y-%m-%d").date()
    return (today - visited).days


def _client_read(doc: dict, stylists: dict[str, dict], note_count: int) -> ClientRead:
    _normalize_dt(doc)
    stylist = stylists.get(doc.get("stylist_id") or "")
    return ClientRead(
        **doc,
        stylist_name=stylist["name"] if stylist else None,
        stylist_color=stylist["color"] if stylist else None,
        days_since_visit=_days_since(doc.get("last_visit")),
        note_count=note_count,
    )


async def _stylist_read(doc: dict) -> Stylist:
    _normalize_dt(doc)
    n = await db.clients.count_documents(
        {"stylist_id": doc["id"], "active": {"$ne": False}}
    )
    return Stylist(**{**doc, "client_count": n})


async def _validate_stylist(
    stylist_id: str | None, *, allow_inactive: bool = False
) -> None:
    if not stylist_id:
        return
    stylist = await db.stylists.find_one({"id": stylist_id})
    if not stylist:
        raise HTTPException(status_code=404, detail="stylist not found")
    if stylist.get("active", True) is False and not allow_inactive:
        raise HTTPException(status_code=400, detail="stylist is inactive")


# ---- stylists ----


@router.get("/stylists", response_model=list[Stylist])
async def list_stylists():
    counts = await _client_counts_by_stylist()
    docs = await db.stylists.find().sort("name", 1).to_list(1000)
    out = []
    for d in docs:
        _normalize_dt(d)
        out.append(Stylist(**{**d, "client_count": counts.get(d["id"], 0)}))
    return out


@router.post(
    "/stylists", response_model=Stylist, status_code=201, dependencies=[Depends(require_admin)]
)
async def create_stylist(input: StylistCreate):
    obj = Stylist(**input.model_dump())
    await db.stylists.insert_one(obj.model_dump(exclude={"client_count"}))
    return obj


@router.put(
    "/stylists/{stylist_id}", response_model=Stylist, dependencies=[Depends(require_admin)]
)
async def update_stylist(stylist_id: str, input: StylistUpdate):
    doc = await db.stylists.find_one({"id": stylist_id})
    if not doc:
        raise HTTPException(status_code=404, detail="stylist not found")
    update = input.model_dump(exclude_unset=True)
    if update:
        await db.stylists.update_one({"id": stylist_id}, {"$set": update})
        doc.update(update)
    return await _stylist_read(doc)


@router.delete("/stylists/{stylist_id}", dependencies=[Depends(require_admin)])
async def delete_stylist(stylist_id: str):
    stylist = await db.stylists.find_one({"id": stylist_id})
    if not stylist:
        raise HTTPException(status_code=404, detail="stylist not found")
    await db.stylists.update_one({"id": stylist_id}, {"$set": {"active": False}})
    # Preserve the stylist for appointment history; clients remain in the book, unassigned.
    await db.clients.update_many({"stylist_id": stylist_id}, {"$set": {"stylist_id": None}})
    return {"ok": True}


# ---- clients ----


@router.get("/clients", response_model=list[ClientRead] | Page[ClientRead])
async def list_clients(
    search: str | None = None,
    stylist_id: str | None = None,
    sort_by: str = "last_visit_asc",
    archived: bool = False,
    page: int | None = Query(default=None, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
) -> list[ClientRead] | Page[ClientRead]:
    query: dict = {}
    if stylist_id == "none":
        query["stylist_id"] = None
    elif stylist_id:
        query["stylist_id"] = stylist_id
    if search and search.strip():
        rx = {"$regex": re.escape(search.strip()), "$options": "i"}
        query["$or"] = [
            {"name": rx},
            {"phone": rx},
            {"email": rx},
            {"formula": rx},
            {"hair_type": rx},
            {"tags": rx},
        ]

    sorts = {
        "name": [("name", 1)],
        "last_visit_desc": [("last_visit", -1)],
        "last_visit_asc": [("last_visit", 1)],
    }
    sort = sorts.get(sort_by, sorts["last_visit_asc"])

    query["active"] = False if archived else {"$ne": False}
    cursor = db.clients.find(query).sort([*sort, ("id", 1)])
    if page is None:
        docs = await cursor.to_list(None)
    else:
        docs = await cursor.skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    stylists = await _stylist_map()
    counts = await _note_counts()
    items = [_client_read(d, stylists, counts.get(d["id"], 0)) for d in docs]
    if page is None:
        return items
    return Page(
        items=items,
        total=await db.clients.count_documents(query),
        page=page,
        page_size=page_size,
    )


@router.get("/clients/{client_id}", response_model=ClientRead)
async def get_client(client_id: str):
    doc = await db.clients.find_one({"id": client_id})
    if not doc:
        raise HTTPException(status_code=404, detail="client not found")
    stylists = await _stylist_map()
    n = await db.notes.count_documents({"client_id": client_id})
    return _client_read(doc, stylists, n)


@router.post("/clients", response_model=ClientRead, status_code=201)
async def create_client(input: ClientCreate):
    await _validate_stylist(input.stylist_id)
    doc = {"id": new_id(), **input.model_dump(), "active": True, "created_at": utcnow()}
    await db.clients.insert_one(doc)
    stylists = await _stylist_map()
    return _client_read(doc, stylists, 0)


@router.put("/clients/{client_id}", response_model=ClientRead)
async def update_client(client_id: str, input: ClientUpdate):
    doc = await db.clients.find_one({"id": client_id})
    if not doc:
        raise HTTPException(status_code=404, detail="client not found")
    update = input.model_dump(exclude_unset=True)
    if "stylist_id" in update:
        await _validate_stylist(
            update["stylist_id"],
            allow_inactive=update["stylist_id"] == doc.get("stylist_id"),
        )
    if update:
        await db.clients.update_one({"id": client_id}, {"$set": update})
        doc.update(update)
    stylists = await _stylist_map()
    n = await db.notes.count_documents({"client_id": client_id})
    return _client_read(doc, stylists, n)


@router.delete("/clients/{client_id}")
async def delete_client(client_id: str):
    res = await db.clients.update_one(
        {"id": client_id, "active": {"$ne": False}}, {"$set": {"active": False}}
    )
    if res.matched_count == 0 and not await db.clients.find_one({"id": client_id}):
        raise HTTPException(status_code=404, detail="client not found")
    return {"ok": True}


# ---- notes ----


@router.get(
    "/clients/{client_id}/notes", response_model=list[Note] | Page[Note]
)
async def list_notes(
    client_id: str,
    page: int | None = Query(default=None, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> list[Note] | Page[Note]:
    query = {"client_id": client_id}
    cursor = db.notes.find(query).sort([("created_at", -1), ("id", 1)])
    if page is None:
        docs = await cursor.to_list(None)
    else:
        docs = await cursor.skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    out = []
    for d in docs:
        _normalize_dt(d)
        out.append(Note(**d))
    if page is None:
        return out
    return Page(
        items=out,
        total=await db.notes.count_documents(query),
        page=page,
        page_size=page_size,
    )


@router.post("/clients/{client_id}/notes", response_model=Note, status_code=201)
async def create_note(client_id: str, input: NoteCreate):
    client = await db.clients.find_one({"id": client_id})
    if not client:
        raise HTTPException(status_code=404, detail="client not found")
    if client.get("active", True) is False:
        raise HTTPException(status_code=400, detail="client is archived")
    kind = input.kind if input.kind in NOTE_KINDS else "general"
    note = Note(client_id=client_id, kind=kind, body=input.body)
    await db.notes.insert_one(note.model_dump())
    if kind == "visit":
        visit_date = input.visit_date or today_iso()
        await db.clients.update_one({"id": client_id}, {"$set": {"last_visit": visit_date}})
    return note


# ---- stats ----


@router.get("/stats", response_model=Stats)
async def get_stats():
    today = today_iso()
    now = utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    cutoff = (datetime.strptime(today, "%Y-%m-%d").date() - timedelta(days=RECALL_DAYS)).isoformat()

    total_clients = await db.clients.count_documents({"active": {"$ne": False}})
    archived_clients = await db.clients.count_documents({"active": False})
    active_stylists = await db.stylists.count_documents({"active": True})
    visits_this_month = await db.notes.count_documents(
        {"kind": "visit", "created_at": {"$gte": month_start}}
    )
    recall_due = await db.clients.count_documents(
        {
            "active": {"$ne": False},
            "$or": [{"last_visit": None}, {"last_visit": {"$lte": cutoff}}],
        }
    )
    unassigned = await db.clients.count_documents(
        {"active": {"$ne": False}, "stylist_id": None}
    )

    return Stats(
        today=today,
        total_clients=total_clients,
        active_stylists=active_stylists,
        visits_this_month=visits_this_month,
        recall_due=recall_due,
        unassigned=unassigned,
        archived_clients=archived_clients,
    )
