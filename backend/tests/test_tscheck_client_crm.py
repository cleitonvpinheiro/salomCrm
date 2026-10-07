"""Criterion: Existing client CRM still works end to end (create/update/delete + search/filter)."""
import uuid


def test_client_crud_lifecycle(admin_client):
    name = f"tscheck-crm-client-{uuid.uuid4().hex[:8]}"
    phone = "+1 555 777 8899"
    r_create = admin_client.post("/clients", json={
        "name": name,
        "email": f"{name}@example.com",
        "phone": phone,
        "formula": "tscheck-formula-marker",
    })
    assert r_create.status_code == 201, r_create.text
    client_id = r_create.json()["id"]

    # search by name (server-side)
    r_search = admin_client.get("/clients", params={"search": name})
    assert r_search.status_code == 200
    assert any(c["id"] == client_id for c in r_search.json())

    # search by formula
    r_search_formula = admin_client.get("/clients", params={"search": "tscheck-formula-marker"})
    assert any(c["id"] == client_id for c in r_search_formula.json())

    # update
    r_update = admin_client.put(f"/clients/{client_id}", json={
        "name": name,
        "email": f"{name}@example.com",
        "phone": phone,
        "formula": "tscheck-formula-marker-updated",
    })
    assert r_update.status_code == 200, r_update.text
    assert r_update.json()["formula"] == "tscheck-formula-marker-updated"

    # add a note
    r_note = admin_client.post(f"/clients/{client_id}/notes", json={"body": "tscheck note fixture"})
    assert r_note.status_code == 201, r_note.text

    r_notes_list = admin_client.get(f"/clients/{client_id}/notes")
    assert any(n["body"] == "tscheck note fixture" for n in r_notes_list.json())

    # delete
    r_del = admin_client.delete(f"/clients/{client_id}")
    assert r_del.status_code == 200, r_del.text

    r_search_after = admin_client.get("/clients", params={"search": name})
    assert all(c["id"] != client_id for c in r_search_after.json())


def test_stylist_filter_includes_unassigned(admin_client):
    r = admin_client.get("/clients", params={"stylist_id": "unassigned"})
    assert r.status_code == 200, r.text
    for c in r.json():
        assert c["stylist_id"] in (None, "", "unassigned")
