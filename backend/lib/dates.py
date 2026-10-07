"""Server-side date helpers. The pod clock is UTC — anchor "today" here, never in the browser."""

import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo


def today_iso(tz: str | None = None) -> str:
    """Today's date as YYYY-MM-DD in `tz` (default: APP_TZ env, else UTC)."""
    zone = tz or os.environ.get("APP_TZ", "UTC")
    return datetime.now(ZoneInfo(zone)).strftime("%Y-%m-%d")


def normalize_doc_dt(doc: dict, key: str = "created_at") -> None:
    """Motor hands naive datetimes back — re-anchor to UTC in place before serialising."""
    value = doc.get(key)
    if isinstance(value, datetime) and value.tzinfo is None:
        doc[key] = value.replace(tzinfo=timezone.utc)
