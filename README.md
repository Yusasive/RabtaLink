# RabtaLink

A USSD/SMS/Voice/Airtime-first introduction network for marriage, friendship, and
professional connections — built around trusted human intermediaries ("Rabta
Agents") and guardian consent, rather than a photo-first swipe feed. Works fully
on feature phones; no app or smartphone data required for end users.


## Architecture

Two deployable pieces, one Postgres + Redis backing:

```
┌────────────────────┐        ┌─────────────────────────┐
│  Africa's Talking   │  HTTP  │   backend/  (NestJS)     │
│  USSD·SMS·Voice·AT  │───────▶│   REST + AT webhooks     │
└────────────────────┘        └───────────┬─────────────┘
                                           │
                        ┌──────────────────┼──────────────────┐
                        ▼                  ▼                  ▼
                  ┌───────────┐    ┌───────────────┐   ┌─────────────┐
                  │ PostgreSQL │    │     Redis      │   │ dashboard/   │
                  │ (TypeORM)  │    │ (session/OTP/  │   │ (Next.js 16) │
                  └───────────┘    │  Voice markers)│   │ agent-only,  │
                                    └───────────────┘   │ JWT-gated    │
                                                          └─────────────┘
```

### Backend (`backend/`) — NestJS + TypeScript

| Module | Responsibility |
|---|---|
| `ussd/` | The end-user step machine: language → register/agent/matches menus, session state in Redis, resume-after-drop |
| `consent/` | Guardian YES/NO consent flow + 24h reminder sweep |
| `agents/` | Rabta Agent registration, Voice-OTP verification, LGA-based registrant notifications |
| `matching/` | Rule-based eligibility (no ML), propose/accept/decline state machine, Ta'aruf call scheduling + Conference bridging, weekly digest |
| `ledger/` | Airtime courting gestures + agent rewards, backed by `airtime_transactions` |
| `notifications/` | Thin AT-facing SMS/Voice controllers (inbound webhooks + outbound XML) |
| `auth/` + `dashboard/` | Phone+OTP login for agents (no passwords anywhere in this product) and the JSON API the Next.js dashboard consumes |
| `activity/` | In-memory live-activity feed for the demo screen (deliberately not persisted — ephemeral by design) |
| `africastalking/` | Single wrapper around the AT SDK (SMS/Voice/Airtime) — every outbound send goes through here |
| `common/` | Cross-cutting utilities (e.g. LGA text normalization) and the AT webhook auth guard |

Data model (`backend/src/database/entities/`): `users`, `guardians`, `agents`,
`matches`, `airtime_transactions`, `ussd_sessions` — see `TRD.md §3` for the
original schema and the migrations in `backend/src/database/migrations/` for
what's actually deployed (a couple of small additive columns beyond the original
spec, documented inline).

**Stack:** NestJS 11, TypeORM (Postgres), ioredis, `@nestjs/jwt`, `@nestjs/throttler`,
`@nestjs/schedule` for cron jobs (reminders, digest, call-scheduling sweep, reward
sweep), Joi for env validation, Jest for tests.

### Dashboard (`dashboard/`) — Next.js 16 (App Router)

Internal-only, JWT-gated tool for Rabta Agents (and the judge-facing live
activity screen). No end-user-facing pages — end users only ever touch
USSD/SMS/Voice.

| Route | Purpose |
|---|---|
| `/login` | Phone + OTP two-step sign-in |
| `/registrants` | Agent's assigned registrants, sorted "needs action" first |
| `/matches/propose` | Two-person picker + plain-language compatibility summary (never a raw score) |
| `/matches` | Kanban tracker mirroring `matches.status` |
| `/rewards` | Airtime reward ledger |
| `/demo` | Live USSD/SMS/Voice/Airtime activity feed, built to be projected during a demo |

**Stack:** Next.js 16 (Turbopack), React 19, Tailwind CSS v4, TypeScript. Talks to
the backend directly via `fetch` (no Next.js API routes) — CORS is configured on
the backend for the dashboard's origin.

## Prerequisites

- Docker + Docker Compose
- Node.js 22+ and npm (for running things outside Docker, e.g. the dashboard, or
  migrations/seed scripts from the host)
- An [Africa's Talking](https://account.africastalking.com) account — the
  `sandbox` username works for USSD/SMS/Airtime; **Voice has no sandbox
  subdomain** (see the note in `.env.example`), so Voice testing needs a real AT
  account username pointed at an app in test mode

## Quick start (Docker Compose)

```bash
cp .env.example .env
```

Then edit `.env`:
- Generate real secrets — **do not skip this**, there is no insecure fallback:
  ```bash
  openssl rand -hex 32   # → JWT_SECRET
  openssl rand -hex 16   # → AT_WEBHOOK_SECRET
  ```
- Fill in `AT_USERNAME` / `AT_API_KEY` from your AT sandbox dashboard.
- If you're testing Voice or Record/GetDigits flows, set `PUBLIC_BASE_URL` to a
  real https tunnel (e.g. `ngrok http 3000`) and register the AT callback URLs
  in the AT dashboard with `?token=<your AT_WEBHOOK_SECRET>` appended — every
  AT-facing webhook route rejects requests without it.

```bash
docker compose up -d --build
```

This starts `postgres`, `redis`, and `api` (port `3000`). Then run the migration
and (optionally) seed some demo data:

```bash
cd backend
npm install                 # needed on the host to run these CLI scripts
npm run migration:run
npm run seed                # verified agent + a handful of demo registrants (safe to re-run)
```

Check it's up:

```bash
curl http://localhost:3000/health
# {"status":"ok","postgres":true,"redis":true}
```

### Running the dashboard

```bash
cd dashboard
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:3000" > .env.local   # already present in this repo checkout
npm run dev   # http://localhost:3001
```

Log in with the seed script's agent phone number (printed by `npm run seed`) —
since there's no SMS delivery without real AT credentials, read the OTP straight
out of Redis:

```bash
docker compose exec redis redis-cli GET "dashboard:login-otp:<phone-number>"
```

## Local development (without Docker for the API)

Useful for faster iteration — point the backend at the same Postgres/Redis
containers but run Nest directly on the host:

```bash
docker compose up -d postgres redis   # from repo root

cd backend
npm install
# backend/.env should point POSTGRES_HOST / REDIS_HOST at localhost, not the
# docker-compose service names — see the comments in .env.example
npm run start:dev
```

### Tests & linting

```bash
cd backend
npm test          # Jest — eligibility rules, match state machine, OTP flows
npm run lint

cd dashboard
npm run lint
npm run build      # also type-checks
```

## Environment variables

All documented with generation commands/notes in [`.env.example`](.env.example).
The short version:

| Variable | Notes |
|---|---|
| `JWT_SECRET` | Required, ≥32 chars, no fallback — `openssl rand -hex 32` |
| `AT_WEBHOOK_SECRET` | Required, ≥16 chars — appended as `?token=...` to every AT callback URL |
| `PUBLIC_BASE_URL` | Must be https; AT's Voice API calls back to this for GetDigits/Record |
| `DASHBOARD_ORIGIN` | CORS origin for the Next.js dashboard |
| `AT_USERNAME` / `AT_API_KEY` | From your AT sandbox app. `sandbox` only resolves for SMS/USSD/Airtime — Voice needs a real account username |
| `POSTGRES_*`, `REDIS_*` | Standard connection settings |

The app **fails fast at boot** (via a Joi schema) if any required variable is
missing or malformed — there are no silent insecure defaults.

## Security notes

- Every AT-facing webhook (`/ussd/callback`, `/sms/inbound`, `/voice/callback`,
  `/voice/agent-otp-digits`, `/voice/record-intro-complete`) requires
  `?token=<AT_WEBHOOK_SECRET>` — Africa's Talking has no request-signing of its
  own, so this is the standard workaround.
- Dashboard login OTP is single-shot (consumed on any attempt, right or wrong)
  and rate-limited (3 requests/5min on send, 5/5min on verify).
- No end-user passwords anywhere — phone number + OTP only, for both
  registrants (USSD/Voice) and agents (dashboard login).






Seed complete:
  Agent:  Hajiya Zainab (+234700000001) — verified, covers Kano Municipal
  Amina:  +234700000002 — marriage, guardian +234700000003 approved
  Bashir: +234700000004 — marriage, guardian +234700000005 approved
  Sadiq:  +234700000006 — professional
  Hauwa:  +234700000007 — friendship