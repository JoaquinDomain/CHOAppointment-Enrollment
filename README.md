# CHO Laboratory Appointment Booking & Admin System

Appointment booking and patient enrollment system for the City Health Office (CHO) Bacolod. Built with Next.js 16 (App Router), TypeScript, Tailwind CSS 4, and MySQL 8.0.

## Features

### Patient Portal
- Two-step booking flow: date/service selection, then patient enrollment record
- Weekday-only scheduling with Philippine holiday exclusions
- Per-service daily capacity and AM/PM slot selection for pre-natal checkups
- Searchable appointment status page via signed QR token
- Printable Patient Enrollment Record / ITR, including a print-only clinical information page
- Data privacy consent capture with versioned consent records
- Link to the officially published Privacy Policy in the booking form and the enrollment form

### Admin Dashboard
- Session-based admin authentication with `admin` and `superadmin` roles
- Patient records table with search, status, and facility filters
- Appointment detail view and status updates
- Camera QR scanner for patient check-in
- CSV export and printable site access QR poster
- Audit logging, login rate limiting, and account lockout after repeated failures

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript, Turbopack)
- **UI:** React 19, Tailwind CSS 4, Lucide icons
- **Database:** MySQL 8.0 via `mysql2/promise`
- **QR:** `qrcode.react` for generation, `html5-qrcode` for scanning
- **Testing:** Vitest (unit/mocked) and Vitest against a real MySQL test database
- **Deployment:** Node.js on Rocky Linux 9.6 behind Nginx, with MySQL 8.0.43

## Requirements

- Node.js 20.9 or newer
- MySQL 8.0 (the schema uses `utf8mb4_0900_ai_ci`, generated columns, and CHECK constraints)

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Create your local environment file:

```bash
cp .env.example .env.local
```

Set at least the following values:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=cho_app
DB_PASSWORD=your_database_password
DB_NAME=cho_appointments

APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_SECRET=generate_with_openssl_rand_-base64_48

COOKIE_SECURE=false
TRUST_PROXY=false
```

See `.env.example` for SSL, session, booking-window, privacy, and ENVI System settings.

3. Create the database (once) and apply the migrations:

```sql
CREATE DATABASE cho_appointments
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
```

```bash
npm run db:migrate
npm run db:verify
```

The migration runner creates `schema_migrations` and applies every file in `mysql/migrations/` in order, including the laboratory service catalogue. It does not create the database or an administrator. See [`docs/DATABASE_MIGRATION.md`](docs/DATABASE_MIGRATION.md) for the migration rules and production procedure.

4. Create an administrator:

```bash
npm run admin:create -- --username admin --role superadmin
```

The password is resolved from `--password-stdin`, then `ADMIN_PASSWORD`, or generated randomly and printed once. The command reads `.env.local` / `.env` automatically.

5. Start the development server:

```bash
npm run dev
```

Open `http://localhost:3000`. The admin login is at `/admin/login`.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection |
| `DB_CONNECTION_LIMIT`, `DB_CONNECT_TIMEOUT_MS`, `DB_ACQUIRE_TIMEOUT_MS` | Connection pool sizing, connect timeout, and pool acquisition timeout |
| `DB_SSL`, `DB_SSL_REJECT_UNAUTHORIZED`, `DB_SSL_CA` | TLS configuration for managed MySQL |
| `DB_VERIFY_ON_STARTUP` | Verify the database connection during server startup |
| `APP_URL`, `NEXT_PUBLIC_APP_URL` | Public origin used for QR links (HTTPS required in production) |
| `APP_SECRET` | HMAC secret for QR tokens; at least 32 characters |
| `SESSION_TTL_HOURS` | Admin session lifetime |
| `SESSION_IDLE_TIMEOUT_MINUTES` | Optional admin idle timeout; `0` disables it |
| `APPOINTMENT_BOOKING_WINDOW_DAYS` | Maximum number of days ahead patients may book |
| `CONSENT_VERSION` | Version label stored with each consent record |
| `TRUST_PROXY` | Trust `X-Forwarded-For` / `X-Real-IP` from a reverse proxy |
| `COOKIE_SECURE` | Use `__Host-` secure cookies; must be `true` over HTTPS |
| `ALLOWED_ORIGINS` | Optional comma-separated extra allowed origins |
| `TURNSTILE_ENABLED` | Enable Cloudflare Turnstile on the public booking form; off by default |
| `TURNSTILE_SECRET_KEY` | Turnstile secret key; server-side only, never committed |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile site key; public by design |
| `NEXT_PUBLIC_ENVI_URL` | Optional external ENVI System URL for health certificates |
| `NEXT_PUBLIC_PRIVACY_*` | Privacy officer and retention details shown on `/privacy`; blank values fall back to the contacts published in the official policy |

## Database

The authoritative schema is `mysql/migrations/`, tracked in `schema_migrations`.
`mysql/schema.sql` is only a pointer to the migration runner.

| Table | Purpose |
| --- | --- |
| `schema_migrations` | Applied migration versions, checksums, and timestamps |
| `patients` | Patient demographics and program coverage |
| `appointments` | Booking, status, and generated duplicate-booking guard |
| `laboratory_services` | Service catalogue and daily capacity |
| `service_daily_capacity` | Per-date capacity and booked counters |
| `administrators` | Admin accounts, password hashes, lockout state |
| `admin_sessions` | Hashed session tokens |
| `consent_records` | Versioned data privacy consent |
| `appointment_status_history` | Status transition history |
| `audit_logs` | Admin, patient, and system audit trail |
| `rate_limit_buckets` | Persistent request rate-limiting state |

Service capacities are seeded from the migrations and can be adjusted in MySQL. Re-running the seed updates names and descriptions but does not overwrite `daily_capacity`.

Database architecture, pooling, integrity rules, permissions, and backup guidance are in [`docs/DATABASE.md`](docs/DATABASE.md). Migration rules and the production procedure are in [`docs/DATABASE_MIGRATION.md`](docs/DATABASE_MIGRATION.md). The MICT provisioning and deployment guide is in [`docs/MICT_DEPLOYMENT.md`](docs/MICT_DEPLOYMENT.md).

## Routes

| Route | Description |
| --- | --- |
| `/` | Patient appointment booking |
| `/appointment/status?token=...` | Public appointment status via signed QR token |
| `/privacy` | Privacy notice |
| `/admin/login` | Admin sign-in |
| `/admin` | Admin dashboard (session required) |
| `POST /api/appointments` | Create an appointment |
| `GET /api/availability?date=YYYY-MM-DD` | Service availability for a date |
| `GET /api/health` | Database health check |
| `/api/admin/login`, `/api/admin/logout`, `/api/admin/check-auth` | Admin session endpoints |
| `GET /api/appointments`, `GET/PATCH /api/admin/appointments/[id]` | Admin list, detail, status updates |
| `POST /api/admin/scan` | Validate a scanned QR token |

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript with no emit |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:db` | Run real MySQL integration tests (skipped without `DB_TEST_*`) |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:migrate:status` | Show applied and pending migrations |
| `npm run db:verify` | Verify connection, checksums, required tables, and collation |
| `npm run admin:create` | Create or update an administrator |

## Security

- QR tokens are HMAC-signed and expire 30 days after the appointment date.
- Admin sessions use hashed, expiring tokens in `HttpOnly` cookies; `__Host-` cookies are used when `COOKIE_SECURE=true`.
- State-changing admin requests require a CSRF token.
- Login attempts are rate limited, and accounts lock after five failed attempts for 15 minutes.
- Passwords are hashed with scrypt (`N = 2^16`, `r = 8`, `p = 2`); hashes created by earlier versions still verify.
- All input is validated server-side, including dates, holidays, capacities, and duplicate bookings.
- Daily capacity is reserved with a conditional statement inside a transaction, so concurrent bookings cannot exceed the limit.
- Database errors are sanitised before logging so patient identity values never reach the log stream.
- CSV exports neutralise spreadsheet formula triggers.
- Security headers are configured in `next.config.ts`; the Content Security Policy is issued by `src/proxy.ts` with a per-request nonce, so `script-src` does not need `'unsafe-inline'`.
- Admin route access is enforced by `src/proxy.ts` and re-checked by the API routes.
- Cloudflare Turnstile is supported for the public booking form and fails closed when enabled.

See [`docs/SECURITY.md`](docs/SECURITY.md) for the full assessment, the environment variables
required in production, the deployment checklist, and the remaining risks. The comparison of
the published Privacy Policy against the data this application actually collects is in
[`docs/PRIVACY_POLICY_REVIEW.md`](docs/PRIVACY_POLICY_REVIEW.md).

## Privacy Policy

The application links to the officially published Privacy Policy at
<https://cho-laboratory-services-appointment.bacolodcity.gov.ph/privacy-policy> using the
label **Read the Privacy Policy** from the booking form, the enrollment form, the public
footer, and the administrator login page. The published policy is maintained outside this
application; this codebase only links to it.

## Testing

```bash
npm test       # unit and mocked-boundary tests; no MySQL required
npm run test:db # real MySQL 8.0 integration tests; requires DB_TEST_* variables
```

The default suite covers date utilities, password hashing, QR tokens, rate limiting, migration
safety, and appointment validation, plus the security controls added during the security
review: administrator sessions and CSRF, API authorisation, parameterised database access,
appointment capacity and duplicate-booking handling, Turnstile verification, CSV export
hardening, log sanitisation, request handling, and the Privacy Policy link.

`npm run test:db` is skipped unless a disposable test database is configured with
`DB_TEST_HOST`, `DB_TEST_USER`, `DB_TEST_PASSWORD`, `DB_TEST_NAME` (must contain `test`, `ci`,
or `integration`), and `DB_TEST_CONFIRM=yes`. It never uses the application database. A
skipped integration run is not a passed integration run; see
[`docs/DATABASE_MIGRATION.md`](docs/DATABASE_MIGRATION.md) §9.

## Deployment

The target environment is MICT-managed Rocky Linux 9.6 with MySQL 8.0.43. Follow
[`docs/MICT_DEPLOYMENT.md`](docs/MICT_DEPLOYMENT.md) for the full procedure, systemd and Nginx
templates, SELinux/firewall notes, and the list of actions MICT must perform.

1. MICT creates a dedicated MySQL 8.0 database and least-privilege application account. Do not share a database with the CHO Services Appointment System.
2. Configure the production environment from `.env.example`. Use HTTPS and set `APP_URL`, `NEXT_PUBLIC_APP_URL`, `COOKIE_SECURE=true`, `TRUST_PROXY=true`, a strong `APP_SECRET`, and the real `DB_*` values.
3. Install dependencies and build: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
4. Apply migrations with authorization: `npm run db:migrate`, then `npm run db:verify`.
5. Create the first administrator with `npm run admin:create`.
6. Start the systemd service and verify through Nginx with `GET /api/health`, the security headers, and a test booking.
7. Confirm the reverse proxy overwrites `X-Forwarded-For`; appending would let clients spoof their address and bypass rate limits.

## Project Structure

```text
cho-appointment-system/
├── mysql/
│   ├── migrations/                 # Authoritative, tracked schema migrations
│   ├── schema.sql                  # Pointer to the migration runner
│   └── mict-database-setup.example.sql
├── docs/
│   ├── DATABASE.md                 # Schema, integrity, pooling, permissions, backup
│   ├── DATABASE_MIGRATION.md       # Migration rules and production procedure
│   ├── MICT_DEPLOYMENT.md          # Rocky Linux 9.6 / MySQL 8.0.43 deployment guide
│   ├── SECURITY.md                 # Security assessment and hardening report
│   └── PRIVACY_POLICY_REVIEW.md     # Policy vs. actual data collection review
├── scripts/
│   ├── db-migrate.mjs              # Migration runner (up/status/verify)
│   ├── lib/env.mjs                 # Shared environment and DB option loader
│   └── create-admin.mjs            # Administrator provisioning
├── src/
│   ├── app/                        # App Router pages and API routes
│   ├── components/                 # Booking, enrollment, and admin UI
│   ├── constants/                  # Services, facilities, PH holidays
│   ├── server/
│   │   ├── appointments/           # Validation, service, repository
│   │   ├── auth/                   # Sessions, passwords, audit logging
│   │   ├── config/                 # Environment validation
│   │   ├── db/                     # MySQL pool and helpers
│   │   ├── http/                   # Request and response helpers
│   │   ├── logging/                # Structured logging
│   │   ├── security/               # QR tokens and rate limiting
│   │   └── utils/                  # Date utilities
│   ├── types/                      # Shared TypeScript types
│   └── proxy.ts                    # Admin route guard (Next.js proxy)
└── tests/                          # Vitest unit tests; tests/db holds real MySQL tests
```

## License

© 2026 City Health Office Bacolod. All rights reserved.
