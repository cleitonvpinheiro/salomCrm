"""Pre-scaffolded pytest fixtures for the FastAPI backend.

Tests hit the live uvicorn process managed by supervisor (not an in-process ASGI app), so
the app under test is the same one the frontend and Playwright see. Do NOT re-create this
file — add app-specific fixtures below the marker at the bottom.
"""

import os
from pathlib import Path

import httpx
import pytest
import pytest_asyncio
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8001")
API_URL = f"{BACKEND_URL}/api"
TEST_HEADERS = {"Origin": os.environ.get("TEST_CLIENT_ORIGIN", "http://localhost:3000")}


def api_url(path: str = "") -> str:
    """Absolute URL for an /api route: api_url("/status") -> http://localhost:8001/api/status."""
    return f"{API_URL}{path}"


@pytest.fixture(scope="session")
def backend_url() -> str:
    return BACKEND_URL


@pytest.fixture
def client():
    """Sync httpx client rooted at /api — the default for endpoint tests.

    Example:
        def test_status(client):
            assert client.get("/status").status_code == 200
    """
    with httpx.Client(base_url=API_URL, timeout=30.0, headers=TEST_HEADERS) as c:
        yield c


@pytest_asyncio.fixture
async def aclient():
    """Async variant, for tests that also await motor/backend helpers directly."""
    async with httpx.AsyncClient(
        base_url=API_URL, timeout=30.0, headers=TEST_HEADERS
    ) as c:
        yield c


# --- app-specific fixtures below this line ---

ADMIN_CREDS = {"email": "admin@atelier.com", "password": "atelier123"}
STAFF_CREDS = {"email": "marina@atelier.com", "password": "atelier123"}
TENANT_SLUG = os.environ.get("DEFAULT_TENANT_SLUG", "atelier")


@pytest.fixture
def admin_client():
    with httpx.Client(base_url=API_URL, timeout=30.0, headers=TEST_HEADERS) as c:
        r = c.post("/auth/login", json={**ADMIN_CREDS, "tenant_slug": TENANT_SLUG})
        assert r.status_code == 200, r.text
        yield c


@pytest.fixture
def staff_client():
    with httpx.Client(base_url=API_URL, timeout=30.0, headers=TEST_HEADERS) as c:
        r = c.post("/auth/login", json={**STAFF_CREDS, "tenant_slug": TENANT_SLUG})
        assert r.status_code == 200, r.text
        yield c
