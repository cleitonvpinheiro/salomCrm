"""Criterion: paginated endpoints return stable pages and accurate totals."""
import uuid


def test_client_and_note_pages_include_metadata(admin_client):
    client_name = f"tscheck-pages-{uuid.uuid4().hex[:8]}"
    created = admin_client.post("/clients", json={"name": client_name})
    assert created.status_code == 201, created.text
    client_id = created.json()["id"]

    try:
        for index in range(3):
            response = admin_client.post(
                f"/clients/{client_id}/notes", json={"body": f"page note {index}"}
            )
            assert response.status_code == 201, response.text

        page_one = admin_client.get(
            "/clients",
            params={"search": client_name, "page": 1, "page_size": 1},
        )
        assert page_one.status_code == 200, page_one.text
        assert page_one.json()["total"] == 1
        assert page_one.json()["page"] == 1
        assert len(page_one.json()["items"]) == 1

        page_two = admin_client.get(
            f"/clients/{client_id}/notes",
            params={"page": 2, "page_size": 2},
        )
        assert page_two.status_code == 200, page_two.text
        assert page_two.json()["total"] == 3
        assert page_two.json()["page"] == 2
        assert len(page_two.json()["items"]) == 1

        legacy = admin_client.get("/clients", params={"search": client_name})
        assert isinstance(legacy.json(), list)
        assert len(legacy.json()) == 1
    finally:
        admin_client.delete(f"/clients/{client_id}")


def test_appointment_pages_return_stable_day_slices(admin_client):
    client_name = f"tscheck-appt-pages-{uuid.uuid4().hex[:8]}"
    created_client = admin_client.post("/clients", json={"name": client_name})
    assert created_client.status_code == 201, created_client.text
    client_id = created_client.json()["id"]
    service = next(s for s in admin_client.get("/services").json() if s["active"])
    date = "2099-05-17"
    appointment_ids = []

    try:
        for index, minute in enumerate(("09:00", "10:00", "11:00")):
            created = admin_client.post(
                "/appointments",
                json={
                    "client_id": client_id,
                    "service_id": service["id"],
                    "stylist_id": None,
                    "date": date,
                    "time": minute,
                },
            )
            assert created.status_code == 201, created.text
            appointment_ids.append(created.json()["id"])

        page = admin_client.get(
            "/appointments",
            params={
                "date": date,
                "client_id": client_id,
                "page": 2,
                "page_size": 2,
            },
        )
        assert page.status_code == 200, page.text
        assert page.json()["total"] == 3
        assert page.json()["page"] == 2
        assert len(page.json()["items"]) == 1
    finally:
        for appointment_id in appointment_ids:
            admin_client.delete(f"/appointments/{appointment_id}")
        admin_client.delete(f"/clients/{client_id}")
