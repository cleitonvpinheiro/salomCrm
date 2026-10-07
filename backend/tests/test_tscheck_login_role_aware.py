"""Criterion: Login is required and role-aware."""
import os
import uuid

import httpx

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8001")
API_URL = f"{BACKEND_URL}/api"
ADMIN_CREDS = {"email": "admin@atelier.com", "password": "atelier123"}
STAFF_CREDS = {"email": "marina@atelier.com", "password": "atelier123"}


def test_admin_login_and_me_role(admin_client):
    r = admin_client.get("/auth/me")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["role"] == "admin"
    assert body["email"] == ADMIN_CREDS["email"]


def test_staff_login_and_me_role(staff_client):
    r = staff_client.get("/auth/me")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["role"] == "staff"
    assert body["email"] == STAFF_CREDS["email"]


def test_unauthenticated_request_is_rejected():
    with httpx.Client(base_url=API_URL, timeout=30.0) as c:
        r = c.get("/clients")
        assert r.status_code in (401, 403), r.text


def test_bad_credentials_rejected():
    with httpx.Client(base_url=API_URL, timeout=30.0) as c:
        r = c.post("/auth/login", json={"email": f"nope-{uuid.uuid4().hex[:6]}@x.com", "password": "wrong"})
        assert r.status_code in (401, 403), r.text


def test_staff_forbidden_from_creating_service(staff_client):
    """Staff has no Services nav/permission -> create must be rejected server-side."""
    payload = {
        "name": f"tscheck-login-staffsvc-{uuid.uuid4().hex[:6]}",
        "duration_min": 30,
        "price": 50.0,
        "description": "staff attempt",
        "active": True,
    }
    r = staff_client.post("/services", json=payload)
    assert r.status_code in (401, 403), r.text


def test_logout_then_session_invalid():
    with httpx.Client(base_url=API_URL, timeout=30.0) as c:
        r = c.post("/auth/login", json=ADMIN_CREDS)
        assert r.status_code == 200
        r2 = c.post("/auth/logout")
        assert r2.status_code == 200, r2.text
        r3 = c.get("/auth/me")
        assert r3.status_code in (401, 403), r3.text
