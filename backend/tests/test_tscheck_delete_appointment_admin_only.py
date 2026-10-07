"""Criterion: Only admins can delete appointments."""
import uuid


def test_staff_cannot_delete_appointment_admin_can(admin_client, staff_client):
    client_name = f"tscheck-delete-client-{uuid.uuid4().hex[:6]}"
    r_client = admin_client.post("/clients", json={
        "name": client_name,
        "email": f"{client_name}@example.com",
        "phone": "+1 555 444 5555",
    })
    assert r_client.status_code == 201, r_client.text
    client_id = r_client.json()["id"]

    service = next(s for s in admin_client.get("/services").json() if s["active"])
    stylist = admin_client.get("/stylists").json()[0]

    r_appt = admin_client.post("/appointments", json={
        "client_id": client_id,
        "stylist_id": stylist["id"],
        "service_id": service["id"],
        "date": "2026-11-21",
        "time": "16:00",
        "notes": "tscheck delete fixture",
    })
    assert r_appt.status_code == 201, r_appt.text
    appt_id = r_appt.json()["id"]

    # staff attempt to delete must be rejected
    r_staff_del = staff_client.delete(f"/appointments/{appt_id}")
    assert r_staff_del.status_code in (401, 403), r_staff_del.text

    # appointment still present
    r_list = admin_client.get("/appointments", params={"date": "2026-11-21"})
    assert any(a["id"] == appt_id for a in r_list.json())

    # admin can delete
    r_admin_del = admin_client.delete(f"/appointments/{appt_id}")
    assert r_admin_del.status_code == 200, r_admin_del.text

    r_list_after = admin_client.get("/appointments", params={"date": "2026-11-21"})
    assert all(a["id"] != appt_id for a in r_list_after.json())

    # cleanup
    admin_client.delete(f"/clients/{client_id}")
