from contextlib import asynccontextmanager
import logging
import os
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException
from dotenv import load_dotenv
from pymongo.errors import PyMongoError
from starlette.middleware.cors import CORSMiddleware


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
from lib.config import validate_runtime_config
from lib.csrf import CSRFMiddleware
from lib.db import client, ensure_default_tenant, ensure_indexes, raw_db
from lib.security_headers import SecurityHeadersMiddleware
from lib.tenancy import TenantContextMiddleware

# Salon CRM routes
from routers.salon import router as salon_router
from routers.auth import router as auth_router
from routers.services import router as services_router
from routers.appointments import router as appointments_router
from routers.bookings import router as bookings_router
from routers.tenants import ensure_platform_owner
from routers.tenants import router as tenants_router


# Startup runs before the yield, shutdown after it. Add your own setup/teardown here.
@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_runtime_config()
    production = os.environ.get("APP_ENV", "development").strip().lower() == "production"
    await ensure_indexes(strict=production)
    tenant_id = await ensure_default_tenant()
    await ensure_platform_owner()
    app.state.ready = True
    app.state.default_tenant_id = tenant_id
    yield
    app.state.ready = False
    client.close()


# Create the main app without a prefix
app = FastAPI(lifespan=lifespan)
app.state.ready = False


@app.get("/health/live")
async def live():
    return {"status": "ok"}


@app.get("/health/ready")
async def ready():
    if not app.state.ready:
        raise HTTPException(status_code=503, detail="service not ready")
    try:
        await client.admin.command("ping")
        tenant = await raw_db.tenants.find_one(
            {"id": app.state.default_tenant_id, "active": True},
            {"_id": 1},
        )
    except PyMongoError as exc:
        logger.warning("Readiness check failed: %s", exc.__class__.__name__)
        raise HTTPException(status_code=503, detail="service not ready") from exc
    if not tenant:
        raise HTTPException(status_code=503, detail="service not ready")
    return {"status": "ready"}

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")
api_router.include_router(salon_router)
api_router.include_router(auth_router)
api_router.include_router(services_router)
api_router.include_router(appointments_router)
api_router.include_router(bookings_router)
api_router.include_router(tenants_router)


# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Atelier Salon CRM API"}


# Include the router in the main app
app.include_router(api_router)

cors_origins = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]
if "*" in cors_origins:
    raise ValueError("CORS_ORIGINS must list explicit origins when credentials are enabled")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TenantContextMiddleware)
app.add_middleware(CSRFMiddleware, allowed_origins=cors_origins)
app.add_middleware(
    SecurityHeadersMiddleware,
    hsts_enabled=os.environ.get("APP_ENV", "development").strip().lower()
    == "production",
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
