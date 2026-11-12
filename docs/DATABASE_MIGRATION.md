# Database Migration Guide

This document describes the version-controlled MySQL migration system for the
CHO Laboratory Appointment & Enrollment System.

The authoritative schema is `mysql/migrations/`. `mysql/schema.sql` is only an
entry-point note that points to the runner; it is no longer a second copy of the
schema.

---

## 1. Design rules

1. **Forward-only.** There are no down migrations. A bad migration is corrected
   with a new forward migration. A destructive mistake is recovered from a
   verified backup, not by running a reverse script.
2. **Never edit an applied migration.** The runner stores a SHA-256 checksum for
   every applied file and refuses to continue if the file changed.
3. **Never drop tables, databases, or columns automatically.** The migration
   suite is checked by `tests/migrations.test.ts` for `DROP TABLE`,
   `DROP DATABASE`, and `TRUNCATE`.
4. **Prefer idempotent SQL.** Baseline table creation uses
   `CREATE TABLE IF NOT EXISTS`. Index migrations check
   `information_schema.statistics` before adding an index. Seed rows use
   `ON DUPLICATE KEY UPDATE`.
5. **No production credentials in files.** The runner reads `DB_*` environment
   variables and `.env.local` / `.env` when present. It never prints the
   password.
6. **Production requires explicit authorization.** The runner refuses to apply
   migrations when `NODE_ENV=production` unless `--yes` is passed.

---

## 2. Migration files

Naming convention:

```text
NNNN_snake_case_name.sql
```

Examples:

```text
0001_initial_schema.sql
0002_query_indexes.sql
0003_add_patient_reference.sql
```

The four-digit version must be unique and strictly increasing. The runner sorts
by version, not by filesystem order.

Current history:

| Version | File | Purpose |
| --- | --- | --- |
| `0001` | `0001_initial_schema.sql` | Tables, foreign keys, indexes, service seed |
| `0002` | `0002_query_indexes.sql` | Duplicate-check, facility, and status indexes |

---

## 3. Tracking table

The runner creates this table automatically:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(20) NOT NULL,
  name VARCHAR(200) NOT NULL,
  checksum CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  applied_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  execution_ms INT UNSIGNED NULL,
  PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

`checksum` is the SHA-256 of the migration file exactly as committed. If a file
is edited after being applied, `db:migrate`, `db:migrate:status`, and
`db:verify` all fail with a clear error. Add a new migration instead.

The application startup check requires `schema_migrations` to exist. A database
that was created from an old copy of `mysql/schema.sql` must be brought under
tracking with `npm run db:migrate` before the application will start.

---

## 4. Commands

All commands load `.env.local` and `.env` if present, then use `DB_*` variables.

```bash
# Apply all pending migrations
npm run db:migrate

# Show applied and pending migrations
npm run db:migrate:status

# Verify connection, version, tracking, checksums, required tables, collation
npm run db:verify

# Show what would be applied without changing anything
node scripts/db-migrate.mjs up --dry-run

# Required in production after MICT authorization
NODE_ENV=production node scripts/db-migrate.mjs up --yes
```

On Windows PowerShell, set the variable for the command:

```powershell
$env:NODE_ENV = "production"
node scripts/db-migrate.mjs up --yes
```

---

## 5. First deployment / existing database

### New empty database

MICT or the DBA creates the database and application account first:

```sql
CREATE DATABASE <APP_DB_NAME>
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
```

Then, from the application directory, with the application environment loaded:

```bash
npm run db:migrate
npm run db:verify
```

### Existing database created from the old `schema.sql`

The old schema already contains the tables. The new baseline is written with
`CREATE TABLE IF NOT EXISTS`, so the first `npm run db:migrate` is safe:

1. It creates `schema_migrations`.
2. It re-runs `0001_initial_schema.sql`; existing tables are left in place and
   the service seed uses `ON DUPLICATE KEY UPDATE` without overwriting
   `daily_capacity`.
3. It applies `0002_query_indexes.sql`; indexes are added only if absent.
4. It records both versions.

Always take a verified backup before the first run against a database that
contains real records.

---

## 6. Writing a new migration

1. Create the next numbered file:

   ```text
   mysql/migrations/0003_add_something.sql
   ```

2. Keep the migration narrow and explain why it is needed in comments.
3. Use `IF NOT EXISTS` where MySQL supports it. MySQL 8.0 does not support
   `CREATE INDEX IF NOT EXISTS`, so use the
   `information_schema.statistics` + prepared statement pattern from
   `0002_query_indexes.sql`.
4. Never edit an existing migration.
5. Run the static migration checks:

   ```bash
   npm test -- tests/migrations.test.ts
   ```

6. Apply it to a disposable MySQL 8.0 test database first:

   ```bash
   npm run db:migrate
   npm run db:verify
   ```

7. Only after review and authorization, apply it to production.

### Example: safe index addition

```sql
SET @index_exists := (
  SELECT COUNT(*)
    FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'appointments'
     AND index_name = 'idx_appointments_example'
);
SET @ddl := IF(
  @index_exists = 0,
  'ALTER TABLE appointments ADD INDEX idx_appointments_example (example_column)',
  'DO 0'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
```

---

## 7. Production procedure

Do not run this until MICT has authorized the database change window.

1. **Confirm the target.** Print the host, user, and database (never the
   password):

   ```bash
   npm run db:migrate:status
   ```

2. **Take a backup.** Follow MICT's backup procedure. Verify the backup file is
   non-empty and can be read.

3. **Dry run:**

   ```bash
   node scripts/db-migrate.mjs up --dry-run
   ```

4. **Apply with explicit confirmation:**

   ```bash
   NODE_ENV=production node scripts/db-migrate.mjs up --yes
   ```

5. **Verify:**

   ```bash
   npm run db:verify
   ```

6. **Start or restart the application** only after verification passes. The
   startup check also requires the schema to be complete.

7. **Record the result** in the MICT change log: migration versions, checksums,
   timestamps, operator, and backup reference.

---

## 8. Rollback policy

There is no automatic rollback. If a migration must be undone:

1. Stop the application.
2. Restore the pre-change backup into a recovery database.
3. Verify the restored data.
4. Point the application at the recovered database only after MICT approval.
5. Write a new forward migration for the corrected schema.

Never run `DROP TABLE`, `DROP DATABASE`, or `TRUNCATE` to "roll back" a
production migration.

---

## 9. Real MySQL integration tests

The integration suite uses a dedicated test database, never the application
database and never production.

Required variables:

```env
DB_TEST_HOST=
DB_TEST_PORT=3306
DB_TEST_USER=
DB_TEST_PASSWORD=
DB_TEST_NAME=cho_appointments_test
DB_TEST_CONFIRM=yes
# Optional TLS
# DB_TEST_SSL=false
# DB_TEST_SSL_CA=/path/to/test-ca.pem
# DB_TEST_SSL_REJECT_UNAUTHORIZED=true
# Set to yes only when the test account is DML-only and DDL must fail.
# DB_TEST_STRICT_PRIVILEGES=no
```

Safety rules enforced by `tests/db/helpers.ts`:

* `DB_TEST_NAME` must contain `test`, `ci`, or `integration`.
* `DB_TEST_CONFIRM=yes` must be set explicitly.
* The suite drops and recreates only the known application tables in that test
  database.
* The suite never reads `DB_HOST`, `DB_USER`, `DB_PASSWORD`, or `DB_NAME` for
  destructive setup. It copies `DB_TEST_*` into the application variables only
  after the safety checks pass.

Run:

```bash
npm run test:db
```

If no test database is configured, every integration test is reported as
skipped. Do not report those as passed.

The suite covers:

1. MySQL connection and pool reuse.
2. Startup verification (`checkDatabaseConnection`, `checkRequiredTables`).
3. Patient record insertion.
4. Appointment insertion.
5. Enrollment/consent insertion.
6. Appointment status updates and history/audit records.
7. QR verification and public status lookup.
8. Administrator authentication and hashed session persistence.
9. Transaction rollback when capacity is exhausted.
10. Duplicate submission handling.
11. Concurrent appointment booking against the real daily cap.
12. Pool close/recovery and unreachable-database handling.
13. Parameter binding against an injection payload.
14. Optional DDL denial when `DB_TEST_STRICT_PRIVILEGES=yes`.

---

## 10. Troubleshooting

| Symptom | Cause | Action |
| --- | --- | --- |
| `Missing required environment variable: DB_HOST` | Environment file not loaded | Check `DB_*` in `.env.local` or the systemd `EnvironmentFile` |
| `ER_ACCESS_DENIED_ERROR` | Wrong user/password or host grant | Confirm the MICT grant includes the application host |
| `ER_BAD_DB_ERROR` | Database does not exist or wrong `DB_NAME` | Ask MICT to confirm the database name |
| `Migration ... has changed after it was applied` | An applied file was edited | Restore the committed file; add a new migration |
| `Migration ... is recorded but the file is missing` | File deleted or renamed | Restore the file from Git |
| `Pending migrations` in `db:verify` | Deployment did not run migrations | Run `npm run db:migrate` with authorization |
| `Missing required table: schema_migrations` | Old schema or empty database | Run `npm run db:migrate` |
| `Table ... uses ... expected utf8mb4` | Database/table created with another charset | Ask MICT to review the database creation; do not convert production data without a plan |
| `Refusing to apply migrations with NODE_ENV=production` | Production guard | Confirm authorization and pass `--yes` |
