# Atelier — Hair Salon CRM (SPEC)

Open staff workspace, **no login** (per user request). Warm editorial light theme:
Playfair Display headings, DM Sans body, JetBrains Mono data labels; parchment
`#FAF7F2` background, espresso `#221C18` sidebar, terracotta `#8F4E34` primary.

## What it does
- **Clients page `/`** — KPI cards (total clients, active stylists, visits this month, recall due),
  stylist filter pills (All / per-stylist / Unassigned), instant debounced server-side search
  (name/phone/email/formula/hair_type/tags), sort (longest since visit / most recent / name A–Z),
  client table. Row click opens the detail drawer: contact info, hair profile + formula,
  quick stylist reassign (Select), "Log today" visit button, notes timeline with add-note
  (kinds: visit/formula/allergy/general), edit + delete (confirm dialog).
- **Client form modal** (create/edit) — name, phone, email, birthday (calendar picker),
  preferred stylist, hair type, last visit (calendar picker, no future dates), colour
  formula, tags (comma-separated).
- **Stylists page `/stylists`** — salon banner, roster cards (avatar, name, specialty,
  active/away, client count) with add/edit/remove. Removing a stylist unassigns their
  clients (clients are never deleted by it).

## Data model (Mongo; string uuid ids, never ObjectId)
- `stylists`: id, name, title, color, avatar_url, active, created_at
- `clients`: id, name, email, phone, birthday (YYYY-MM-DD|null), stylist_id (null = unassigned),
  hair_type, last_visit (YYYY-MM-DD|null), formula, tags[], created_at
- `notes`: id, client_id, kind (visit|formula|allergy|general), body, created_at.
  A `kind="visit"` note also stamps `client.last_visit` (visit_date or server-side today).

## API (all on api_router prefix `/api`, routes in backend/routers/salon.py)
- `GET/POST /stylists`, `PUT/DELETE /stylists/{id}` (delete unassigns clients)
- `GET /clients?search=&stylist_id=(uuid|"none")&sort_by=(last_visit_asc|last_visit_desc|name)`
- `POST /clients`, `GET/PUT/DELETE /clients/{id}` (delete removes their notes), 404 if missing
- `GET/POST /clients/{id}/notes` (POST kind=visit stamps last_visit)
- `GET /stats` — today (server-side, lib/dates), total_clients, active_stylists,
  visits_this_month (kind=visit notes created this month), recall_due (last_visit null or
  older than 56 days — RECALL_DAYS in routers/salon.py), unassigned

## Seed (backend/seed.py — idempotent, skips if stylists exist)
4 stylists (Elena Vance, Camila Rossi, Mateo Silva, Chloe Bennet, Unsplash avatars) and
12 clients with mixed recency (3–72 days since last visit, plus one never-visited client
with no stylist) and ~25 notes. Run: `cd /app/backend && python seed.py`.

## Auth
None — shared open workspace. No credentials exist or are needed.
