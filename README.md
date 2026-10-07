# Atelier Salon CRM

CRM for a hair salon, with client profiles and visit notes, appointment scheduling,
stylist management, services, and role-based access.

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
Seeded accounts are for local development only; change or remove them before
deploying an environment with real data.

## Configuration

Backend settings are read from `backend/.env`:

- `MONGO_URL`: MongoDB connection string
- `DB_NAME`: database name
- `CORS_ORIGINS`: comma-separated allowed origins

Do not commit `.env` files or production credentials.

## Checks

```bash
cd backend && python -m pytest
cd frontend && yarn typecheck
cd frontend && yarn lint
cd frontend && yarn build
```

The Playwright workspace is under `tests/`; end-to-end specs have not yet been
added. The development-server commands above are for local development, not
production deployment.
