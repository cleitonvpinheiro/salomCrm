"""Tenant provisioning, sign-in, team roles and data isolation."""

import os
import uuid

import httpx


def test_platform_provisions_tenants_and_tenant_data_is_isolated():
    api = os.environ.get("BACKEND_URL", "http://localhost:8001")
    platform_email = os.environ["PLATFORM_OWNER_EMAIL"]
    platform_password = os.environ["PLATFORM_OWNER_PASSWORD"]
    suffix = uuid.uuid4().hex[:10]
    slug_a = f"tenant-a-{suffix}"
    slug_b = f"tenant-b-{suffix}"
    shared_email = f"admin-{suffix}@example.com"
    tenant_ids = {}

    with httpx.Client(base_url=f"{api}/api", timeout=30) as owner:
        login = owner.post(
            "/platform/auth/login",
            json={"email": platform_email, "password": platform_password},
        )
        assert login.status_code == 200, login.text

        for slug, name in ((slug_a, "Tenant A"), (slug_b, "Tenant B")):
            created = owner.post(
                "/platform/tenants",
                json={
                    "name": name,
                    "slug": slug,
                    "admin_name": f"Admin {name}",
                    "admin_email": shared_email,
                    "admin_password": "tenant-pass-123",
                },
            )
            assert created.status_code == 201, created.text
            tenant_ids[slug] = created.json()["id"]

        deactivated = owner.patch(
            f"/platform/tenants/{tenant_ids[slug_b]}",
            json={"active": False},
        )
        assert deactivated.status_code == 200, deactivated.text
        assert deactivated.json()["active"] is False
        blocked_login = owner.post(
            "/auth/login",
            json={
                "tenant_slug": slug_b,
                "email": shared_email,
                "password": "tenant-pass-123",
            },
        )
        assert blocked_login.status_code == 401
        reactivated = owner.patch(
            f"/platform/tenants/{tenant_ids[slug_b]}",
            json={"active": True},
        )
        assert reactivated.status_code == 200, reactivated.text
        assert reactivated.json()["active"] is True

        default_workspaces = owner.get("/platform/tenants")
        assert default_workspaces.status_code == 200, default_workspaces.text
        default_workspace = next(
            workspace
            for workspace in default_workspaces.json()
            if workspace["is_default"]
        )
        cannot_deactivate_default = owner.patch(
            f"/platform/tenants/{default_workspace['id']}",
            json={"active": False},
        )
        assert cannot_deactivate_default.status_code == 409

    with (
        httpx.Client(base_url=f"{api}/api", timeout=30) as tenant_a,
        httpx.Client(base_url=f"{api}/api", timeout=30) as tenant_b,
    ):
        login_a = tenant_a.post(
            "/auth/login",
            json={
                "tenant_slug": slug_a,
                "email": shared_email,
                "password": "tenant-pass-123",
            },
        )
        login_b = tenant_b.post(
            "/auth/login",
            json={
                "tenant_slug": slug_b,
                "email": shared_email,
                "password": "tenant-pass-123",
            },
        )
        assert login_a.status_code == 200, login_a.text
        assert login_b.status_code == 200, login_b.text
        assert login_a.json()["tenant_slug"] == slug_a
        assert login_b.json()["tenant_slug"] == slug_b
        assert (
            tenant_a.patch(
                f"/platform/tenants/{tenant_ids[slug_b]}",
                json={"active": False},
            ).status_code
            == 401
        )

        created_client = tenant_a.post(
            "/clients", json={"name": f"private-{suffix}"}
        )
        assert created_client.status_code == 201, created_client.text
        client_id = created_client.json()["id"]

        assert tenant_a.get(f"/clients/{client_id}").status_code == 200
        assert tenant_b.get(f"/clients/{client_id}").status_code == 404
        assert tenant_b.get(
            "/clients", params={"search": f"private-{suffix}", "page": 1}
        ).json()["total"] == 0

        staff = tenant_a.post(
            "/team/users",
            json={
                "name": "Team Member",
                "email": f"staff-{suffix}@example.com",
                "role": "staff",
                "password": "staff-pass-123",
            },
        )
        assert staff.status_code == 201, staff.text
        staff_client = httpx.Client(base_url=f"{api}/api", timeout=30)
        try:
            staff_login = staff_client.post(
                "/auth/login",
                json={
                    "tenant_slug": slug_a,
                    "email": f"staff-{suffix}@example.com",
                    "password": "staff-pass-123",
                },
            )
            assert staff_login.status_code == 200, staff_login.text
            assert staff_client.get("/team/users").status_code == 403
        finally:
            staff_client.close()

        tenant_a.delete(f"/clients/{client_id}")
