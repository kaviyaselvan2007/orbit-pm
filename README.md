# AXIOMATE — AI-Powered Project Risk Prediction & Reporting System

A full-stack project management platform with an AI-based risk-prediction engine,
built as two separate codebases:

```
AXIOMATE/
├── backend/     Node.js + Express + Supabase (PostgreSQL) + JWT REST API
└── frontend/    React + Vite + Tailwind CSS single-page app
```

The frontend talks to the backend exclusively over HTTP (`VITE_API_URL`), so
either half can be deployed independently (e.g. frontend on Vercel/Netlify,
backend on Render/Railway; the database lives in Supabase either way).

---

## 1. Prerequisites

- Node.js 18+ and npm
- A free Supabase project — https://supabase.com → New project (no local
  database install needed; Supabase hosts a managed Postgres instance for you)

## 2. Set up the database (Supabase)

1. Create a project at supabase.com and wait for it to finish provisioning.
2. Open **SQL Editor** in the Supabase dashboard → New query → paste the
   entire contents of `backend/database/schema.sql` → Run. This creates all
   the tables.
3. Get your connection string: **Project Settings → Database → Connection
   string → URI**. Copy it — it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```
   (Use the password you set when creating the project; if you forgot it,
   you can reset it on that same page.)

## 3. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and paste your real Supabase connection string into
`DATABASE_URL`. Then seed demo data (creates the Admin / Project Manager /
Employee login accounts, 5 clients, 8 employees, 8 projects, work logs and
notifications):

```bash
npm run seed
```

Start the API:

```bash
npm run dev      # nodemon, auto-restarts on changes
# or
npm start        # plain node
```

The API runs at `http://localhost:5000` by default. Check it's alive and
actually reaching Supabase:

```bash
curl http://localhost:5000/api/health
```

If login still fails, check the backend terminal — `config/db.js` logs a
clear error there (e.g. wrong password, wrong project ref, or the schema
hasn't been run yet) instead of just a generic 500 to the browser.

### Demo logins (password for all: `password123`)

| Role            | Email                             |
|-----------------|------------------------------------|
| Admin           | admin@axiocloudsolutions.com      |
| Project Manager | pm@axiomate.com                   |
| Employee        | employee@axiomate.com             |

## 4. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env        # defaults to http://localhost:5000/api — edit if your API runs elsewhere
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`).

For a production build:

```bash
npm run build      # outputs static files to frontend/dist
npm run preview    # serve the production build locally to test it
```

---

## 5. What's implemented

**Backend (`/backend`)**
- JWT authentication: signup, login, forgot/reset password, change password, `/me`
- Role-based authorization (Admin / Project Manager / Employee) enforced per-route
- Full CRUD REST APIs: Projects, Employees, Clients, Work Logs, Notifications
- Database: PostgreSQL via Supabase, accessed with `pg` (node-postgres) — no
  local database install required, just a Supabase connection string
- `utils/riskEngine.js` — the AI risk-classification engine (schedule pace,
  days remaining, team workload, priority) shared by the projects, dashboard
  and reports endpoints, returning Low/Medium/High with explainable reasons
- Dashboard aggregate stats endpoint (`/api/dashboard/stats`)
- Weekly report generator: JSON, printable plain-text, and downloadable CSV
- AI Project Assistant endpoint (`/api/assistant/ask`) — rule-based Q&A over
  live project/employee/client data
- `database/schema.sql` (run once in the Supabase SQL editor) + a seed script
  that hashes demo passwords with bcrypt at insert time (no secrets are ever
  hard-coded in the SQL file)

**Frontend (`/frontend`)**
- Login, Sign Up, Forgot/Reset Password — real screens wired to the API
- Role-aware sidebar navigation — every one of the 11 menu items routes to a
  real page (Dashboard, Notifications, Projects, Employees, Clients, Risk
  Prediction, Effort Tracking, AI Assistant, Reports, Profile, Settings)
- Dashboard stat cards are clickable and deep-link into the filtered
  Projects page or the relevant module
- Projects / Employees / Clients: search, filter, create, edit, delete
- AI Risk Prediction page with a radial risk indicator and reasons per project
- Effort Tracking: log hours, see overloaded/underutilized employees
- AI Assistant chat UI calling the backend's rule-based Q&A endpoint
- Reports page: generate a preview and download CSV, both from live data
- Profile (with photo upload) and Settings (theme, notifications, security,
  2FA toggle, password change)
- JWT stored in `localStorage`, attached automatically to every API request,
  with automatic sign-out on a 401 response

## 6. Notes on going further

- **Supabase Auth / RLS**: this backend connects directly to your Supabase
  Postgres database with its own Express + JWT + bcrypt auth layer — it does
  not use Supabase's built-in Auth or Row Level Security. That's why Row
  Level Security should stay **off** (or you'll need policies) for the
  tables in `schema.sql`, since all access control happens in
  `middleware/authMiddleware.js` instead. If you'd rather use Supabase Auth
  and RLS directly, that's a bigger swap (using `@supabase/supabase-js` on
  the frontend instead of this Express API) — ask if you want that version.

- **Email delivery**: `forgot-password` currently returns the reset token
  directly in the API response instead of emailing it, so the demo works
  without an SMTP provider. Wire up a provider (SendGrid, SES, Postmark) in
  `controllers/authController.js` to send it as a real email link instead.
- **File uploads**: profile photos are stored as base64 data URLs in the
  browser/DB for simplicity. For production, upload to S3/Cloud Storage and
  store the URL instead.
- **Environment**: never commit real `.env` files — `.gitignore` already
  excludes them; only `.env.example` is tracked.
