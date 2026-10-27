"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from contextvars import ContextVar
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit
from uuid import uuid4

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

load_dotenv(Path(__file__).parent.parent / ".env")

mongo_url = os.environ.get("MONGO_URL") or os.environ.get("MONGODB_URI")
if not mongo_url:
    raise RuntimeError("Set MONGO_URL or MONGODB_URI in the backend environment")

mongo_uri = urlsplit(mongo_url)
db_name = os.environ.get("DB_NAME") or unquote(mongo_uri.path.lstrip("/"))
if not db_name:
    raise RuntimeError("Set DB_NAME or include a database name in the MongoDB URI")

mongo_username = os.environ.get("MONGODB_USERNAME")
mongo_password = os.environ.get("MONGODB_PASSWORD")
client: AsyncIOMotorClient
if not mongo_uri.username and (mongo_username or mongo_password):
    if not mongo_username or not mongo_password:
        raise RuntimeError(
            "Set both MONGODB_USERNAME and MONGODB_PASSWORD when credentials "
            "are not included in the MongoDB URI"
        )
    client = AsyncIOMotorClient(
        mongo_url, username=mongo_username, password=mongo_password
    )
else:
    client = AsyncIOMotorClient(mongo_url)
raw_db = client[db_name]

_current_tenant_id: ContextVar[str | None] = ContextVar(
    "current_tenant_id", default=None
)

TENANT_COLLECTIONS = frozenset(
    {
        "appointments",
        "appointment_locks",
        "clients",
        "notes",
        "services",
        "sessions",
        "stylists",
        "users",
    }
)


@contextmanager
def tenant_scope(tenant_id: str):
    token = _current_tenant_id.set(tenant_id)
    try:
        yield
    finally:
        _current_tenant_id.reset(token)


def current_tenant_id() -> str | None:
    return _current_tenant_id.get()


class _TenantCollection:
    def __init__(self, name: str):
        self._collection = raw_db[name]

    @staticmethod
    def _filter(query: dict | None = None) -> dict:
        tenant_id = _current_tenant_id.get()
        if not tenant_id:
            raise RuntimeError("Tenant data access requires an authenticated tenant")
        query = query or {}
        return {"$and": [query, {"tenant_id": tenant_id}]}

    @staticmethod
    def _document(document: dict) -> dict:
        tenant_id = _current_tenant_id.get()
        if not tenant_id:
            raise RuntimeError("Tenant data access requires an authenticated tenant")
        if document.get("tenant_id", tenant_id) != tenant_id:
            raise ValueError("Cannot create a document for another tenant")
        return {**document, "tenant_id": tenant_id}

    def find(self, query: dict | None = None, *args: Any, **kwargs: Any):
        return self._collection.find(self._filter(query), *args, **kwargs)

    async def find_one(self, query: dict | None = None, *args: Any, **kwargs: Any):
        return await self._collection.find_one(self._filter(query), *args, **kwargs)

    async def insert_one(self, document: dict, *args: Any, **kwargs: Any):
        return await self._collection.insert_one(
            self._document(document), *args, **kwargs
        )

    async def insert_many(self, documents: list[dict], *args: Any, **kwargs: Any):
        return await self._collection.insert_many(
            [self._document(document) for document in documents], *args, **kwargs
        )

    async def update_one(self, query: dict, update: dict, *args: Any, **kwargs: Any):
        update = self._tenant_update(update)
        return await self._collection.update_one(
            self._filter(query), update, *args, **kwargs
        )

    async def update_many(self, query: dict, update: dict, *args: Any, **kwargs: Any):
        update = self._tenant_update(update)
        return await self._collection.update_many(
            self._filter(query), update, *args, **kwargs
        )

    async def find_one_and_update(
        self, query: dict, update: dict, *args: Any, **kwargs: Any
    ):
        update = self._tenant_update(update)
        return await self._collection.find_one_and_update(
            self._filter(query), update, *args, **kwargs
        )

    async def delete_one(self, query: dict, *args: Any, **kwargs: Any):
        return await self._collection.delete_one(self._filter(query), *args, **kwargs)

    async def delete_many(self, query: dict, *args: Any, **kwargs: Any):
        return await self._collection.delete_many(self._filter(query), *args, **kwargs)

    async def count_documents(self, query: dict, *args: Any, **kwargs: Any):
        return await self._collection.count_documents(
            self._filter(query), *args, **kwargs
        )

    @staticmethod
    def _tenant_update(update: dict) -> dict:
        tenant_id = _current_tenant_id.get()
        if not tenant_id:
            raise RuntimeError("Tenant data access requires an authenticated tenant")
        if "tenant_id" in update.get("$set", {}):
            raise ValueError("Cannot change a document's tenant")
        update = dict(update)
        update["$setOnInsert"] = {
            **update.get("$setOnInsert", {}),
            "tenant_id": tenant_id,
        }
        return update

    def aggregate(self, pipeline: list[dict], *args: Any, **kwargs: Any):
        tenant_id = _current_tenant_id.get()
        if not tenant_id:
            raise RuntimeError("Tenant data access requires an authenticated tenant")
        return self._collection.aggregate(
            [{"$match": {"tenant_id": tenant_id}}, *pipeline], *args, **kwargs
        )


class _TenantDatabase:
    def __getattr__(self, name: str):
        if name in TENANT_COLLECTIONS:
            return _TenantCollection(name)
        return getattr(raw_db, name)

    def __getitem__(self, name: str):
        if name in TENANT_COLLECTIONS:
            return _TenantCollection(name)
        return raw_db[name]


db = _TenantDatabase()

logger = logging.getLogger(__name__)

# One entry per collection: every field a route filters, sorts, or dedupes on. Applied by ensure_indexes() at startup.
INDEXES: dict[str, list[IndexModel]] = {
    "tenants": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("slug", ASCENDING)], name="slug_unique", unique=True),
    ],
    "platform_users": [
        IndexModel([("email", ASCENDING)], name="email_unique", unique=True)
    ],
    "platform_sessions": [
        IndexModel([("token", ASCENDING)], name="token_unique", unique=True)
    ],
    "stylists": [IndexModel([("tenant_id", ASCENDING), ("id", ASCENDING)], name="id", unique=True)],
    "clients": [
        IndexModel([("tenant_id", ASCENDING), ("id", ASCENDING)], name="id", unique=True),
        IndexModel([("tenant_id", ASCENDING), ("stylist_id", ASCENDING)], name="stylist_id"),
        IndexModel([("tenant_id", ASCENDING), ("last_visit", ASCENDING)], name="last_visit"),
        IndexModel([("tenant_id", ASCENDING), ("name", ASCENDING)], name="name_asc"),
    ],
    "notes": [
        IndexModel([("tenant_id", ASCENDING), ("id", ASCENDING)], name="id", unique=True),
        IndexModel(
            [("tenant_id", ASCENDING), ("appointment_id", ASCENDING)],
            name="appointment_id_unique",
            unique=True,
            partialFilterExpression={"appointment_id": {"$exists": True}},
        ),
        IndexModel(
            [("tenant_id", ASCENDING), ("client_id", ASCENDING), ("created_at", DESCENDING)],
            name="client_created_desc",
        ),
    ],
    "users": [
        IndexModel([("tenant_id", ASCENDING), ("id", ASCENDING)], name="id", unique=True),
        IndexModel([("tenant_id", ASCENDING), ("email", ASCENDING)], name="tenant_email_unique", unique=True),
    ],
    "sessions": [
        IndexModel([("token", ASCENDING)], name="token", unique=True),
        IndexModel([("tenant_id", ASCENDING), ("user_id", ASCENDING)], name="user_id"),
        IndexModel([("expires_at", DESCENDING)], name="expires_at"),
    ],
    "services": [
        IndexModel([("tenant_id", ASCENDING), ("id", ASCENDING)], name="id", unique=True),
        IndexModel([("tenant_id", ASCENDING), ("name", ASCENDING)], name="name_asc"),
    ],
    "appointments": [
        IndexModel([("tenant_id", ASCENDING), ("id", ASCENDING)], name="id", unique=True),
        IndexModel([("tenant_id", ASCENDING), ("date", ASCENDING), ("time", ASCENDING)], name="date_time"),
        IndexModel([("tenant_id", ASCENDING), ("client_id", ASCENDING)], name="client_id"),
        IndexModel([("tenant_id", ASCENDING), ("stylist_id", ASCENDING)], name="stylist_id"),
    ],
    "appointment_locks": [
        IndexModel([("tenant_id", ASCENDING), ("_id", ASCENDING)], name="tenant_lock", unique=True),
    ],
    "platform_sessions": [
        IndexModel([("token", ASCENDING)], name="token_unique", unique=True),
        IndexModel([("user_id", ASCENDING)], name="user_id"),
        IndexModel([("expires_at", DESCENDING)], name="expires_at"),
    ],
    "password_reset_tokens": [
        IndexModel([("token_hash", ASCENDING)], name="token_hash_unique", unique=True),
        IndexModel([("expires_at", ASCENDING)], name="expires_at_ttl", expireAfterSeconds=0),
        IndexModel(
            [("account_type", ASCENDING), ("user_id", ASCENDING)],
            name="account_user",
        ),
    ],
    "auth_rate_limits": [
        IndexModel(
            [("expires_at", ASCENDING)],
            name="expires_at_ttl",
            expireAfterSeconds=0,
        )
    ],
}


async def ensure_indexes(
    *, migrate_legacy_indexes: bool = False, strict: bool = False
) -> None:
    for collection in TENANT_COLLECTIONS:
        existing = await raw_db[collection].index_information()
        for name, definition in existing.items():
            if name == "_id_":
                continue
            keys = definition.get("key", [])
            if collection == "sessions" and keys in (
                [("token", ASCENDING)],
                [("expires_at", DESCENDING)],
            ):
                continue
            if keys and keys[0][0] == "tenant_id":
                continue
            if not migrate_legacy_indexes:
                raise RuntimeError(
                    f"Legacy indexes found on {collection}; run "
                    "backend/migrate_tenants.py before starting the API"
                )
            await raw_db[collection].drop_index(name)

    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await raw_db[collection].create_indexes([model])
            except Exception as exc:  # ordinary indexes must not block boot
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)
                if strict or (
                    collection == "notes"
                    and model.document["name"] == "appointment_id_unique"
                ):
                    raise


async def ensure_default_tenant(*, migrate_legacy_data: bool = False) -> str:
    slug = os.environ.get("DEFAULT_TENANT_SLUG", db_name).strip().lower()
    if not slug:
        raise RuntimeError("DEFAULT_TENANT_SLUG cannot be empty")
    await raw_db.tenants.update_one(
        {"slug": slug},
        {
            "$setOnInsert": {
                "id": uuid4().hex,
                "name": os.environ.get(
                    "DEFAULT_TENANT_NAME", slug.replace("-", " ").title()
                ),
                "active": True,
                "created_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )
    tenant = await raw_db.tenants.find_one({"slug": slug, "active": True})
    if not tenant:
        raise RuntimeError(f"Default tenant {slug!r} does not exist or is disabled")

    for collection in TENANT_COLLECTIONS:
        legacy_count = await raw_db[collection].count_documents(
            {"tenant_id": {"$exists": False}}
        )
        if legacy_count and not migrate_legacy_data:
            raise RuntimeError(
                f"{collection} contains {legacy_count} records without tenant_id; "
                "back up the database and run backend/migrate_tenants.py"
            )
        result = await raw_db[collection].update_many(
            {"tenant_id": {"$exists": False}},
            {"$set": {"tenant_id": tenant["id"]}},
        )
        if result.modified_count:
            logger.info(
                "Assigned %s existing %s records to tenant %s",
                result.modified_count,
                collection,
                slug,
            )
    return tenant["id"]
