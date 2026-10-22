"""Criterion: bookings for the same stylist cannot overlap."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
import uuid


def test_overlapping_bookings_are_rejected_and_cancelled_slots_are_reusable(admin_client):
    client_name = f"tscheck-conflict-{uuid.uuid4().hex[:8]}"
    created_client = admin_client.post("/clients", json={"name": client_name})
    assert created_client.status_code == 201, created_client.text
    client_id = created_client.json()["id"]

    service = next(s for s in admin_client.get("/services").json() if s["active"])
    stylist = next(s for s in admin_client.get("/stylists").json() if s["active"])
    date = "2099-04-22"
    start = datetime.strptime("10:00", "%H:%M")
    adjacent_time = (start + timedelta(minutes=service["duration_min"])).strftime("%H:%M")
    payload = {
        "client_id": client_id,
        "stylist_id": stylist["id"],
        "service_id": service["id"],
        "date": date,
        "time": "10:00",
    }
    first = admin_client.post("/appointments", json=payload)
    assert first.status_code == 201, first.text
    first_id = first.json()["id"]

    overlapping = admin_client.post(
        "/appointments", json={**payload, "time": "10:01"}
    )
    assert overlapping.status_code == 409, overlapping.text

    adjacent = admin_client.post(
        "/appointments", json={**payload, "time": adjacent_time}
    )
    assert adjacent.status_code == 201, adjacent.text
    adjacent_id = adjacent.json()["id"]

    cancelled = admin_client.post(f"/appointments/{first_id}/cancel")
    assert cancelled.status_code == 200, cancelled.text
    available_again = admin_client.post(
        "/appointments", json={**payload, "time": "10:00"}
    )
    assert available_again.status_code == 201, available_again.text

    admin_client.delete(f"/appointments/{first_id}")
    admin_client.delete(f"/appointments/{adjacent_id}")
    admin_client.delete(f"/appointments/{available_again.json()['id']}")
    admin_client.delete(f"/clients/{client_id}")


def test_concurrent_same_slot_bookings_only_allow_one(admin_client):
    client_name = f"tscheck-race-{uuid.uuid4().hex[:8]}"
    created_client = admin_client.post("/clients", json={"name": client_name})
    assert created_client.status_code == 201, created_client.text
    client_id = created_client.json()["id"]
    service = next(s for s in admin_client.get("/services").json() if s["active"])
    stylist = next(s for s in admin_client.get("/stylists").json() if s["active"])
    payload = {
        "client_id": client_id,
        "stylist_id": stylist["id"],
        "service_id": service["id"],
        "date": "2099-05-18",
        "time": "12:00",
    }
    created_ids = []

    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            responses = list(
                executor.map(
                    lambda _: admin_client.post("/appointments", json=payload),
                    range(2),
                )
            )

        created_ids = [
            response.json()["id"] for response in responses if response.status_code == 201
        ]
        assert sorted(response.status_code for response in responses) == [201, 409]
    finally:
        for appointment_id in created_ids:
            admin_client.delete(f"/appointments/{appointment_id}")
        admin_client.delete(f"/clients/{client_id}")
