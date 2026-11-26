# Administrator roles and access control

This document describes the administrator role model, the database migration,
the initial Super Admin bootstrap, routine account operations, and the supported
recovery procedures.

## Roles

The application has exactly two roles.

| Role | Database value | Capabilities |
| --- | --- | --- |
| `ADMIN` | `admin` | Existing appointment management, laboratory service management, and other existing operational administrator features. |
| `SUPER_ADMIN` | `superadmin` | Everything an `ADMIN` can do, plus `/admin/users`, administrator creation, profile and role changes, activation/deactivation, password resets, and the administrative audit log. |

New and existing administrators default to `ADMIN`. Every authorization check
is enforced on the server. Hiding a page or button in the browser is only a
convenience; it is never the security boundary.

Role values are stored in MySQL as `admin` and `superadmin`. The API accepts
`ADMIN`, `SUPER_ADMIN`, `admin`, and `superadmin` in request payloads and
normalizes them. Responses use the database values.

Authorization always reads the current role and activation state from MySQL on
each authenticated request. A session cookie is never treated as proof of a
role; a stale browser session cannot retain old permissions after a role change
or account deactivation.

## Database migration

The role and activation state already exist in `administrators`. Migration
`mysql/migrations/0003_admin_rbac.sql` adds only:

- `administrators.display_name VARCHAR(150) NULL`
- `idx_administrators_role_active (role, is_active)`

The statements are guarded with `information_schema` checks, so the file is
safe to execute more than once. Existing accounts, password hashes, sessions,
appointments, and laboratory services are not modified.

### Migration prerequisites

1. Confirm the server is MySQL 8.0.16 or newer (the project targets 8.0.43).
2. Take a verified backup (see below) and confirm it can be restored on a
   non-production instance.
3. Confirm `NODE_ENV`, `APP_URL`, and the `DB_*` variables point at the intended
   database. Run `npm run db:migrate:status` first; it prints the target as
   `user@host:port/database` without the password.
4. Apply migrations only in an approved maintenance window. Migrations are a
   forward-only, explicit operator action and are never run during application
   requests.

Production deployments must use the project's existing migration authorization
process. The runner refuses to apply migrations when `NODE_ENV=production`
unless `--yes` is supplied.

```bash
npm run db:migrate          # apply pending migrations in order
npm run db:migrate:status   # show applied and pending migrations
npm run db:verify           # verify server, tables, collation, column, index, and pending migrations
```

`npm run db:verify` fails when `administrators.display_name` or
`idx_administrators_role_active` is missing. Application startup performs the
same schema check (`checkRequiredSchema`) when `DB_VERIFY_ON_STARTUP` is true,
so a database that skipped the migration cannot start the new code silently.

### Database backup and verification

Back up the whole database before migrating or repairing accounts. Keep
credentials out of shell history and source control; use a client configuration
file or prompted password rather than `--password=...` on the command line.

```bash
# Example backup (run from an approved maintenance host).
mysqldump --single-transaction --routines --triggers "$DB_NAME" > "cho-backup-$(date +%Y%m%d-%H%M).sql"

# Verify the dump is readable and contains the administrator table.
grep -c "CREATE TABLE \`administrators\`" cho-backup-*.sql
```

After migrating, confirm the schema and data:

```bash
npm run db:verify
npm run db:migrate:status
```

Verification must show no pending migrations and no missing column or index.
Restore practice is done on a separate non-production database, never against
production in place.

## Initial Super Admin bootstrap and promotion

Promotion is the only supported way to create a Super Admin. It promotes one
existing, active administrator. It never creates an account, never sets a
password, and never promotes every account.

```bash
npm run admin:promote -- --username <existing-admin> --confirm <existing-admin>
```

Requirements and safeguards:

- `--username` must identify an existing administrator; the account must be
  active. Inactive or missing accounts are refused and left unchanged.
- `--confirm` must repeat the exact username. There is no default account.
- The command opens a transaction and locks the target administrator row with
  `SELECT ... FOR UPDATE` before changing anything.
- The role change and the `admin.user.bootstrap_promoted` audit record are
  committed atomically. A failure rolls both back.
- If the account is already a Super Admin, the command makes no change.
- Promotion can only add a Super Admin, so it can never leave the system without
  an active Super Admin.
- The command only prints the target database, the username, and the resulting
  role; it never prints password hashes or database credentials.

The promotion takes effect immediately because sessions read the current role
from MySQL on every authenticated request.

## Creating administrators

A Super Admin can create accounts at `/admin/users`:

1. Open **Manage administrators** from the admin dashboard.
2. Choose **New administrator**.
3. Enter a unique username, optional display name, password, and initial role.
4. Confirm the password and submit.

The server validates every field, hashes the password with the application's
scrypt configuration, and writes an `admin.user.created` audit record in the
same transaction.

When server access is required, the CLI is strictly create-only:

```bash
printf '%s' "$NEW_ADMIN_PASSWORD" | npm run admin:create -- --username <username> --password-stdin
```

The CLI:

- creates **ADMIN** accounts only and rejects `--role superadmin` (use
  `promote-superadmin` instead);
- rejects an existing username without changing it; it never resets the
  existing password, role, activation state, lock counters, or last-login data;
- does not reactivate disabled accounts;
- writes an `admin.user.created` audit record in the same transaction;
- never prints a password or password hash to stdout.

Provide the password with `--password-stdin` or the `ADMIN_PASSWORD`
environment variable. Passwords are never accepted as command-line arguments.
Prefer the UI for routine account creation.

## Editing accounts and resetting passwords

At `/admin/users`, select **Edit** next to an account. A Super Admin can:

- change the display name;
- change the role between `ADMIN` and `SUPER_ADMIN`;
- activate or deactivate the account;
- set a new password.

Sensitive changes require an explicit confirmation dialog. The server writes a
specific audit record for each change:

- `admin.user.updated`
- `admin.user.role_changed`
- `admin.user.activated`
- `admin.user.deactivated`
- `admin.user.password_reset`

Password reset procedure:

1. Open `/admin/users` as a Super Admin and select **Edit** for the account.
2. Enter and confirm the new password, then submit.
3. The server replaces the scrypt hash and revokes every active session for the
   target account in the same transaction.
4. Deliver the new password to the administrator through an approved channel.
   Never place it in tickets, chat, source control, or documentation.

A password or hash is never returned by an API and never written to audit
metadata or logs. There is no CLI command that resets an existing password;
use the UI.

## Safety guards

- An administrator cannot deactivate their own account.
- The last active Super Admin cannot be deactivated.
- The last active Super Admin cannot be demoted to `ADMIN`.
- Concurrency: demotion and deactivation lock the active Super Admin rows inside
  a transaction, so two operators acting at the same time cannot remove the
  final two Super Admins. At most one conflicting operation succeeds; the other
  returns a `LAST_SUPER_ADMIN` conflict, and deadlocks are retried as whole
  transactions so no partial update or missing audit entry is possible.
- Deactivation and password reset invalidate existing sessions.
- Deactivated accounts cannot sign in and existing sessions stop validating.
- Duplicate usernames are rejected by the unique index and return a conflict.
- The client cannot choose the acting administrator's role. The acting role
  always comes from the authenticated database session.
- Account deletion is intentionally not exposed. Deactivate accounts so audit
  history and references remain intact.

## API endpoints

All endpoints require an authenticated `SUPER_ADMIN` session. State-changing
requests also require the existing CSRF token and trusted-origin checks, and
every endpoint applies the existing database-backed rate limiter. The role is
re-read from MySQL for every request.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/users` | List administrators and the active Super Admin count. |
| `POST` | `/api/admin/users` | Create an administrator. |
| `PATCH` | `/api/admin/users/[id]` | Update profile, role, status, or password. |
| `GET` | `/api/admin/audit-logs?limit=100` | Read recent administrative audit entries. |

No `DELETE` route is implemented.

## Account recovery

Use only the supported tools below. Do not change roles or reactivate accounts
with ad-hoc SQL; the application guards and audit trail depend on the supported
code paths.

### When at least one active administrator exists

1. Identify an existing active administrator account.
2. Promote it to Super Admin with exact confirmation:

   ```bash
   npm run admin:promote -- --username <active-admin> --confirm <active-admin>
   ```

3. Sign in as that account and review `/admin/users` and the audit log. Create
   additional Super Admins through the UI if needed.

### When no active administrator exists

1. Restore an active administrator using the approved server maintenance
   process. The create-only CLI can add a **new** ADMIN account; it cannot
   reactivate or reset an existing one:

   ```bash
   printf '%s' "$NEW_ADMIN_PASSWORD" | npm run admin:create -- --username <new-admin> --password-stdin
   ```

2. Promote the new account with the confirmed promotion command shown above.
3. Rotate the temporary password through the UI and review the audit log.

If no usable account can be created (for example, the database is unavailable),
restore from a verified backup or follow the database administrator recovery
runbook. Never place a default or predictable password in source control,
documentation, tickets, or chat.

## Audit log

The administrative audit view shows:

- acting administrator (`actor_username`, or `system` for the CLI bootstrap and
  CLI account creation);
- target administrator;
- action and timestamp;
- previous and new non-secret values, such as role, activation state, and
  display name.

The audit log never contains passwords, password hashes, session tokens, or
secrets.
