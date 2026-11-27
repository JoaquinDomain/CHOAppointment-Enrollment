# Super Admin Rollout — Gated Production Runbook

**Release to deploy:** `a4f1cce` — *Improve admin records table and detail view*
**Release contents:** `f5ff327` (RBAC / Super Admin), `f7fb5c7` (patient forms and homepage), `a4f1cce` (admin records UI).
**Assumed base:** `a104e99` (the currently deployed release — **verify, do not assume**).
**Target:** **NOT ASSUMED.** The production unit, scope, working directory, runtime user, port, environment file, and database must be established in §1 before any command is run.
**Status:** prepared only. Nothing in this document has been executed on the server.

> **Conflicting historical documentation exists.** One description uses `/opt/cho-appointment`, user `choapp`, a system-level unit, and port `3000`. Another uses `/home/<user>/cho-appointment-enrollment-*`, a user-level unit, and port `3001`. Port `3000` may belong to another application. Neither description is authoritative. §1 is mandatory.

Every step marked **GATE** requires the developer's explicit authorization before it is run. Do not upload, push, migrate, or restart anything without that authorization.

---

## 0. What this release changes

| Change | Effect on production |
|---|---|
| Migration `0003_admin_rbac.sql` | Adds nullable `administrators.display_name` and index `idx_administrators_role_active (role, is_active)`. Additive and idempotent; no row is rewritten. |
| Startup schema check | With `DB_VERIFY_ON_STARTUP=true`, the new code **refuses to start** if migration 0003 is not applied. |
| `/admin/users` + `/api/admin/users*` + `/api/admin/audit-logs` | Super Admin only; the role is read live from MySQL on every request. |
| `admin:create` | Create-only, ADMIN only. Rejects `--role superadmin`; never resets an existing account. |
| `admin:promote` | Promotes one existing **active** administrator; requires the exact username as confirmation. |
| Booking transaction | Capacity row is locked before appointment gap locks (deadlock avoidance). Behavior unchanged otherwise. |
| Admin records UI (`a4f1cce`) | Table layout and patient-detail panel. No schema change. |

Backward compatibility: the new code cannot run without 0003. The old code (`a104e99`) ignores `display_name` and the index, so **application rollback after migration is safe**; do not drop the column or index as part of an application rollback.

---

## 1. Configuration verification — read only, mandatory

Run every check in this section and record the output. Do not substitute the historical examples. If a value cannot be verified, stop and report it; do not guess.

### 1.1 Discover the actual unit and scope

```bash
systemctl --user list-unit-files | grep -i cho || true
systemctl list-unit-files | grep -i cho || true

systemctl --user list-units --all | grep -i cho || true
systemctl list-units --all | grep -i cho || true
```

Choose the unit that actually serves this application, then set:

```bash
# Fill these only after verifying each value. They are used by every later section.
SERVICE="<verified-unit-name>"
SCOPE=""                    # "" for a system unit; "--user" for a user unit
RUNTIME_USER="<verified-runtime-user>"
PORT="<verified-listening-port>"
RELEASE_ROOT="<verified-parent-directory>"
BASE_RELEASE="$RELEASE_ROOT/cho-appointment-enrollment-a104e99"
RELEASE_DIR="$RELEASE_ROOT/cho-appointment-enrollment-a4f1cce"
ENV_FILE="<verified-environment-file>"
```

### 1.2 Unit, process, port, and Node

```bash
systemctl $SCOPE show -p WorkingDirectory -p ExecStart -p MainPID -p User "$SERVICE"
ps -o args= -p "$(systemctl $SCOPE show -p MainPID --value "$SERVICE")"

# Confirm the port belongs to this service, not another application.
ss -ltnp | grep ":$PORT"

# Confirm the runtime user can execute the Node binary used by the unit.
sudo -u "$RUNTIME_USER" node -v

# Paths only; do not cat the EnvironmentFile.
systemctl $SCOPE cat "$SERVICE" | sed -n '1,80p'
```

### 1.3 Environment keys and safety flags — never print values

```bash
# The deployment user must be able to read the file without printing it.
sudo -u "$RUNTIME_USER" test -r "$ENV_FILE"

# Show key names only.
grep -oE '^[A-Z_]+=' "$ENV_FILE" | sort

# Load for checks; do not echo the environment.
set -a; . "$ENV_FILE"; set +a

printf 'APP_URL=%s\n' "$APP_URL"
printf 'NEXT_PUBLIC_APP_URL=%s\n' "$NEXT_PUBLIC_APP_URL"
printf 'COOKIE_SECURE=%s TRUST_PROXY=%s DB_VERIFY_ON_STARTUP=%s\n' \
  "$COOKIE_SECURE" "$TRUST_PROXY" "$DB_VERIFY_ON_STARTUP"
printf 'APP_SECRET length=%s\n' "${#APP_SECRET}"
printf 'DB target=%s/%s\n' "$DB_HOST" "$DB_NAME"
# Never print DB_PASSWORD, APP_SECRET, or any other secret value.
```

Required before cutover:

- `APP_URL` and `NEXT_PUBLIC_APP_URL` use `https://`.
- `COOKIE_SECURE=true`.
- `TRUST_PROXY=true` when Nginx is the reverse proxy.
- `DB_VERIFY_ON_STARTUP=true`.
- `APP_SECRET` length is at least 32 characters (the application rejects shorter values in production).
- The database target is the intended production database.

### 1.4 Migration history and existing Super Admin

Use a client that does not print credentials:

```sql
SELECT version, name, applied_at FROM schema_migrations ORDER BY version;
SHOW COLUMNS FROM administrators LIKE 'display_name';
SHOW INDEX FROM administrators WHERE Key_name = 'idx_administrators_role_active';

SELECT
  COUNT(*) AS total_administrators,
  SUM(role = 'superadmin') AS total_superadmins,
  SUM(role = 'superadmin' AND is_active = 1) AS active_superadmins,
  SUM(role = 'superadmin' AND is_active = 0) AS inactive_superadmins
FROM administrators;
```

Expected before rollout: `0001` and `0002` applied; `0003` absent; no `display_name`; no RBAC index. An active Super Admin may or may not already exist — record the count. Do not assume an account exists just because the migration is present. If `0003` is already recorded and both objects exist, §5 is verification-only; do not re-apply DDL.

### 1.5 Nginx, TLS, DNS, and privacy URL

```bash
# Confirm the upstream points at the verified port, not 3000 by assumption.
nginx -T 2>/dev/null | grep -n "proxy_pass.*:$PORT"

# Confirm the public hostname and certificate.
curl -sI "https://<verified-public-host>/" | sed -n '1,20p'
```

Confirm manually: the Nginx upstream, TLS certificate name/expiry, DNS record, and the privacy-policy URL used by the site. Do not claim these are verified until the operator records the output.

**GATE 1:** record the verified `SERVICE`, `SCOPE`, `RUNTIME_USER`, `PORT`, `RELEASE_ROOT`, `BASE_RELEASE`, `ENV_FILE`, `APP_URL`, database target, migration history, and Super Admin count. No upload or write occurs before this gate.

---

## 2. Make the release available to the server

The release is `a4f1cce`, which contains three commits on top of `a104e99`. A bundle must include all three, not only `f5ff327`.

### 2.1 Build and verify the bundle locally

```bash
# local repository
git rev-parse HEAD                       # must be a4f1cce...
git log --oneline -4                     # a4f1cce, f7fb5c7, f5ff327, a104e99
git bundle create ~/cho-a4f1cce.bundle a104e99..main
git bundle list-heads ~/cho-a4f1cce.bundle
git bundle verify ~/cho-a4f1cce.bundle
```

The list-heads output must advertise:

```text
a4f1cce... refs/heads/main
```

If it does not, stop. A range ending at a raw commit hash may not advertise a branch reference; use `a104e99..main` as shown.

### 2.2 Transfer without overwriting the old release

```bash
# local
scp ~/cho-a4f1cce.bundle <deploy-user>@<server>:~/

# server
git clone "$BASE_RELEASE" "$RELEASE_DIR"
cd "$RELEASE_DIR"
git fetch ~/cho-a4f1cce.bundle main
git merge --ff-only FETCH_HEAD
git rev-parse HEAD
git log --oneline -4
```

`git rev-parse HEAD` must print `a4f1cce...`. `git log` must show all three release commits above `a104e99`.

Do not clone into, or reuse, the existing release directory. A new directory keeps the previous release intact for rollback.

Alternative, if pushing is authorized:

```bash
# local
git push origin main
# server
git clone "$BASE_RELEASE" "$RELEASE_DIR"
cd "$RELEASE_DIR"
git fetch origin main
git merge --ff-only FETCH_HEAD
```

**GATE 2:** authorization to push or copy the release, and confirmation of the new release directory. No upload without this gate.

---

## 3. Backup before any migration

**GATE 3:** MICT/CHO authorization for the change window, a verified backup, and a successful isolated restore test.

`BACKUP_USER` must be explicitly supplied by MICT. It is **not** the application account. It needs the privileges required by `mysqldump --single-transaction --routines --triggers --events` (typically `SELECT`, `SHOW VIEW`, `TRIGGER`, `EVENT`, and the routine/process privileges MICT requires). Do not invent an account or reuse `DB_USER` by assumption.

```bash
set -euo pipefail
set -a; . "$ENV_FILE"; set +a
umask 077

read -r -p "Backup MySQL user (MICT-provided): " BACKUP_USER
BACKUP_DIR="/home/<deploy-user>/cho-backups"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/cho-$(date +%Y%m%d-%H%M).sql"

# -p prompts; never put the password on the command line or in a variable.
mysqldump --single-transaction --routines --triggers --events \
  --set-gtid-purged=OFF --default-character-set=utf8mb4 \
  -h "$DB_HOST" -u "$BACKUP_USER" -p "$DB_NAME" \
  > "$BACKUP_FILE"

test -s "$BACKUP_FILE"
chmod 600 "$BACKUP_FILE"
grep -c 'CREATE TABLE `administrators`' "$BACKUP_FILE"
grep -c 'CREATE TABLE `appointments`'   "$BACKUP_FILE"
sha256sum "$BACKUP_FILE" | tee "$BACKUP_FILE.sha256"
```

A dump that has never been restored is not a verified backup. Copy the dump to an **isolated, non-production MySQL instance** over an approved channel and restore it there before the migration window. Use a DBA/restore account with `CREATE` and `INSERT` privileges; do not restore over production.

```bash
# On the isolated instance only. Replace the database name; it must contain restore or test.
RESTORE_DB="cho_restore_$(date +%Y%m%d)"
case "$RESTORE_DB" in *restore*|*test*) ;; *) echo "refusing unsafe restore DB name"; exit 1;; esac

mysql -h <isolated-host> -u <restore-user> -p \
  -e "CREATE DATABASE \`$RESTORE_DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
mysql -h <isolated-host> -u <restore-user> -p "$RESTORE_DB" < "$BACKUP_FILE"
mysql -h <isolated-host> -u <restore-user> -p "$RESTORE_DB" \
  -e "SELECT COUNT(*) AS administrators FROM administrators; SELECT COUNT(*) AS appointments FROM appointments;"
```

Record the backup path, checksum, restore database, row counts, operator, and time. If no isolated instance is available, the restore is **PENDING** and deployment is **NO-GO**.

---

## 4. Build the release

```bash
cd "$RELEASE_DIR"
git rev-parse HEAD          # must be a4f1cce...
set -a; . "$ENV_FILE"; set +a
export NODE_ENV=production

npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Notes:

- `npm ci` uses the lockfile; never `npm install` for a release.
- The build does not need the database, but the environment must be loadable.
- Do not run migrations here.
- `npm test` is the unit/component suite. The MySQL integration suite is separate and must use a disposable test database, never production:

```bash
# only when DB_TEST_* points at a disposable database
npm run test:db
```

**GATE 4:** build completed with all checks green. A failed build stops the rollout.

---

## 5. Apply migration 0003

Only after GATE 3 and GATE 4.

**Important:** run `db:migrate:status` from the **new** release (`a4f1cce`). The old `a104e99` migration runner does not know about `0003`; using it will falsely report that there is nothing pending.

```bash
cd "$RELEASE_DIR"
git rev-parse HEAD          # must be a4f1cce...
set -a; . "$ENV_FILE"; set +a

npm run db:migrate:status
node scripts/db-migrate.mjs up --dry-run
NODE_ENV=production node scripts/db-migrate.mjs up --yes
npm run db:verify
```

`up --yes` is required because the runner refuses to apply migrations in production without it. If MICT requires a DBA account for DDL, run the same commands with that account in a temporary environment, then restore the application account's DML-only grants. Do not edit the environment file permanently for this.

Verify independently:

```sql
SELECT version, name, applied_at FROM schema_migrations ORDER BY version;
SHOW COLUMNS FROM administrators LIKE 'display_name';
SHOW INDEX FROM administrators WHERE Key_name = 'idx_administrators_role_active';
```

Expected: `0003` recorded, `display_name` present, index present, and `db:verify` reports no pending migration and no missing schema.

**GATE 5:** explicit authorization to write the production schema. If `db:verify` fails, stop; do not start the new code.

---

## 6. Establish the first Super Admin

Run from the new release directory with the production environment loaded.

First confirm the count from §1.4:

- **Case A — an active `superadmin` already exists.** Nothing to do. Do not create another bootstrap account.
- **Case B — active administrators exist, none is a Super Admin.** Promote one existing active ADMIN:

```bash
npm run admin:promote -- --username <existing-active-admin> --confirm <existing-active-admin>
```

- **Case C — no usable active administrator exists.** Create an ADMIN, then promote it:

```bash
read -r -s -p "New admin password: " NEW_ADMIN_PASSWORD; echo
printf '%s' "$NEW_ADMIN_PASSWORD" | npm run admin:create -- --username <new-admin> --password-stdin
unset NEW_ADMIN_PASSWORD
npm run admin:promote -- --username <new-admin> --confirm <new-admin>
```

`admin:create` creates an `ADMIN` only. A password is required and is never generated or printed. Deliver it through the CHO's approved channel and require rotation at first sign-in. `admin:promote` refuses a missing or inactive account, requires the exact username twice, writes `admin.user.bootstrap_promoted`, and prints only the target database, username, and resulting role.

**GATE 6:** authorization to change administrator roles, and the exact username(s) to promote.

---

## 7. Staging verification on an isolated port

Do not expose this port publicly and do not point it at a different database.

```bash
cd "$RELEASE_DIR"
set -a; . "$ENV_FILE"; set +a

LOG="/tmp/cho-3101.log"
STAGING_PORT=3101

# setsid gives the whole process group a PID we can clean up reliably.
setsid env PORT="$STAGING_PORT" HOSTNAME=127.0.0.1 NODE_ENV=production \
  npm start >"$LOG" 2>&1 &
STAGING_PID=$!

cleanup() {
  kill -- -"$STAGING_PID" 2>/dev/null || kill "$STAGING_PID" 2>/dev/null || true
}
trap cleanup EXIT

READY=0
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$STAGING_PORT/api/health" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "staging failed to become healthy"
  tail -n 80 "$LOG"
  exit 1
fi

curl -fsS "http://127.0.0.1:$STAGING_PORT/api/health"
curl -sI "http://127.0.0.1:$STAGING_PORT/admin/login" \
  | grep -iE 'content-security-policy|x-frame-options|strict-transport'

cleanup
trap - EXIT
sleep 1
ss -ltnp | grep ":$STAGING_PORT" && { echo "port still bound"; exit 1; } || echo "port released"
```

Do not use `sleep 5` followed by `kill %1`; `npm` may spawn a child process and the job spec may not identify it. The `setsid` process group and the port-release check above are required.

---

## 8. Cut over

Back up the unit definition first:

```bash
systemctl $SCOPE cat "$SERVICE" > ~/"$SERVICE".$(date +%Y%m%d-%H%M).bak
```

Update the release path using the mechanism confirmed in §1 (`systemctl $SCOPE edit` writes a drop-in; the actual location depends on scope):

```bash
systemctl $SCOPE edit "$SERVICE"
# Change WorkingDirectory= (and ExecStart= if it contains an absolute release path)
# to $RELEASE_DIR.
```

Then:

```bash
systemctl $SCOPE daemon-reload
systemctl $SCOPE restart "$SERVICE"
systemctl $SCOPE is-active "$SERVICE"
ss -ltnp | grep ":$PORT"
journalctl $SCOPE -u "$SERVICE" -n 80 --no-pager
```

**GATE 7:** authorization to restart production. Restart only this unit; never touch an unrelated unit or port `3000` by assumption.

---

## 9. Post-deploy verification

```bash
# Local, bypassing Nginx
curl -fsS "http://127.0.0.1:$PORT/api/health"

# Public
curl -fsS "$APP_URL/api/health"
curl -sI "$APP_URL/admin/login" \
  | grep -iE 'content-security-policy|x-frame-options|referrer-policy|strict-transport'

# Confirm the running process and directory
systemctl $SCOPE show -p WorkingDirectory -p MainPID "$SERVICE"
```

Functional checks, in order:

1. `/admin/login` loads; the CSP header contains `nonce-`.
2. Sign in as the promoted account; the dashboard header shows `Signed in as … (superadmin)`.
3. **Manage administrators** is visible and `/admin/users` loads.
4. The audit view shows `admin.user.bootstrap_promoted` (or prior entries).
5. Create a throwaway `ADMIN`, sign in with it, confirm `/admin/users` is **not** reachable, then deactivate it from the Super Admin account. Do not test the last-superadmin guard destructively on production.
6. Public booking: open `/`, pick a weekday, confirm availability renders, complete one test booking, open the QR status page, then cancel it from the dashboard (capacity returns).
7. `journalctl` shows no `startup.validation_failed`, no `ER_` errors, and no repeated 503s.

**Production test-data warning:** steps 5 and 6 write real administrator, patient, appointment, consent, history, and audit records. Do not use real patient information. Obtain explicit operator authorization and an approved retention/cleanup procedure before any production write test. Do **not** automatically delete production records after testing. If write testing is not approved, skip steps 5–6, mark them **PENDING**, and record that they were not executed.

Record the health output, migration status, and the first 50 journal lines.

---

## 10. Rollback

Distinguish four separate concerns. A code rollback does **not** automatically reverse database changes.

**Application code (fast):**

```bash
systemctl $SCOPE edit "$SERVICE"       # WorkingDirectory back to $BASE_RELEASE
systemctl $SCOPE daemon-reload
systemctl $SCOPE restart "$SERVICE"
curl -fsS "http://127.0.0.1:$PORT/api/health"
```

**Database schema:** migration `0003` is additive. The old code ignores `display_name` and the index, so no schema rollback is required for an application rollback. Do **not** drop `display_name` or `idx_administrators_role_active` as part of an emergency application rollback. If the schema itself must be reversed, write and review a new forward migration; never drop objects ad hoc.

**Administrator accounts and sessions:** existing `administrators` rows (including `superadmin` accounts) and audit records remain after a code rollback. Sessions are not automatically revoked by rolling back the application; the session table is unchanged. The old application does not enforce the new role model, so a Super Admin account that remains active can still authenticate against the old code. Review and, if required, revoke sessions or deactivate accounts through an authorized procedure.

**Production data created after deployment:** bookings, consents, history, and audit entries persist through an application rollback. Restoring the §3 dump discards every record created after the dump; treat that as a last resort, require explicit authorization, and document the data-loss window.

---

## 11. Evidence status

| Evidence | Status |
|---|---|
| Typecheck, lint, unit/component tests (33 files / 270 tests), production build | **Locally verified** |
| MySQL integration suite (27/27, MySQL 8.0.43) and strict privilege test | **Locally verified in an earlier run; not re-run during this documentation pass** |
| Migration `0003` applied to production | **Not executed** |
| Production backup restored and verified | **Not executed** |
| Live Super Admin login and `/admin/users` on production | **Not executed** |
| Application rollback rehearsed on production | **Not executed** |

Do not report any row in the lower half of this table as passed until the operator records the actual output.

---

## 12. Known risks and open items

1. **Production configuration is unverified.** The unit, scope, user, port, release root, environment file, database, Nginx upstream, TLS, DNS, and privacy URL must be established in §1. Do not infer them from this document.
2. **Startup will fail without 0003.** If `DB_VERIFY_ON_STARTUP=true` and the migration was skipped, the service restarts and exits. That is the intended guard; do not disable it to get the app up.
3. **Application account may lack DDL.** If MICT grants DML only, a DBA must apply 0003. Confirm the grant model before the window.
4. **The repository's MICT document still describes a different topology** (`/opt/cho-appointment`, `choapp`, system-level unit, port 3000). It is protected and was not rewritten here; the verified live unit from §1 is authoritative. The 151-line Nginx 503 section in `docs/MICT_DEPLOYMENT.md` remains uncommitted and unrelated to this release.
5. **Production write tests create persistent records.** See §9. Do not run them without approval and a retention plan.
6. **Login throttle.** The per-IP limit is 5 attempts per 15 minutes and counts successful sign-ins. At cutover, avoid repeated test logins from the same office IP; a 429 is the limiter, not a failed deployment.
7. **No push, upload, migration, or restart has been performed.** The release is local only until the applicable gate is authorized.
