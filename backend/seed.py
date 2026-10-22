"""Idempotent seed: users, stylists, services, clients with notes, appointments.

Run: cd /app/backend && python seed.py
"""

import asyncio
import os
from datetime import datetime, timedelta, timezone

from lib.db import db, ensure_default_tenant, ensure_indexes, tenant_scope
from routers.auth import hash_password

AVATAR_ELENA = "https://images.unsplash.com/photo-1607503873903-c5e95f80d7b9?crop=entropy&cs=srgb&fm=jpg&q=85"
AVATAR_CAMILA = "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?crop=entropy&cs=srgb&fm=jpg&q=85"
AVATAR_MATEO = "https://images.unsplash.com/photo-1728516687003-58347d3412b3?crop=entropy&cs=srgb&fm=jpg&q=85"
AVATAR_CHLOE = "https://images.unsplash.com/photo-1506863530036-1efeddceb993?crop=entropy&cs=srgb&fm=jpg&q=85"

USERS = [
    {"id": "user-admin", "name": "Atelier Admin", "email": "admin@atelier.com", "role": "admin", "active": True},
    {"id": "user-marina", "name": "Marina Duarte", "email": "marina@atelier.com", "role": "staff", "active": True},
]
SEED_PASSWORD = "atelier123"

STYLISTS = [
    {"id": "stylist-elena", "name": "Elena Vance", "title": "Senior Master Stylist · Balayage",
     "color": "#8F4E34", "avatar_url": AVATAR_ELENA, "active": True},
    {"id": "stylist-camila", "name": "Camila Rossi", "title": "Creative Colorist · Toning",
     "color": "#B88358", "avatar_url": AVATAR_CAMILA, "active": True},
    {"id": "stylist-mateo", "name": "Mateo Silva", "title": "Texture Specialist · Precision Cuts",
     "color": "#2D6A4F", "avatar_url": AVATAR_MATEO, "active": True},
    {"id": "stylist-chloe", "name": "Chloe Bennet", "title": "Style Director · Occasion Styling",
     "color": "#1E3A8A", "avatar_url": AVATAR_CHLOE, "active": True},
]

SERVICES = [
    {"id": "service-balayage", "name": "Balayage & Gloss",
     "description": "Hand-painted highlights finished with a shine gloss.",
     "duration_min": 150, "price": 380.0, "active": True},
    {"id": "service-colour", "name": "Root Colour Touch-Up",
     "description": "Roots retouched, ammonia-free options available.",
     "duration_min": 90, "price": 180.0, "active": True},
    {"id": "service-cut", "name": "Signature Cut & Blow-Dry",
     "description": "Precision cut with a volumising blow-dry.",
     "duration_min": 60, "price": 140.0, "active": True},
    {"id": "service-curls", "name": "Curly Cut & Hydration",
     "description": "Dry curly cut with a deep hydration mask.",
     "duration_min": 75, "price": 160.0, "active": True},
    {"id": "service-treatment", "name": "Deep Repair Treatment",
     "description": "Bond-repair ritual for stressed hair.",
     "duration_min": 45, "price": 120.0, "active": True},
    {"id": "service-updo", "name": "Occasion Up-Do",
     "description": "Event styling with a lasting hold.",
     "duration_min": 60, "price": 150.0, "active": False},
]

# (key, name, email, phone, birthday, stylist_key, hair_type, days_since_visit, formula, tags, notes)
# notes: list of (kind, days_ago, body)
CLIENTS = [
    ("beatriz", "Beatriz Carvalho", "beatriz.carvalho@example.com", "+55 11 91234-0091",
     "1988-03-14", "elena", "Fine, colour-treated", 3,
     "Wella Illumina 7/81 + 6% at roots, toner 9/60 gloss",
     ["VIP", "sensitive scalp"],
     [("visit", 3, "Full balayage refresh + gloss. Booked back in 6 weeks."),
      ("formula", 3, "Wella Illumina 7/81 + 6% at roots, toner 9/60 gloss — processed 20 min."),
      ("general", 40, "Loves cappuccino with extra foam; prefers Saturday mornings.")]),
    ("juliana", "Juliana Mendes", "juliana.mendes@example.com", "+55 21 98888-2314",
     "1995-11-02", "camila", "Thick, wavy", 6,
     "Redken Shades EQ 8N + copper reflect",
     ["copper tones"],
     [("visit", 6, "Copper gloss toner and a soft ends trim."),
      ("formula", 6, "Shades EQ 8N + 07 copper reflect, processed 15 min."),
      ("general", 30, "Training for the marathon — likes appointments before 9 am.")]),
    ("rodrigo", "Rodrigo Santos", "rodrigo.santos@example.com", "+55 11 97777-8412",
     "1992-07-19", "mateo", "Coarse, tight curls", 10,
     "Devacurl dry cut, no silicones",
     ["curly cut", "vegan products"],
     [("visit", 10, "Dry curly cut + hydration mask."),
      ("general", 10, "Prefers football highlights on the screen during the appointment.")]),
    ("isabella", "Isabella Fontana", "isabella.fontana@example.com", "+39 340 552 1187",
     "1990-01-27", "elena", "Medium, highlighted", 14,
     "L'Oréal Majirel 8.31 roots, 9.13 mid-lengths",
     ["no ammonia"],
     [("visit", 14, "Root touch-up + face-framing lights."),
      ("formula", 14, "Majirel 8.31 on roots, 9.13 through mid-lengths."),
      ("allergy", 90, "Sensitive scalp — no ammonia bleach. Patch test before every colour visit.")]),
    ("clara", "Clara Dupont", "clara.dupont@example.com", "+33 6 12 88 45 90",
     "1987-09-05", "chloe", "Straight, dense", 18,
     "Sleek blowout, Kérastase Mythic Oil finish",
     ["VIP"],
     [("visit", 18, "Editorial blowout before the Paris trip."),
      ("general", 18, "Brings her spaniel Minou — keep treats at the front desk.")]),
    ("amara", "Amara Okafor", "amara.okafor@example.com", "+44 7700 900431",
     "1993-05-22", "mateo", "4C coils", 23,
     "Protective styling, deep hydration steam",
     ["protective styles"],
     [("visit", 23, "Trim + hydrating steam treatment."),
      ("general", 23, "Wants to try a silk press next season.")]),
    ("sofia", "Sofia Marchetti", "sofia.marchetti@example.com", "+39 333 987 2210",
     "1996-12-11", "camila", "Fine, dark blonde", 30,
     "Matrix SoColor 9G glaze, 10 vol",
     [],
     [("visit", 30, "Golden glaze + brow tint add-on."),
      ("formula", 30, "SoColor 9G glaze, 10 vol, 20 min under heat.")]),
    ("hannah", "Hannah Lee", "hannah.lee@example.com", "+1 (415) 555-0132",
     "1991-08-30", "elena", "Thick, black", 38,
     "Bleach-free latte balayage",
     ["gray blending"],
     [("visit", 38, "Latte balayage with a clear gloss."),
      ("general", 60, "Expecting in spring — keep products fragrance-free from March.")]),
    ("priya", "Priya Sharma", "priya.sharma@example.com", "+91 98450 22119",
     "1989-02-08", "chloe", "Thick, silky", 47,
     "Amla oil pre-wash, soft layers",
     ["oily scalp"],
     [("visit", 47, "Soft face-framing layers + oil scalp massage."),
      ("general", 47, "Monthly scalp massage helps with tension headaches — keep her on the cycle.")]),
    ("lucas", "Lucas Almeida", "lucas.almeida@example.com", "+55 11 95555-7431",
     "1994-04-17", "mateo", "Straight, thick", 58,
     "Skin fade 0.5 + beard sculpt",
     [],
     [("visit", 58, "Skin fade 0.5 with beard line-up."),
      ("general", 90, "Changed offices — works weekends now, Sunday slots suit him best.")]),
    ("nora", "Nora Haddad", "nora.haddad@example.com", "+961 3 445 112",
     "1986-10-09", "camila", "Wavy, shoulder-length", 72,
     "Olaplex No.1/2 stand-alone + copper ribbon 7Cr",
     ["VIP", "recall offer"],
     [("visit", 72, "Copper ribbons + Olaplex stand-alone treatment."),
      ("formula", 72, "Olaplex No.1/2 stand-alone, copper ribbon 7Cr on the face frame."),
      ("general", 72, "Asked about an autumn refresh — send the recall offer.")]),
    ("emma", "Emma Whitfield", "emma.whitfield@example.com", "+44 7700 900772",
     "1999-06-03", None, "Medium, natural", None,
     None,
     ["new client"],
     [("general", 5, "First consultation booked — wants a soft fringe trial. No colour history on file yet.")]),
]

# (key, client_key, stylist_key, service_key, day_offset, time, status, notes)
APPOINTMENTS = [
    ("appt-a1", "beatriz", "elena", "cut", 0, "09:00", "scheduled", "Wants to talk about autumn tones."),
    ("appt-a2", "rodrigo", "mateo", "curls", 0, "11:00", "scheduled", None),
    ("appt-a3", "juliana", "camila", "colour", 0, "14:30", "scheduled", None),
    ("appt-a4", "sofia", "camila", "balayage", 1, "10:00", "scheduled", None),
    ("appt-a5", "lucas", "mateo", "cut", 1, "16:00", "scheduled", "Prefers the last slot of the day."),
    ("appt-a6", "amara", "mateo", "treatment", 3, "09:30", "scheduled", None),
    ("appt-a7", "hannah", "elena", "colour", 5, "13:00", "scheduled", "Fragrance-free products only."),
    ("appt-a8", "beatriz", "elena", "balayage", -3, "10:00", "completed", None),
    ("appt-a9", "priya", "chloe", "cut", -1, "15:00", "cancelled", "Reschedule requested."),
]


def iso_offset(days: int) -> str:
    """Date `days` from today (negative = past), as YYYY-MM-DD."""
    return (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%d")


def ts_days_ago(days: int, hour: int = 10) -> datetime:
    dt = datetime.now(timezone.utc) - timedelta(days=days)
    return dt.replace(hour=hour, minute=0, second=0, microsecond=0)


async def main() -> None:
    if os.environ.get("APP_ENV", "development").strip().lower() == "production":
        raise RuntimeError("Demo data seeding is disabled in production")
    await ensure_indexes(migrate_legacy_indexes=True, strict=True)
    tenant_id = await ensure_default_tenant(migrate_legacy_data=True)
    with tenant_scope(tenant_id):
        await seed_tenant_data()


async def seed_tenant_data() -> None:
    # --- users (admin + staff, both with the demo password) ---
    if await db.users.count_documents({}) == 0:
        await db.users.insert_many(
            [
                {**u, "password_hash": hash_password(SEED_PASSWORD), "created_at": ts_days_ago(200)}
                for u in USERS
            ]
        )
        print(f"seeded {len(USERS)} users — admin@atelier.com / marina@atelier.com (password: {SEED_PASSWORD})")
    else:
        print("users already present, skipping")

    # --- stylists ---
    if await db.stylists.count_documents({}) == 0:
        await db.stylists.insert_many([{**s, "created_at": ts_days_ago(200)} for s in STYLISTS])
        print(f"seeded {len(STYLISTS)} stylists")
    else:
        print("stylists already present, skipping")

    # --- services ---
    if await db.services.count_documents({}) == 0:
        await db.services.insert_many([{**s, "created_at": ts_days_ago(150)} for s in SERVICES])
        print(f"seeded {len(SERVICES)} services")
    else:
        print("services already present, skipping")

    # --- clients + their notes ---
    if await db.clients.count_documents({}) == 0:
        stylist_ids = {s["id"].replace("stylist-", ""): s["id"] for s in STYLISTS}

        client_docs = []
        note_docs = []
        for (key, name, email, phone, birthday, stylist_key, hair_type,
             days_since, formula, tags, notes) in CLIENTS:
            client_id = f"client-{key}"
            client_docs.append({
                "id": client_id,
                "name": name,
                "email": email,
                "phone": phone,
                "birthday": birthday,
                "stylist_id": stylist_ids.get(stylist_key) if stylist_key else None,
                "hair_type": hair_type,
                "last_visit": iso_offset(-days_since) if days_since is not None else None,
                "formula": formula,
                "tags": tags,
                "created_at": ts_days_ago(180),
            })
            for i, (kind, days_ago, body) in enumerate(notes):
                note_docs.append({
                    "id": f"note-{key}-{i}",
                    "client_id": client_id,
                    "kind": kind,
                    "body": body,
                    "created_at": ts_days_ago(days_ago),
                })

        await db.clients.insert_many(client_docs)
        await db.notes.insert_many(note_docs)
        print(f"seeded {len(client_docs)} clients, {len(note_docs)} notes")
    else:
        print("clients already present, skipping")

    # --- appointments (+ visit notes for completed ones) ---
    if await db.appointments.count_documents({}) == 0:
        stylist_ids = {s["id"].replace("stylist-", ""): s["id"] for s in STYLISTS}
        service_ids = {s["id"].replace("service-", ""): s["id"] for s in SERVICES}
        service_names = {s["id"]: s["name"] for s in SERVICES}

        appt_docs = []
        for (key, client_key, stylist_key, service_key, offset, appt_time, status, appt_notes) in APPOINTMENTS:
            appt_docs.append({
                "id": key,
                "client_id": f"client-{client_key}",
                "stylist_id": stylist_ids[stylist_key],
                "service_id": service_ids[service_key],
                "date": iso_offset(offset),
                "time": appt_time,
                "notes": appt_notes,
                "status": status,
                "created_by": "user-admin",
                "created_at": ts_days_ago(2),
            })
        await db.appointments.insert_many(appt_docs)

        visit_notes = [
            {
                "id": f"note-appt-{key}",
                "client_id": f"client-{client_key}",
                "kind": "visit",
                "body": f"Appointment completed — {service_names[service_ids[service_key]]}.",
                "created_at": ts_days_ago(-offset, 12),
            }
            for (key, client_key, _stk, service_key, offset, _t, status, _n) in APPOINTMENTS
            if status == "completed"
        ]
        if visit_notes:
            await db.notes.insert_many(visit_notes)
        print(f"seeded {len(appt_docs)} appointments (+{len(visit_notes)} visit note)")
    else:
        print("appointments already present, skipping")


if __name__ == "__main__":
    asyncio.run(main())
