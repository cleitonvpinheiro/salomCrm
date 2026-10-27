"""Mongo-backed rate limits for authentication endpoints."""

import hashlib
import hmac
import ipaddress
import math
import os
import time
from datetime import datetime, timezone

from fastapi import HTTPException, Request
from pymongo.errors import DuplicateKeyError
from pymongo import ReturnDocument

from lib.db import raw_db

_DEVELOPMENT_SECRET = "development-only-rate-limit-secret"


def _client_ip(request: Request) -> str:
    peer = request.client.host if request.client else "unknown"
    trusted_proxies = [
        ipaddress.ip_network(value.strip(), strict=False)
        for value in os.environ.get("TRUSTED_PROXY_IPS", "").split(",")
        if value.strip()
    ]
    try:
        peer_ip = ipaddress.ip_address(peer)
    except ValueError:
        return peer

    if not any(peer_ip in network for network in trusted_proxies):
        return str(peer_ip)

    forwarded = request.headers.get("x-forwarded-for", "")
    chain = [part.strip() for part in forwarded.split(",") if part.strip()]
    for candidate in reversed([*chain, str(peer_ip)]):
        try:
            candidate_ip = ipaddress.ip_address(candidate)
        except ValueError:
            return str(peer_ip)
        if not any(candidate_ip in network for network in trusted_proxies):
            return str(candidate_ip)
    return str(peer_ip)


async def enforce_auth_rate_limit(
    request: Request, *, action: str, limit: int, window_seconds: int
) -> None:
    now = time.time()
    window = int(now // window_seconds)
    expires_at = datetime.fromtimestamp(
        (window + 1) * window_seconds, timezone.utc
    )
    secret = os.environ.get("RATE_LIMIT_SECRET", _DEVELOPMENT_SECRET).encode()
    identity = f"{action}:{_client_ip(request)}:{window}".encode()
    bucket_id = hmac.new(secret, identity, hashlib.sha256).hexdigest()

    try:
        result = await raw_db.auth_rate_limits.find_one_and_update(
            {"_id": bucket_id},
            {
                "$inc": {"count": 1},
                "$setOnInsert": {"expires_at": expires_at},
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
    except DuplicateKeyError:
        result = await raw_db.auth_rate_limits.find_one_and_update(
            {"_id": bucket_id},
            {"$inc": {"count": 1}},
            return_document=ReturnDocument.AFTER,
        )
        if result is None:
            raise

    if result["count"] > limit:
        retry_after = max(1, math.ceil(expires_at.timestamp() - now))
        raise HTTPException(
            status_code=429,
            detail="Too many authentication attempts. Try again later.",
            headers={"Retry-After": str(retry_after)},
        )
