"""Criterion: Booking an appointment from the agenda."""
import uuid


def test_admin_books_appointment_with_computed_fields(admin_client):
    # fixture client
    client_name = f"tscheck-booking-client-{uuid.uuid4().hex[:6]}"
    r_client = admin_client.post("/clients", json={
        "name": client_name,
        "email": f"{client_name}@example.com",
        "phone": "+1 555 222 3333",
    })
    assert r_client.status_code == 201, r_client.text
    client_id = r_client.json()["id"]

    # pick a seeded active service & stylist
    services = admin_client.get("/services").json()
    service = next(s for s in services if s["active"])
    stylists = admin_client.get("/stylists").json()
    stylist = next(s for s in stylists if s["active"])

    payload = {
        "client_id": client_id,
        "stylist_id": stylist["id"],
        "service_id": service["id"],
        "date": "2026-11-20",
        "time": "13:00",
        "notes": "tscheck booking fixture",
    }
    r = admin_client.post("/appointments", json=payload)
    assert r.status_code == 201, r.text
    created = r.json()
    appt_id = created["id"]
    assert created["status"] == "scheduled"
    assert created["service_name"] == service["name"]
    assert created["service_price"] == service["price"]
    assert created["service_duration_min"] == service["duration_min"]
    assert created["stylist_name"] == stylist["name"]
    assert created["client_name"] == client_name

    # appears when listing that date
    r_list = admin_client.get("/appointments", params={"date": "2026-11-20"})
    assert r_list.status_code == 200
    assert any(a["id"] == appt_id for a in r_list.json())

    # cleanup
    admin_client.delete(f"/appointments/{appt_id}")
    admin_client.delete(f"/clients/{client_id}")


def test_inactive_service_not_in_active_list(admin_client):
    services = admin_client.get("/services").json()
    active_names = [s["name"] for s in services if s["active"]]
    inactive = [s for s in services if not s["active"]]
    assert any(s["name"] == "Occasion Up-Do" for s in inactive), "seeded inactive service must stay inactive"
    assert "Occasion Up-Do" not in active_names

    client_name = f"tscheck-inactive-service-{uuid.uuid4().hex[:8]}"
    client = admin_client.post("/clients", json={"name": client_name})
    assert client.status_code == 201, client.text
    stylist = next(s for s in admin_client.get("/stylists").json() if s["active"])
    rejected = admin_client.post("/appointments", json={
        "client_id": client.json()["id"],
        "stylist_id": stylist["id"],
        "service_id": next(s["id"] for s in inactive if s["name"] == "Occasion Up-Do"),
        "date": "2099-04-23",
        "time": "13:00",
    })
    assert rejected.status_code == 400, rejected.text
    admin_client.delete(f"/clients/{client.json()['id']}")


def test_appointment_accepts_multiple_services_and_updates_totals(admin_client):
    client_name = f"tscheck-multi-service-{uuid.uuid4().hex[:8]}"
    client = admin_client.post("/clients", json={"name": client_name})
    assert client.status_code == 201, client.text
    client_id = client.json()["id"]

    active_services = sorted(
        (service for service in admin_client.get("/services").json() if service["active"]),
        key=lambda service: service["duration_min"],
    )
    selected = active_services[:2]
    assert len(selected) == 2, "at least two active services are required"
    stylist = next(s for s in admin_client.get("/stylists").json() if s["active"])
    payload = {
        "client_id": client_id,
        "stylist_id": stylist["id"],
        "service_ids": [service["id"] for service in selected],
        "date": "2099-06-17",
        "time": "10:00",
    }

    created = admin_client.post("/appointments", json=payload)
    assert created.status_code == 201, created.text
    appointment = created.json()
    appointment_id = appointment["id"]
    assert appointment["service_id"] == selected[0]["id"]
    assert appointment["service_ids"] == [service["id"] for service in selected]
    assert appointment["service_names"] == [service["name"] for service in selected]
    assert appointment["service_price"] == sum(service["price"] for service in selected)
    assert appointment["service_duration_min"] == sum(
        service["duration_min"] for service in selected
    )
    assert [item["service_id"] for item in appointment["service_items"]] == [
        service["id"] for service in selected
    ]

    overlap = admin_client.post(
        "/appointments",
        json={
            **payload,
            "client_id": client_id,
            "time": "10:01",
        },
    )
    assert overlap.status_code == 409, overlap.text

    updated = admin_client.put(
        f"/appointments/{appointment_id}",
        json={"service_ids": [selected[1]["id"]]},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["service_ids"] == [selected[1]["id"]]
    assert updated.json()["service_price"] == selected[1]["price"]
    assert updated.json()["service_duration_min"] == selected[1]["duration_min"]

    admin_client.delete(f"/appointments/{appointment_id}")
    admin_client.delete(f"/clients/{client_id}")


def test_appointment_rejects_duplicate_services(admin_client):
    client_name = f"tscheck-duplicate-service-{uuid.uuid4().hex[:8]}"
    client = admin_client.post("/clients", json={"name": client_name})
    assert client.status_code == 201, client.text
    service = next(s for s in admin_client.get("/services").json() if s["active"])

    response = admin_client.post(
        "/appointments",
        json={
            "client_id": client.json()["id"],
            "service_ids": [service["id"], service["id"]],
            "date": "2099-06-18",
            "time": "10:00",
        },
    )
    assert response.status_code == 422, response.text
    admin_client.delete(f"/clients/{client.json()['id']}")
