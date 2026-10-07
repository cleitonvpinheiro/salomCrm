"""Criterion: Admin can create, edit and remove services."""
import uuid


def test_admin_service_crud_lifecycle(admin_client):
    name = f"tscheck-service-{uuid.uuid4().hex[:8]}"
    create_payload = {
        "name": name,
        "duration_min": 45,
        "price": 199.0,
        "description": "A tscheck fixture service",
        "active": True,
    }
    r = admin_client.post("/services", json=create_payload)
    assert r.status_code == 201, r.text
    created = r.json()
    service_id = created["id"]
    assert created["name"] == name
    assert created["price"] == 199.0
    assert created["active"] is True

    # appears in list
    r_list = admin_client.get("/services")
    assert r_list.status_code == 200
    assert any(s["id"] == service_id for s in r_list.json())

    # edit
    update_payload = dict(create_payload)
    update_payload["price"] = 250.0
    update_payload["duration_min"] = 60
    r_update = admin_client.put(f"/services/{service_id}", json=update_payload)
    assert r_update.status_code == 200, r_update.text
    updated = r_update.json()
    assert updated["price"] == 250.0
    assert updated["duration_min"] == 60

    # remove
    r_del = admin_client.delete(f"/services/{service_id}")
    assert r_del.status_code == 200, r_del.text

    r_list_after = admin_client.get("/services")
    assert all(s["id"] != service_id for s in r_list_after.json())


def test_staff_cannot_create_service(staff_client):
    name = f"tscheck-service-staffdeny-{uuid.uuid4().hex[:8]}"
    r = staff_client.post("/services", json={
        "name": name, "duration_min": 30, "price": 50.0, "description": "x", "active": True,
    })
    assert r.status_code in (401, 403), r.text
