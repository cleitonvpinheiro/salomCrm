# Atelier Salon CRM

CRM for a hair salon, with client profiles and visit notes, appointment scheduling,
stylist management, services, and role-based access.

**Documentação completa em português:** [docs/SISTEMA.md](docs/SISTEMA.md) — guia de
funcionalidades, perfis, arquitetura, instalação, configuração, dados, API, testes e
implantação.

## Stack

- Backend: FastAPI, Pydantic, MongoDB (Motor)
- Frontend: React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui
- Authentication: server-side sessions in MongoDB, delivered in an httpOnly cookie

## Features

- Client directory with search, stylist assignment, visit history, and notes
- Dashboard statistics, including clients due for recall
- Appointment agenda with create, edit, cancel, and completion workflows
- Appointment completion records a visit on the client's profile
- Admin-managed stylists and services; staff access is restricted by role

## Local Development

Prerequisites: Python 3.11+, Node.js, Yarn, and MongoDB.

1. Install backend dependencies: `cd backend && python -m pip install -r requirements.txt`.
2. Create `backend/.env` from `backend/.env.example` and set the MongoDB connection.
3. Seed demo data: `cd backend && python seed.py`.
4. Start the API: `cd backend && uvicorn server:app --host 0.0.0.0 --port 8001 --reload`.
5. In another terminal, install and start the frontend: `cd frontend && yarn install && yarn dev`.

The frontend runs at `http://localhost:3000`; the API is available at
`http://localhost:8001/api`. Vite proxies `/api` requests to the backend.
Set `API_PROXY_TARGET` to override the Vite proxy target, and optionally set
`VITE_DEFAULT_TENANT_SLUG` to prefill the local tenant field on the sign-in screen.
The public landing page's sales buttons open WhatsApp when `VITE_WHATSAPP_NUMBER`
is set to the commercial number in international format (digits only, including
country and area codes); without it, the page displays a temporary contact notice.
Seeded accounts are for local development only; change or remove them before
deploying an environment with real data.
The login page shows demo credentials only in Vite's development build.

## Configuration

Backend settings are read from `backend/.env`:

- `MONGO_URL` or `MONGODB_URI`: MongoDB connection string; credentials may be embedded in the URI
- `MONGODB_USERNAME` and `MONGODB_PASSWORD`: optional credentials when they are not embedded in the URI
- `DB_NAME`: database name
- `DEFAULT_TENANT_SLUG`: tenant slug for legacy data and local development
- `PLATFORM_OWNER_EMAIL` and `PLATFORM_OWNER_PASSWORD`: bootstrap credentials for the platform owner
- `CORS_ORIGINS`: comma-separated allowed origins
- `COOKIE_SECURE`: set to `true` when serving over HTTPS; leave `false` for local HTTP development
- `PUBLIC_APP_URL`, `SMTP_HOST`, `SMTP_PORT`, and `SMTP_FROM_EMAIL`: password recovery link and mail delivery settings
- `SMTP_USERNAME` and `SMTP_PASSWORD`: optional SMTP authentication credentials; configure both or neither

`CORS_ORIGINS` must contain explicit origins; wildcard origins are rejected because the
API uses credentialed requests. Set `COOKIE_SECURE=true` in production. Do not commit
`.env` files or production credentials.

Password recovery is available for both salon accounts and the platform owner. Reset
links are single-use, expire after 30 minutes, and invalidate existing sessions. Configure
an SMTP provider and the public HTTPS origin before enabling this flow in production;
without mail settings, the API explicitly reports that recovery e-mail is unavailable.

The application uses a shared MongoDB database with tenant-scoped records. Every
tenant member signs in with the tenant slug, e-mail, and password. Configure the
platform owner credentials to enable the platform login; that owner can create tenants
and their first administrator. Tenant administrators can then add team members and set
their administrator or staff role. Existing records without a tenant are assigned once
to `DEFAULT_TENANT_SLUG` during startup.

The platform owner dashboard lists and searches salons, shows workspace status, and
allows non-default workspaces to be activated or deactivated without deleting their data.
Opening a salon takes the operator to that salon's sign-in with its slug prefilled; the
platform-owner session does not impersonate salon users or grant access to their records.
The configured default workspace cannot be deactivated because the API requires it during
startup.

Set `PLATFORM_OWNER_EMAIL` and `PLATFORM_OWNER_PASSWORD` in the private environment
before starting the API. The bootstrap account is stored separately from tenant users;
the configured name and e-mail are synchronized on startup, while the initial password
is set only when the account is first created so e-mail password recovery remains effective.
Never commit the real values.

Deleting a client, stylist, or service archives it rather than removing its database
record. Archived clients and services cannot be used for new bookings; archived stylists
are removed from client assignments and cannot receive new bookings. Existing appointment
history and client notes are retained.

The agenda rejects overlapping appointments for the same stylist (cancelled appointments
do not reserve time). A booking retains the service name reference and price/duration
snapshot it was created with. Completing an appointment is safe to retry: it creates at
most one visit note and does not move a client's last-visit date backward.

Client, appointment, and note list endpoints support `page` and `page_size` query
parameters (maximum page size: 100); paged responses include `items`, `total`, `page`,
and `page_size`. Omitting `page` preserves the legacy array response. The workspace
uses paged responses and provides next/previous or load-more controls.

Appointment creation and rescheduling serialize access to each stylist's day using
short-lived MongoDB locks, so simultaneous requests cannot both reserve overlapping
time. Appointments must end by midnight.

## Checks

```bash
cd backend && python -m pytest
cd frontend && yarn typecheck
cd frontend && yarn lint
cd frontend && yarn build
```

The Playwright workspace is under `tests/`; end-to-end specs cover client archive/restore
and booking/completion. The development-server commands above are for local development,
not production deployment.

## Production preparation

- Use `APP_ENV=production`, `COOKIE_SECURE=true`, a long random
  `PLATFORM_OWNER_PASSWORD`, the actual HTTPS frontend origins in `CORS_ORIGINS`, a
  remote TLS-enabled MongoDB URI, and an explicit `DEFAULT_TENANT_SLUG`. Production
  startup fails if these checks do not pass.
- Configure `PUBLIC_APP_URL`, `SMTP_HOST`, `SMTP_PORT`, and `SMTP_FROM_EMAIL`; add
  `SMTP_USERNAME`/`SMTP_PASSWORD` when required by the mail provider. Production startup
  fails if the HTTPS recovery origin or required mail settings are missing.
- Before deploying this multi-tenant version over a legacy database, take and verify a
  backup, then run `cd backend && python migrate_tenants.py --confirm-backup` once as a controlled
  migration. The migration removes/replaces legacy indexes and assigns tenantless
  records to the configured default tenant. Do not run it concurrently with API
  instances or against production before reviewing the backup and target tenant.
- Run the API without `--reload` behind an HTTPS reverse proxy. Prefer serving the
  compiled frontend and API from the same site so the httpOnly, Secure, SameSite=Lax
  session cookies work without cross-site cookie exceptions. Configure the reverse
  proxy to preserve the browser's HTTPS scheme.
- Configure platform-owner secrets through the host's secret manager; never put
  production values in source control, frontend `VITE_*` variables, or chat.
- Set the public frontend variable `VITE_WHATSAPP_NUMBER` to the commercial WhatsApp
  number (digits only, with country and area codes) to activate sales contact links.
- Configure load balancers to use `GET /health/live` for process liveness and
  `GET /health/ready` for API/database readiness. The frontend production build is
  `cd frontend && yarn build`; serve its `dist/` output with a static web server.
- Use a staging database first. Verify backup restoration, tenant migration, owner
  login, tenant provisioning, tenant isolation, cookie flags, and a real browser
  sign-in before switching production traffic.

The repository does not yet include provider-specific deployment manifests, a CI/CD
release workflow, rate limiting, CSRF tokens, team invitations, or operational
monitoring. Password recovery is implemented, but sending links requires configured
SMTP settings. Select a hosting provider and deployment topology before adding those
provider-specific pieces; do not treat the local development server as production.
