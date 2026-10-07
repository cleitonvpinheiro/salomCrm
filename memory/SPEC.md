# Atelier — Hair Salon CRM (SPEC)

Warm editorial light theme: Playfair Display headings, DM Sans body, JetBrains Mono data
labels; parchment `#FAF7F2` background, espresso `#221C18` sidebar, terracotta `#8F4E34` primary.

## Auth & roles (added in v2 — supersedes the original "no login" choice)
- Everyone signs in with their own account (login page `/login`). httpOnly cookie session
  (`atelier_session`, 30 days, `atelier_session` cookie set by `POST /api/auth/login`).
- Roles: `admin` (manages stylists, services, can delete appointments) and `staff`
  (clients, notes, agenda; read-only on stylists/services).
- Frontend: `RequireAuth` pathless layout route wraps the workspace; user via `useUser()`
  (context from `src/lib/userContext.ts`); session helpers in `src/lib/session.ts`
  (`login()` invalidates the cache, `logout()` clears it — route every sign-out through it).
- Credentials (also in test_credentials.md): admin@atelier.com / atelier123 (admin),
  marina@atelier.com / atelier123 (staff).

## Pages
- `/` **Clients** — KPI cards (total clients, active stylists, visits this month, recall due),
  stylist filter pills, debounced server-side search, sort, client table; detail drawer with
  contact, hair profile + formula, quick stylist reassign, "Log today" visit, notes timeline
  (kinds: visit/formula/allergy/general), edit/delete.
- `/agenda` **Agenda** — week strip + day navigation (today anchored to server `stats.today`),
  day list of appointment cards (time + computed end time, client, service, price, stylist,
  status badge), Complete / Cancel actions, Edit, Delete (admin only). New-appointment modal:
  client → service → professional (defaults to client's preferred stylist), date picker, time
  input, notes.
- `/stylists` **Stylists** — roster cards with avatars; add/edit/remove visible to admins only
  (staff see read-only). Removing a stylist unassigns their clients (never deletes them).
- `/servicos` **Services** — admin-only page (staff redirected to `/agenda`): table of services
  with duration, price (BRL), active flag; add/edit/remove.
- `/login` — split-screen login with demo-credentials hint.

## Data model (Mongo; string uuid ids except seeded fixed ids)
- `users`: id, name, email (unique), role, active, password_hash (pbkdf2_sha256), created_at
- `sessions`: token (unique), user_id, created_at, expires_at
- `stylists`: id, name, title, color, avatar_url, active, created_at
- `services`: id, name, description, duration_min, price, active, created_at
- `clients`: id, name, email, phone, birthday, stylist_id (null = unassigned), hair_type,
  last_visit (YYYY-MM-DD|null), formula, tags[], created_at
- `notes`: id, client_id, kind, body, created_at. kind="visit" stamps client.last_visit.
- `appointments`: id, client_id, stylist_id (nullable), service_id, date (YYYY-MM-DD),
  time (HH:MM), notes, status (scheduled|completed|cancelled), created_by, created_at

## API (all on api_router prefix `/api`)
- `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` — open
- Everything else requires a signed-in cookie (401 otherwise); stylist/service mutations and
  appointment delete require admin (403 for staff)
- `GET/POST/PUT/DELETE /stylists[/{id}]` (delete unassigns clients)
- `GET /clients?search=&stylist_id=(uuid|"none")&sort_by=…`, `POST /clients`,
  `GET/PUT/DELETE /clients/{id}` (delete removes their notes)
- `GET/POST /clients/{id}/notes`
- `GET /services`, `POST /services`, `PUT/DELETE /services/{id}`
- `GET /appointments?date=&from_date=&to_date=&client_id=&stylist_id=&status=` (sorted date,time)
- `POST /appointments` (validates client/service/stylist exist), `PUT /appointments/{id}`,
  `POST /appointments/{id}/complete` (status→completed, stamps client.last_visit with the
  appointment day — or today if that's in the future — and writes a kind=visit note),
  `POST /appointments/{id}/cancel`, `DELETE /appointments/{id}` (admin)
- `GET /stats` — today, total_clients, active_stylists, visits_this_month (kind=visit notes
  this month), recall_due (last_visit null or older than 56 days), unassigned

## Seed (backend/seed.py — idempotent, per-collection guards)
2 users, 4 stylists (Unsplash avatars), 6 services (one inactive), 12 clients, 27+ notes,
9 appointments (3 today, 2 tomorrow, future +3/+5, completed −3 with matching visit note,
cancelled −1). Run: `cd /app/backend && python seed.py`.
