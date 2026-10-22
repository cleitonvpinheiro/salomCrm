# Atelier — Hair Salon CRM (SPEC)

Warm editorial light theme: Playfair Display headings, DM Sans body, JetBrains Mono data
labels; parchment `#FAF7F2` background, espresso `#221C18` sidebar, terracotta `#8F4E34` primary.

## Auth & roles (added in v2 — supersedes the original "no login" choice)
- Shared-database multi-tenancy: every tenant-owned record and session carries `tenant_id`;
  request middleware derives the tenant from the signed-in session and applies it to Mongo
  reads, writes, counts, updates, deletes, and aggregates. Existing tenantless records are
  assigned to `DEFAULT_TENANT_SLUG` at startup.
- Tenant members sign in with tenant slug, e-mail, and password (login page `/login`).
  The httpOnly tenant cookie (`atelier_session`) lasts 30 days.
- Roles: `admin` (manages stylists, services, can delete appointments) and `staff`
  (clients, notes, agenda; read-only on stylists/services). Tenant admins manage member
  accounts and assign either role.
- Frontend: `RequireAuth` pathless layout route wraps the workspace; user via `useUser()`
  (context from `src/lib/userContext.ts`); session helpers in `src/lib/session.ts`
  (tenant changes clear cached workspace data).
- A separately bootstrapped platform owner (environment: `PLATFORM_OWNER_EMAIL` and
  `PLATFORM_OWNER_PASSWORD`) signs in through the platform-owner mode and creates tenants
  with their first administrator. Platform users/sessions are separate from tenant users.
- Credentials (also in test_credentials.md): admin@atelier.com / atelier123 (admin),
  marina@atelier.com / atelier123 (staff).

## Pages
- `/` **Clients** — KPI cards (total clients, active stylists, visits this month, recall due),
  stylist filter pills, debounced server-side search, sort, client table; detail drawer with
  contact, hair profile + formula, quick stylist reassign, "Log today" visit, notes timeline
  (kinds: visit/formula/allergy/general), edit/archive; archived clients can be restored.
- `/agenda` **Agenda** — week strip + day navigation (today anchored to server `stats.today`),
  paginated day list of appointment cards (time + computed end time, client, service, price, stylist,
  status badge), Complete / Cancel actions, Edit, Delete (admin only). New-appointment modal:
  client → service → professional (defaults to client's preferred stylist), date picker, time
  input, notes.
- Client, appointment, and note list APIs accept `page` / `page_size` and return
  `{items,total,page,page_size}`; omitting `page` retains the legacy array response.
- `/stylists` **Stylists** — roster cards with avatars; add/edit/remove visible to admins only
  (staff see read-only). Archiving a stylist unassigns their clients but preserves history.
- `/servicos` **Services** — admin-only page (staff redirected to `/agenda`): table of services
  with duration, price (BRL), active flag; add/edit/archive.
- `/team` — tenant-admin-only collaborator management (create users, assign admin/staff,
  enable/disable access).
- `/platform` — platform-owner-only tenant provisioning and first-admin creation.
- `/login` — split-screen tenant login with development-only demo credentials and a separate
  platform-owner sign-in mode.

## Data model (Mongo; string uuid ids except seeded fixed ids)
- `tenants`: id, slug (unique), name, active, created_at
- `platform_users` / `platform_sessions`: platform-owner credentials and sessions, separate
  from tenant data.
- Tenant-owned collections include `tenant_id`; `users` have tenant-scoped unique e-mail
  and store role, active, password_hash (pbkdf2_sha256), created_at.
- `sessions`: token (unique), tenant_id, user_id, created_at, expires_at
- `stylists`: id, name, title, color, avatar_url, active, created_at
- `services`: id, name, description, duration_min, price, active, created_at
- `clients`: id, name, email, phone, birthday, stylist_id (null = unassigned), hair_type,
  last_visit (YYYY-MM-DD|null), formula, tags[], active, created_at
- `notes`: id, client_id, kind, body, created_at; appointment_id is set for completion notes.
  kind="visit" stamps client.last_visit.
- `appointments`: id, client_id, stylist_id (nullable), service_id, date (YYYY-MM-DD),
  time (HH:MM), notes, status (scheduled|completed|cancelled), service price/duration
  snapshots, created_by, created_at

## API (all on api_router prefix `/api`)
- `POST /auth/login` (tenant_slug, email, password), `POST /auth/logout`, `GET /auth/me`
- `POST /platform/auth/login`, `POST /platform/auth/logout`, `GET /platform/auth/me`
- Platform owner: `GET/POST /platform/tenants` (create includes first tenant administrator)
- Tenant admin: `GET/POST /team/users`, `PATCH /team/users/{id}`
- Everything else requires a signed-in cookie (401 otherwise); stylist/service mutations and
  appointment delete require admin (403 for staff)
- `GET/POST/PUT/DELETE /stylists[/{id}]` (delete archives and unassigns clients)
- `GET /clients?search=&stylist_id=(uuid|"none")&sort_by=…&archived=`, `POST /clients`,
  `GET/PUT/DELETE /clients/{id}` (delete archives; `PUT active=true` restores)
- `GET/POST /clients/{id}/notes` (GET supports `page` and `page_size`)
- `GET /services`, `POST /services`, `PUT/DELETE /services/{id}` (delete archives)
- `GET /appointments?date=&from_date=&to_date=&client_id=&stylist_id=&status=&page=&page_size=`
  (sorted date,time)
- `POST /appointments` (validates active client/service/stylist and prevents stylist overlap),
  `PUT /appointments/{id}`,
  `POST /appointments/{id}/complete` (status→completed, stamps client.last_visit with the
  appointment day — or today if that's in the future — and writes one idempotent kind=visit note),
  `POST /appointments/{id}/cancel`, `DELETE /appointments/{id}` (admin)
- `GET /stats` — today, total_clients, active_stylists, visits_this_month (kind=visit notes
  this month), recall_due (last_visit null or older than 56 days), unassigned

## Seed (backend/seed.py — idempotent, per-collection guards)
2 users, 4 stylists (Unsplash avatars), 6 services (one inactive), 12 clients, 27+ notes,
9 appointments (3 today, 2 tomorrow, future +3/+5, completed −3 with matching visit note,
cancelled −1). Run: `cd /app/backend && python seed.py`.
