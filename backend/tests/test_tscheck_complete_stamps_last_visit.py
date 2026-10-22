"""Criterion: Completing an appointment stamps the client's last visit."""
import uuid


def _make_client_and_appointment(admin_client, date, service_id, stylist_id):
    client_name = f"tscheck-complete-client-{uuid.uuid4().hex[:6]}"
    r_client = admin_client.post("/clients", json={
        "name": client_name,
        "email": f"{client_name}@example.com",
        "phone": "+1 555 333 4444",
    })
    assert r_client.status_code == 201, r_client.text
    client_id = r_client.json()["id"]

    r_appt = admin_client.post("/appointments", json={
        "client_id": client_id,
        "stylist_id": stylist_id,
        "service_id": service_id,
        "date": date,
        "time": "10:30",
        "notes": "tscheck complete fixture",
    })
    assert r_appt.status_code == 201, r_appt.text
    return client_id, r_appt.json()["id"]


def test_complete_appointment_stamps_last_visit_and_note(admin_client):
    today = admin_client.get("/stats").json()["today"]
    service = next(s for s in admin_client.get("/services").json() if s["active"])
    stylist = next(s for s in admin_client.get("/stylists").json() if s["active"])

    client_id, appt_id = _make_client_and_appointment(admin_client, today, service["id"], stylist["id"])

    r_complete = admin_client.post(f"/appointments/{appt_id}/complete")
    assert r_complete.status_code == 200, r_complete.text
    assert r_complete.json()["status"] == "completed"

    # Completion retries must not create duplicate visit notes.
    r_complete_again = admin_client.post(f"/appointments/{appt_id}/complete")
    assert r_complete_again.status_code == 200, r_complete_again.text

    r_client = admin_client.get(f"/clients/{client_id}")
    assert r_client.status_code == 200
    assert r_client.json()["last_visit"] == today

    r_notes = admin_client.get(f"/clients/{client_id}/notes")
    assert r_notes.status_code == 200
    notes_text = " ".join(n.get("body", "") for n in r_notes.json())
    assert service["name"] in notes_text
    assert sum("Appointment completed" in n["body"] for n in r_notes.json()) == 1

    # cleanup
    admin_client.delete(f"/appointments/{appt_id}")
    admin_client.delete(f"/clients/{client_id}")


def test_cancel_appointment_does_not_touch_last_visit(admin_client):
    today = admin_client.get("/stats").json()["today"]
    service = next(s for s in admin_client.get("/services").json() if s["active"])
    stylist = next(s for s in admin_client.get("/stylists").json() if s["active"])

    client_id, appt_id = _make_client_and_appointment(admin_client, today, service["id"], stylist["id"])
    before = admin_client.get(f"/clients/{client_id}").json()["last_visit"]

    r_cancel = admin_client.post(f"/appointments/{appt_id}/cancel")
    assert r_cancel.status_code == 200, r_cancel.text
    assert r_cancel.json()["status"] == "cancelled"

    r_complete_cancelled = admin_client.post(f"/appointments/{appt_id}/complete")
    assert r_complete_cancelled.status_code == 409, r_complete_cancelled.text

    after = admin_client.get(f"/clients/{client_id}").json()["last_visit"]
    assert after == before

    # cleanup
    admin_client.delete(f"/appointments/{appt_id}")
    admin_client.delete(f"/clients/{client_id}")
