# Database Architecture

**Application:** CHO Laboratory Appointment & Enrollment System
**Database engine:** MySQL 8.0.43
**Driver:** `mysql2/promise` with a single shared connection pool
**Schema history:** `mysql/migrations/` (tracked in `schema_migrations`)
**Target host:** MICT-provided MySQL server on Rocky Linux 9.6

This application has its own database. It must never share a database, schema,
or table with the CHO Services Appointment System or any other application.

---

## 1. Provider audit

The repository originally contained two alternative backends:

| Historical provider | Status |
| --- | --- |
| Supabase / PostgreSQL (`docs/schema.sql`, `supabase-appointments.ts`) | Removed |
| OracleDB (`docs/oracle-schema.sql`, `oracle-appointments.ts`) | Removed |

The current implementation uses only MySQL 8.0 through `mysql2`. There is no
mock, in-memory, SQLite, Cloudflare D1, Supabase, or Oracle fallback in
production code. If the database is unavailable, API routes return a `503`
`DATABASE_UNAVAILABLE` response instead of silently using another data source.

---

## 2. Entity model

All timestamps are stored in UTC as `DATETIME(6)`. The application sets the
MySQL session time zone to `+00:00` and the Node.js connection time zone to
`Z`. Character data uses `utf8mb4` with `utf8mb4_0900_ai_ci`.

| Table | Purpose | Key relationships |
| --- | --- | --- |
| `patients` | Patient enrollment record / ITR demographics, contact details, YAKAP, PhilHealth, household and PWD coverage | Referenced by `appointments` and `consent_records` |
| `appointments` | Booking, service, date/time, facility, status, public QR identifier | `patient_id` → `patients.id`; `service_id` → `laboratory_services.id` |
| `laboratory_services` | Service catalogue and default daily capacity | Referenced by `appointments`, `service_daily_capacity` |
| `service_daily_capacity` | Per-service, per-date booked counter used for atomic capacity reservation | `service_id` → `laboratory_services.id` |
| `consent_records` | Versioned data-privacy consent captured with a booking | `patient_id` → `patients.id`; `appointment_id` → `appointments.id` |
| `appointment_status_history` | Every status transition, including the initial booking row | `appointment_id` → `appointments.id`; optional admin actor |
| `administrators` | Administrator accounts, scrypt password hash, lockout state | Referenced by sessions, history, audit |
| `admin_sessions` | SHA-256 hashes of session tokens, expiry, revocation, last-seen | `admin_id` → `administrators.id` |
| `audit_logs` | Security and record-access audit trail; IP addresses are hashed | Optional actor/entity references |
| `rate_limit_buckets` | Persistent rate-limit counters shared by all app instances | No foreign keys |
| `schema_migrations` | Applied migration version, name, checksum, timestamp | Managed by the migration runner only |

### Enrollment records

The public form calls the patient record the **Patient Enrollment Record /
ITR**. Enrollment data is stored in `patients`; there is no separate
`enrollments` table because one patient has one demographic/coverage record
that is reused by appointments. Consent is versioned separately in
`consent_records` so that a later consent text change remains auditable.

The printable clinical fields (`chief_complaint1`, `chief_complaint2`) are
print-only UI fields and are not persisted, matching the existing application
behaviour.

### Deletion and update behaviour

| Relationship | On delete | On update |
| --- | --- | --- |
| `appointments.patient_id` | `RESTRICT` — a patient with appointments cannot be deleted accidentally | `RESTRICT` |
| `appointments.service_id` | `RESTRICT` | `RESTRICT` |
| `service_daily_capacity.service_id` | `CASCADE` | `RESTRICT` |
| `consent_records.patient_id` | `RESTRICT` | `RESTRICT` |
| `consent_records.appointment_id` | `CASCADE` | `RESTRICT` |
| `appointment_status_history.appointment_id` | `CASCADE` | `RESTRICT` |
| `appointment_status_history.changed_by_admin_id` | `SET NULL` | `RESTRICT` |
| `admin_sessions.admin_id` | `CASCADE` | `RESTRICT` |

The application does not expose a destructive record-deletion endpoint.

---

## 3. Integrity rules

### Duplicate appointments

`appointments.booking_guard` is a stored generated column:

```text
patient_id:service_id:YYYYMMDD
```

It is populated only for active statuses (`scheduled`, `confirmed`,
`completed`, `no_show`). A unique key on `booking_guard` prevents two active
appointments for the same patient, service, and date. A cancelled appointment
sets the generated value to `NULL`, so the patient may book again. MySQL
allows multiple `NULL` values in a unique index.

The booking transaction also performs an explicit `SELECT ... FOR UPDATE`
before inserting, so the normal path returns a clear duplicate-booking error
before the unique key is reached.

### Daily capacity

`service_daily_capacity` has one row per `(service_id, appointment_date)`.
Capacity is reserved inside the booking transaction with one conditional
statement:

```sql
UPDATE service_daily_capacity
   SET capacity = GREATEST(capacity, ?),
       booked_count = booked_count + 1
 WHERE service_id = ?
   AND appointment_date = ?
   AND booked_count < ?
```

If `affectedRows` is not exactly `1`, the booking fails with
`CAPACITY_EXCEEDED` and the whole transaction rolls back. Frontend availability
display is advisory only; it is never the correctness mechanism.

Cancelling an active appointment decrements `booked_count`; reopening a
cancelled appointment reserves a slot again with the same conditional update.

### Patient records

A patient is inserted with:

```sql
INSERT INTO patients (...)
VALUES (...)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
```

The duplicate key is the composite identity
`(first_name, last_name, birthdate, contact_number)`. On a match the existing
row is reused and is **not** overwritten. Contact numbers are not unique on
their own; the constraint only applies to the full composite identity. If the
CHO decides that this identity is too strict for twins or shared household
numbers, add a new migration that replaces the key with an explicit patient
identifier instead of editing the applied migration.

### Transactions

The following operations run in a single transaction and roll back on failure:

* Patient insert + duplicate check + capacity reservation + appointment insert
  + consent record + initial status history.
* Status update + capacity adjustment + status history + audit log.

Audit writes that are not part of a business transaction are best effort and
are logged on failure; they never make a successful business operation appear
to have failed.

---

## 4. Indexes

Frequently queried fields are indexed:

| Index | Purpose |
| --- | --- |
| `uq_appointments_public_id` | QR/public status lookup |
| `uq_appointments_active_booking` | Duplicate active booking prevention |
| `idx_appointments_patient` | Patient appointment history |
| `idx_appointments_patient_service_date` | Duplicate-check lookup inside the transaction |
| `idx_appointments_service_date` | Service availability and capacity reporting |
| `idx_appointments_date_status` | Date-filtered dashboard list |
| `idx_appointments_status_date` | Status-only dashboard filter |
| `idx_appointments_facility_date` | Facility-filtered dashboard list |
| `idx_appointments_created` | Newest-first dashboard ordering |
| `idx_patients_full_name` | Administrator name search |
| `idx_patients_contact` | Contact-number lookup |
| `uq_admin_sessions_token` | Session lookup by hashed token |
| `idx_admin_sessions_expiry`, `idx_admin_sessions_revoked` | Session cleanup and revocation checks |
| `idx_consent_records_patient`, `uq_consent_records_appointment` | Consent traceability |
| `idx_status_history_appointment` | Appointment audit trail |
| `idx_audit_logs_created`, `idx_audit_logs_actor`, `idx_audit_logs_entity`, `idx_audit_logs_action` | Audit review |
| `idx_rate_limit_buckets_expiry` | Expired bucket cleanup |

Do not add a unique constraint to `contact_number`, names, addresses, or
PhilHealth numbers. Those values can legitimately repeat.

---

## 5. Connection pool

`src/server/db/mysql.ts` owns one shared pool per Node.js process. Next.js
development hot reloads reuse the pool through `globalThis`, so a reload does
not create a new pool for every request.

| Setting | Environment variable | Default |
| --- | --- | --- |
| Host | `DB_HOST` | required |
| Port | `DB_PORT` | `3306` |
| User | `DB_USER` | required |
| Password | `DB_PASSWORD` | required |
| Database | `DB_NAME` | required, letters/digits/underscore only |
| Pool size | `DB_CONNECTION_LIMIT` | `10` |
| Connect timeout | `DB_CONNECT_TIMEOUT_MS` | `10000` ms |
| Pool acquisition timeout | `DB_ACQUIRE_TIMEOUT_MS` | `15000` ms |
| TLS | `DB_SSL` | `false` |
| TLS verification | `DB_SSL_REJECT_UNAUTHORIZED` | `true` |
| CA certificate | `DB_SSL_CA` | unset; PEM path or inline PEM |
| Startup verification | `DB_VERIFY_ON_STARTUP` | `true` |

The pool:

* Reuses connections instead of opening one per request.
* Bounds the wait for a free connection and returns `503` if the pool is
  saturated for longer than the acquisition timeout.
* Releases every connection in a `finally` block.
* Destroys a connection that cannot roll back, so a broken connection is never
  returned to the pool.
* Retries deadlocks and lock-wait timeouts up to two times.
* Keeps TCP keepalive enabled for long-running systemd processes.
* Logs the pool target without the password.

For MICT sizing, start with `DB_CONNECTION_LIMIT=10` and confirm that
`max_connections` on the MySQL server can accommodate every application
instance plus administrative sessions. Do not raise the limit without checking
the server-wide limit.

---

## 6. Environment configuration

```env
DB_HOST=
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=
DB_CONNECTION_LIMIT=10
DB_CONNECT_TIMEOUT_MS=10000
DB_ACQUIRE_TIMEOUT_MS=15000
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=true
# DB_SSL_CA=/etc/ssl/certs/mysql-ca.pem
DB_VERIFY_ON_STARTUP=true
```

Rules:

* Database credentials are server-side only. Never use a `NEXT_PUBLIC_`
  prefix for any database value.
* Never commit `.env`, `.env.local`, production environment files, PEM files,
  or passwords.
* `APP_SECRET` is separate from the database password and must be at least 32
  characters in production.
* Missing required production variables prevent startup
  (`src/server/config/env.ts` and `src/instrumentation.ts`).
* `DB_SSL_CA` may be an inline PEM certificate or a path. If it is a path, the
  file must be readable by the application user. The path itself is never
  logged.

---

## 7. Local development

Prerequisites:

* Node.js 20.9 or newer.
* MySQL 8.0 server with a database and an application account.
* `mysql` client is optional; the migration runner uses `mysql2`.

```bash
npm install
cp .env.example .env.local
# edit .env.local with local DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
npm run db:migrate
npm run db:verify
npm run admin:create -- --username admin --role superadmin
npm run dev
```

The migration runner creates `schema_migrations` and applies every file in
`mysql/migrations/` in order. It does not create the database itself. Create the
local database first with your MySQL administrator account:

```sql
CREATE DATABASE cho_appointments
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
```

Use a dedicated local account, not `root`.

---

## 8. Testing

```bash
npm test       # unit and mocked-boundary tests; no MySQL required
npm run test:db # real MySQL integration tests; requires DB_TEST_* variables
```

The default suite excludes `tests/db/**`. Integration tests are skipped when no
test database is configured. See `docs/DATABASE_MIGRATION.md` for the
`DB_TEST_*` variables and safety rules.

A MySQL integration test result is only reported as passed when it ran against
an actual MySQL 8.0 server. Mocked tests are labelled as mocked in the final
verification report.

---

## 9. Production readiness check

`npm run db:verify` checks:

1. TCP/authentication connection.
2. MySQL version is 8.0 (and warns below 8.0.16).
3. `schema_migrations` exists.
4. No applied migration has a changed checksum.
5. No migration is pending.
6. Every required table exists.
7. Every required table uses a `utf8mb4` collation.

The application startup check (`DB_VERIFY_ON_STARTUP=true`) checks the
connection and required tables. In production, a failure aborts startup rather
than serving traffic against an incomplete schema.

---

## 10. Database permissions

The application account must not be `root` and must not have server-wide
privileges. See `mysql/mict-database-setup.example.sql` and
`docs/MICT_DEPLOYMENT.md` for the recommended grants.

Runtime privileges:

```sql
SELECT, INSERT, UPDATE, DELETE
```

Schema-setup privileges, only while a migration is being applied:

```sql
CREATE, ALTER, INDEX, REFERENCES
```

After migrations, revoke `CREATE`, `ALTER`, `INDEX`, and `REFERENCES` if MICT
policy requires the application account to be DML-only. Migrations should then
be applied by a DBA or a separate deployment account.

The application account must never need:

```text
CREATE DATABASE, DROP DATABASE, CREATE USER, DROP USER,
GRANT OPTION, SUPER, PROCESS, FILE, RELOAD, SHUTDOWN
```

---

## 11. Backup and recovery

The application does not create or schedule backups. MICT owns the MySQL backup
policy.

Recommended baseline for MICT review:

```bash
mysqldump \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --set-gtid-purged=OFF \
  --default-character-set=utf8mb4 \
  -h <DB_HOST> -u <BACKUP_USER> -p \
  <APP_DB_NAME> > cho_appointments_$(date +%Y%m%d_%H%M%S).sql
```

Restore into a new empty database:

```bash
mysql --default-character-set=utf8mb4 \
  -h <DB_HOST> -u <MYSQL_ADMIN> -p <APP_DB_NAME> \
  < cho_appointments_YYYYMMDD_HHMMSS.sql
```

After a restore, run:

```bash
npm run db:verify
```

Do not claim that backups, point-in-time recovery, replication, or encryption at
rest are enabled unless MICT confirms it in writing. This repository only
documents the commands; it does not prove the production backup policy.

---

## 12. Known limitations

* MySQL 8.0.43 is the target. MariaDB is not supported by this schema because
  it uses MySQL-specific generated columns, `utf8mb4_0900_ai_ci`, and CHECK
  constraint behaviour.
* The application does not implement a destructive patient-deletion workflow.
* Capacity is tracked per service and date, not per AM/PM slot. Pre-natal AM/PM
  is a patient preference; the daily cap is shared.
* `service_daily_capacity.capacity` is a per-date snapshot. The booking check
  uses the current `laboratory_services.daily_capacity`; the snapshot is kept
  for reporting and constraint enforcement.
* Real concurrency behaviour must be verified against a disposable MySQL 8.0
  test database. The integration suite is provided but is skipped when no test
  database is configured.
