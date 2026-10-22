"""Services catalogue — readable by the whole team, managed by admins."""

from fastapi import APIRouter, Depends, HTTPException

from lib.dates import normalize_doc_dt
from lib.db import db
from models.salon import Service, ServiceCreate, ServiceUpdate
from routers.auth import require_admin, require_user

router = APIRouter(dependencies=[Depends(require_user)])


@router.get("/services", response_model=list[Service])
async def list_services():
    docs = await db.services.find().sort("name", 1).to_list(1000)
    out = []
    for d in docs:
        normalize_doc_dt(d)
        out.append(Service(**d))
    return out


@router.post(
    "/services", response_model=Service, status_code=201, dependencies=[Depends(require_admin)]
)
async def create_service(input: ServiceCreate):
    obj = Service(**input.model_dump())
    await db.services.insert_one(obj.model_dump())
    return obj


@router.put(
    "/services/{service_id}", response_model=Service, dependencies=[Depends(require_admin)]
)
async def update_service(service_id: str, input: ServiceUpdate):
    doc = await db.services.find_one({"id": service_id})
    if not doc:
        raise HTTPException(status_code=404, detail="service not found")
    update = input.model_dump(exclude_unset=True)
    if update:
        await db.services.update_one({"id": service_id}, {"$set": update})
        doc.update(update)
    normalize_doc_dt(doc)
    return Service(**doc)


@router.delete("/services/{service_id}", dependencies=[Depends(require_admin)])
async def delete_service(service_id: str):
    res = await db.services.update_one({"id": service_id}, {"$set": {"active": False}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="service not found")
    return {"ok": True}
