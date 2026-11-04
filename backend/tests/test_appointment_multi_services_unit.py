from copy import deepcopy
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import routers.appointments as appointments
from models.salon import AppointmentCreate, AppointmentUpdate


class _Cursor:
    def __init__(self, items):
        self.items = items

    async def to_list(self, _limit=None):
        return deepcopy(self.items)


class _Collection:
    def __init__(self, items):
        self.items = items

    def find(self, query=None, *_args, **_kwargs):
        query = query or {}
        ids = query.get("id", {}).get("$in")
        items = self.items
        if ids is not None:
            items = [item for item in items if item.get("id") in ids]
        return _Cursor(items)

    async def find_one(self, query=None, *_args, **_kwargs):
        query = query or {}
        return next(
            (deepcopy(item) for item in self.items if all(item.get(k) == v for k, v in query.items())),
            None,
        )

    async def insert_one(self, item, *_args, **_kwargs):
        self.items.append(deepcopy(item))

    async def update_one(self, query, update, *_args, **_kwargs):
        for item in self.items:
            if all(item.get(key) == value for key, value in query.items()):
                item.update(deepcopy(update.get("$set", {})))
                return SimpleNamespace(matched_count=1)
        return SimpleNamespace(matched_count=0)


def _fake_db(services, appointments_list=None):
    return SimpleNamespace(
        clients=_Collection([{"id": "client-1", "name": "Alex", "active": True}]),
        stylists=_Collection([]),
        services=_Collection(services),
        appointments=_Collection(appointments_list or []),
    )


@pytest.mark.asyncio
async def test_create_and_update_appointment_with_multiple_services(monkeypatch):
    services = [
        {"id": "cut", "name": "Cut", "price": 50, "duration_min": 30, "active": True},
        {"id": "color", "name": "Color", "price": 120, "duration_min": 60, "active": True},
    ]
    fake_db = _fake_db(services)
    monkeypatch.setattr(appointments, "db", fake_db)
    payload = AppointmentCreate(
        client_id="client-1",
        service_ids=["cut", "color"],
        date="2099-06-17",
        time="10:00",
    )

    created = await appointments.create_appointment(payload, {"id": "user-1"})

    assert created.service_ids == ["cut", "color"]
    assert created.service_names == ["Cut", "Color"]
    assert created.service_name == "Cut, Color"
    assert created.service_price == 170
    assert created.service_duration_min == 90
    assert [item.service_id for item in created.service_items] == ["cut", "color"]

    saved_doc = fake_db.appointments.items[0]
    updated = await appointments._update_appointment_locked(
        created.id,
        AppointmentUpdate(service_ids=["color"]),
        saved_doc,
    )

    assert updated.service_ids == ["color"]
    assert updated.service_name == "Color"
    assert updated.service_price == 120
    assert updated.service_duration_min == 60


def test_legacy_and_multiple_service_payloads_normalize():
    legacy = AppointmentCreate(
        client_id="client-1",
        service_id="cut",
        date="2099-06-17",
        time="10:00",
    )
    updated = AppointmentUpdate(service_id="color")

    assert legacy.service_ids == ["cut"]
    assert updated.model_dump(exclude_unset=True)["service_ids"] == ["color"]


@pytest.mark.asyncio
async def test_multi_service_duration_is_used_for_conflict_checks(monkeypatch):
    fake_db = _fake_db(
        [],
        [
            {
                "id": "existing",
                "date": "2099-06-17",
                "time": "10:00",
                "stylist_id": "stylist-1",
                "status": "scheduled",
                "service_ids": ["cut", "color"],
                "service_id": "cut",
                "service_duration_min": 90,
            }
        ],
    )
    monkeypatch.setattr(appointments, "db", fake_db)

    with pytest.raises(HTTPException) as error:
        await appointments._assert_no_conflict(
            "2099-06-17", "10:30", "stylist-1", 30
        )

    assert error.value.status_code == 409
    await appointments._assert_no_conflict(
        "2099-06-17", "11:30", "stylist-1", 30
    )
