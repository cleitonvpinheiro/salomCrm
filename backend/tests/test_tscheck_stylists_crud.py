"""Criterion: Admin can create, edit and archive stylists (professionals)."""
import os
import uuid

import pymongo


def _cleanup_by_name(name):
    """Direct Mongo cleanup for the stylist created by this test."""
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "app")
    with pymongo.MongoClient(mongo_url) as m:
        m[db_name].stylists.delete_many({"name": name})


def test_admin_stylist_crud_lifecycle(admin_client):
    name = f"tscheck-stylist-{uuid.uuid4().hex[:8]}"
    create_payload = {
        "name": name,
        "title": "Junior Stylist",
        "color": "#123456",
        "active": True,
    }
    try:
        r = admin_client.post("/stylists", json=create_payload)
        assert r.status_code == 201, (
            f"expected 201 creating a stylist, got {r.status_code}: {r.text}"
        )
        created = r.json()
        stylist_id = created["id"]
        assert created["name"] == name
        assert created.get("client_count", 0) == 0

        # edit
        update_payload = dict(create_payload)
        update_payload["title"] = "Senior Stylist"
        r_update = admin_client.put(f"/stylists/{stylist_id}", json=update_payload)
        assert r_update.status_code == 200, r_update.text
        assert r_update.json()["title"] == "Senior Stylist"

        # create a client assigned to this stylist
        client_name = f"tscheck-stylist-client-{uuid.uuid4().hex[:6]}"
        r_client = admin_client.post("/clients", json={
            "name": client_name,
            "email": f"{client_name}@example.com",
            "phone": "+1 555 000 1111",
            "stylist_id": stylist_id,
        })
        assert r_client.status_code == 201, r_client.text
        client_id = r_client.json()["id"]
        assert r_client.json()["stylist_id"] == stylist_id

        # archive stylist
        r_del = admin_client.delete(f"/stylists/{stylist_id}")
        assert r_del.status_code == 200, r_del.text

        r_list_after = admin_client.get("/stylists")
        assert r_list_after.status_code == 200, r_list_after.text
        archived = next(s for s in r_list_after.json() if s["id"] == stylist_id)
        assert archived["active"] is False

        # the client should remain and become unassigned, never dropped
        r_client_after = admin_client.get(f"/clients/{client_id}")
        assert r_client_after.status_code == 200, r_client_after.text
        assert r_client_after.json()["stylist_id"] is None

        admin_client.delete(f"/clients/{client_id}")
    finally:
        # Always scrub this fixture's row even on assertion failure.
        _cleanup_by_name(name)


def test_staff_cannot_create_stylist(staff_client):
    name = f"tscheck-stylist-staffdeny-{uuid.uuid4().hex[:8]}"
    r = staff_client.post("/stylists", json={
        "name": name, "title": "x", "color": "#000000", "active": True,
    })
    assert r.status_code in (401, 403), r.text
