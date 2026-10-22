"""Explicitly migrate legacy single-tenant records before deploying the new API."""

import asyncio
import argparse
import logging

from lib.db import client, db_name, ensure_default_tenant, ensure_indexes

logger = logging.getLogger(__name__)


async def main() -> None:
    logger.info("Migrating legacy MongoDB data in database %s", db_name)
    await ensure_indexes(migrate_legacy_indexes=True, strict=True)
    tenant_id = await ensure_default_tenant(migrate_legacy_data=True)
    logger.info("Tenant migration complete for tenant id %s", tenant_id)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--confirm-backup",
        action="store_true",
        help="confirm that a restorable database backup was verified",
    )
    args = parser.parse_args()
    if not args.confirm_backup:
        parser.error("create and verify a database backup, then pass --confirm-backup")
    logging.basicConfig(level=logging.INFO)
    try:
        asyncio.run(main())
    finally:
        client.close()
