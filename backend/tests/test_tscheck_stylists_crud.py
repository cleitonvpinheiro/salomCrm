"""Criterion: Admin can create, edit and remove stylists (professionals).

NOTE: POST /api/stylists currently raises a 500 (TypeError: Stylist() got multiple
values for keyword argument 'client_count') in routers/salon.py::create_stylist, yet the
document is still inserted before the crash -- corrupting db.stylists with a stored
client_count field that then also crashes GET /api/stylists for everyone. This test
asserts the expected lifecycle (documenting the bug via the failed creation) and always
cleans up the created document directly, so a single failing run does not brick the
shared /stylists endpoint for every other check/test that follows.
"""
import os
import uuid

import pymongo


def _cleanup_by_name(name):
    """Direct Mongo cleanup (bypassing the API) -- the create bug leaves GET
    /api/stylists itself broken for everyone until the corrupted doc is removed,
    so we cannot rely on the (broken) API to find/delete it."""
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

        # remove stylist
        r_del = admin_client.delete(f"/stylists/{stylist_id}")
        assert r_del.status_code == 200, r_del.text

        r_list_after = admin_client.get("/stylists")
        assert r_list_after.status_code == 200, r_list_after.text
        assert all(s["id"] != stylist_id for s in r_list_after.json())

        # the client should remain and become unassigned, never dropped
        r_client_after = admin_client.get(f"/clients/{client_id}")
        assert r_client_after.status_code == 200, r_client_after.text
        assert r_client_after.json()["stylist_id"] is None

        admin_client.delete(f"/clients/{client_id}")
    finally:
        # always scrub this fixture's row even on assertion failure, to keep
        # GET /stylists usable for subsequent tests/checks.
        _cleanup_by_name(name)


def test_staff_cannot_create_stylist(staff_client):
    name = f"tscheck-stylist-staffdeny-{uuid.uuid4().hex[:8]}"
    r = staff_client.post("/stylists", json={
        "name": name, "title": "x", "color": "#000000", "active": True,
    })
    assert r.status_code in (401, 403), r.text
