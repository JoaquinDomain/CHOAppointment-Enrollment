# MICT Deployment Guide

**Application:** CHO Laboratory Appointment & Enrollment System
**Target platform:** Rocky Linux 9.6 with MySQL 8.0.43
**Owner of the target environment:** MICT (Management Information and
Communications Technology)

This guide is written for MICT review. It contains commands and configuration
templates only. Nothing in this document has been applied to a production
server, and no production credential, database, or service was created or
changed by the repository work.

> **Do not run the provisioning, migration, firewall, or service commands in
> this guide until MICT has approved the change window and supplied the real
> host names, account names, and credentials.**

---

## 1. Scope and boundaries

### In scope

* A dedicated MySQL database for this application.
* A dedicated, least-privilege MySQL account for the application.
* Node.js application deployment behind Nginx over HTTPS.
* Version-controlled schema migrations.
* systemd service management.
* Operational verification, backup, and recovery expectations.

### Explicitly out of scope

* The CHO Services Appointment System database. This application must never
  read from, write to, or share a schema with that system.
* Modifying any existing production database.
* Creating or rotating production credentials without MICT authorization.
* Claiming that backups, replication, TLS, SELinux, or monitoring are enabled
  without MICT confirmation.

---

## 2. Target topology

```text
Patient browser
      |
      | HTTPS 443
      v
   Nginx (Rocky Linux 9.6)
      |
      | HTTP 127.0.0.1:3000
      v
   Next.js app (Node.js, systemd, user choapp)
      |
      | MySQL 3306 (private network or loopback)
      v
   MySQL 8.0.43 (MICT-managed)
```

Recommended:

* Nginx and the Node.js application on the same host, with the application
  bound to `127.0.0.1` only.
* MySQL on a separate MICT-managed host, reachable only from the application
  host over a private network or a restricted firewall rule.
* No direct public access to port 3000 or port 3306.

If MICT instead uses a load balancer in front of Nginx, the load balancer must
also overwrite `X-Forwarded-For`, and Nginx must be configured with the
`real_ip` module before `$remote_addr` is used.

---

## 3. Prerequisites

| Item | Requirement |
| --- | --- |
| Operating system | Rocky Linux 9.6 |
| Node.js | 20.9 or newer; Node.js 22 LTS is recommended |
| npm | Included with Node.js |
| MySQL client | Optional; the migration runner uses `mysql2` |
| MySQL server | 8.0.43, `utf8mb4`, InnoDB |
| Web server | Nginx with TLS |
| SELinux | Enforcing or permissive; check before deployment |
| Firewall | `firewalld` |
| Time sync | `chronyd` enabled |

The build and runtime were validated on the repository's development machine,
not on Rocky Linux. MICT must run the verification steps in §12 on the target
host.

---

## 4. MySQL provisioning

### 4.1 Create the database and application account

Use `mysql/mict-database-setup.example.sql` as the template. Replace every
`<PLACEHOLDER>` and run it as a MySQL administrator, not as the application
user.

Minimum properties:

```sql
CREATE DATABASE `<APP_DB_NAME>`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
```

Create the application account for the **exact** host the application connects
from:

* Remote application host: `'<APP_DB_USER>'@'<APP_HOST_IP>'`
* Same-host TCP loopback: `'<APP_DB_USER>'@'127.0.0.1'`
* Same-host Unix socket: `'<APP_DB_USER>'@'localhost'`

Do not use `'<APP_DB_USER>'@'%'` unless MICT has a documented reason and a
firewall restriction.

MySQL host matching and `skip_name_resolve`:

* If `skip_name_resolve=ON`, `localhost` matches only the Unix socket, and a
  TCP connection to `127.0.0.1` needs an account whose host is `127.0.0.1`.
* If name resolution is enabled, `127.0.0.1` may resolve to `localhost`.
* Ask MICT which mode the server uses and create the matching account host.

### 4.2 Recommended privileges

Runtime:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE
  ON `<APP_DB_NAME>`.*
  TO '<APP_DB_USER>'@'<APP_HOST>';
```

Only during a migration window, if the application account itself applies
migrations:

```sql
GRANT CREATE, ALTER, INDEX, REFERENCES
  ON `<APP_DB_NAME>`.*
  TO '<APP_DB_USER>'@'<APP_HOST>';
```

After migrations, revoke the schema-change privileges if MICT policy requires a
DML-only runtime account:

```sql
REVOKE CREATE, ALTER, INDEX, REFERENCES
  ON `<APP_DB_NAME>`.*
  FROM '<APP_DB_USER>'@'<APP_HOST>';
```

The application account must never have:

```text
CREATE DATABASE, DROP DATABASE, CREATE USER, DROP USER,
GRANT OPTION, SUPER, PROCESS, FILE, RELOAD, SHUTDOWN
```

### 4.3 Server settings to review

MICT owns server tuning. The following settings affect this application:

| Setting | Recommendation |
| --- | --- |
| `character_set_server` | `utf8mb4` |
| `collation_server` | `utf8mb4_0900_ai_ci` |
| `sql_mode` | Keep strict mode; do not disable `STRICT_TRANS_TABLES` |
| `local_infile` | `OFF` |
| `max_connections` | At least the sum of every app instance's `DB_CONNECTION_LIMIT`, plus administrative headroom |
| `wait_timeout` | Long enough for the pool's idle connections; the driver reconnects if the server closes an idle connection |
| `innodb_buffer_pool_size` | MICT standard for the server's memory |
| `time_zone` | The application sets its session to `+00:00`; no server-wide change is required |
| `default_authentication_plugin` | `caching_sha2_password` is supported by `mysql2`; prefer TLS |

### 4.4 TLS

If MySQL uses TLS:

* Set `DB_SSL=true`.
* Keep `DB_SSL_REJECT_UNAUTHORIZED=true` in production.
* Provide the CA with `DB_SSL_CA` as a readable PEM file path (preferred) or
  an inline PEM value.
* Do not disable certificate verification to work around a self-signed
  certificate. Install the correct CA instead.

If MySQL does not use TLS, keep `DB_SSL=false` only when the database is on a
trusted private network. Do not send credentials over an untrusted network
without TLS.

### 4.5 Backup account

Use a separate backup account for `mysqldump`. Do not give the application
account backup privileges. See `docs/DATABASE.md` §11 for the backup command
template.

---

## 5. Filesystem and service account

```bash
# Run as root, after MICT approval.
useradd --system --home-dir /opt/cho-appointment --shell /sbin/nologin choapp
install -d -o choapp -g choapp -m 0755 /opt/cho-appointment
install -d -o root -g choapp -m 0750 /etc/cho-appointment
```

Deploy the application files to `/opt/cho-appointment`. The application user
needs read access to the code and write access only to the runtime cache and
log locations it actually uses.

Recommended permissions:

| Path | Owner | Mode |
| --- | --- | --- |
| `/opt/cho-appointment` | `choapp:choapp` | `0755` |
| `/opt/cho-appointment/.next` | `choapp:choapp` | `0755` (read-only after build is acceptable) |
| `/opt/cho-appointment/.next/cache` | `choapp:choapp` | `0750` |
| `/etc/cho-appointment/cho-appointment.env` | `root:choapp` | `0640` |
| TLS private key | `root:root` | `0600` |

Do not place the environment file inside the application directory. Do not
commit it to Git.

---

## 6. Environment file

Create `/etc/cho-appointment/cho-appointment.env` from `.env.example`. Use
placeholder values here; obtain the real values from MICT through an approved
secret channel.

Minimum production values:

```env
NODE_ENV=production
HOSTNAME=127.0.0.1
PORT=3000

DB_HOST=<DB_HOST>
DB_PORT=3306
DB_USER=<APP_DB_USER>
DB_PASSWORD=<STRONG_PASSWORD>
DB_NAME=<APP_DB_NAME>
DB_CONNECTION_LIMIT=10
DB_CONNECT_TIMEOUT_MS=10000
DB_ACQUIRE_TIMEOUT_MS=15000
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
DB_SSL_CA=/etc/cho-appointment/mysql-ca.pem
DB_VERIFY_ON_STARTUP=true

APP_URL=https://<PUBLIC_HOST>
NEXT_PUBLIC_APP_URL=https://<PUBLIC_HOST>
APP_SECRET=<AT_LEAST_32_RANDOM_CHARACTERS>

COOKIE_SECURE=true
TRUST_PROXY=true
SESSION_TTL_HOURS=8
SESSION_IDLE_TIMEOUT_MINUTES=0
APPOINTMENT_BOOKING_WINDOW_DAYS=365
CONSENT_VERSION=v1

# Enable only after CHO/DPO approval and with both keys present.
TURNSTILE_ENABLED=false
# TURNSTILE_SECRET_KEY=
# NEXT_PUBLIC_TURNSTILE_SITE_KEY=
```

Generate `APP_SECRET` with a cryptographically secure source, for example:

```bash
openssl rand -base64 48
```

Do not reuse the database password as `APP_SECRET`.

If `DB_SSL_CA` points to a file, install it with:

```bash
install -o root -g choapp -m 0640 <CA_SOURCE> /etc/cho-appointment/mysql-ca.pem
```

---

## 7. Build and database migration

All commands run from `/opt/cho-appointment`.

### 7.1 Install dependencies and build

```bash
# Install with the full dependency set; do not set NODE_ENV=production here,
# because npm would omit the dev dependencies that the build needs.
npm ci

# NEXT_PUBLIC_* values are inlined at build time, so load the production
# environment before building.
set -a
. /etc/cho-appointment/cho-appointment.env
set +a

npm run typecheck
npm run lint
npm test
npm run build
```

`npm ci` must use the committed lockfile. Do not run `npm install` in
production unless MICT's build process requires it and the lockfile is updated
through review.

The build does not need a database connection. Runtime does.

If MICT builds on a separate CI host, that host must receive the
`NEXT_PUBLIC_*` values (and no database password) so the client bundle points
at the correct public URL. The `DB_*` secrets are runtime-only.

### 7.2 Apply migrations

Load the environment into the current shell without printing it:

```bash
set -a
. /etc/cho-appointment/cho-appointment.env
set +a

npm run db:migrate:status
node scripts/db-migrate.mjs up --dry-run
NODE_ENV=production node scripts/db-migrate.mjs up --yes
npm run db:verify
```

Only run the `up --yes` command after:

1. MICT authorization for the change window.
2. A verified backup of the target database (or confirmation that it is a new
   empty database).
3. Confirmation that `DB_HOST`, `DB_NAME`, and `DB_USER` point at the correct
   target. The status command prints the host, user, and database but never the
   password.

If MICT requires migrations to be applied by a DBA account, the DBA runs the
same runner with the DBA credentials in a temporary environment, then the
application account is granted only runtime DML privileges.

### 7.3 Create the first administrator

```bash
set -a
. /etc/cho-appointment/cho-appointment.env
set +a

npm run admin:create -- --username admin --role superadmin
```

Prefer `--password-stdin` or `ADMIN_PASSWORD` so the password is not written to
shell history. The command prints a generated password once if neither is
supplied. Store it in the CHO's approved password manager and require a change
at first sign-in through CHO procedure.

---

## 8. systemd service

Create `/etc/systemd/system/cho-appointment.service`:

```ini
[Unit]
Description=CHO Laboratory Appointment & Enrollment System
Documentation=file:/opt/cho-appointment/docs/MICT_DEPLOYMENT.md
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=choapp
Group=choapp
WorkingDirectory=/opt/cho-appointment
EnvironmentFile=/etc/cho-appointment/cho-appointment.env
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
KillSignal=SIGTERM
SyslogIdentifier=cho-appointment
StandardOutput=journal
StandardError=journal
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
UMask=0027
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

Notes:

* `/usr/bin/npm` is the system Node.js path. If MICT uses a version manager,
  use its absolute path and ensure systemd can read it.
* `HOSTNAME=127.0.0.1` and `PORT=3000` come from the environment file, so the
  application is not exposed directly to the network.
* If `ProtectSystem=full` prevents a required runtime write, grant only the
  specific path with `ReadWritePaths=` instead of disabling protection.
* Do not run the application as `root`.

Enable and start:

```bash
systemctl daemon-reload
systemctl enable --now cho-appointment
systemctl status cho-appointment --no-pager
journalctl -u cho-appointment -n 100 --no-pager
```

The application startup check verifies the database and required tables when
`DB_VERIFY_ON_STARTUP=true`. A failed check aborts startup; investigate the
journal rather than disabling the check.

---

## 9. Nginx reverse proxy

Create `/etc/nginx/conf.d/cho-appointment.conf`:

```nginx
server {
    listen 80;
    server_name <PUBLIC_HOST>;

    return 301 https://$host$request_uri;
}

server {
    # Rocky Linux 9's packaged Nginx uses the combined form below. If MICT
    # installs Nginx 1.25.1 or newer, `listen 443 ssl;` + `http2 on;` is also
    # valid, but do not use both forms together.
    listen 443 ssl http2;
    server_name <PUBLIC_HOST>;

    ssl_certificate     /etc/pki/tls/certs/<CERT>.pem;
    ssl_certificate_key /etc/pki/tls/private/<KEY>.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    client_max_body_size 1m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host  $host;
        proxy_set_header X-Forwarded-Port  $server_port;

        proxy_connect_timeout 5s;
        proxy_send_timeout    60s;
        proxy_read_timeout    60s;
    }
}
```

Critical points:

* `X-Forwarded-For $remote_addr` **overwrites** the header. Never use
  `$proxy_add_x_forwarded_for` here: appending lets a client spoof its address
  and bypass per-address rate limits.
* If a trusted load balancer sits in front of Nginx, configure Nginx
  `real_ip` with only the load balancer's address and then use
  `$remote_addr`. Do not trust arbitrary forwarded headers.
* Do not add or override `Content-Security-Policy` in Nginx. The application
  issues a per-request nonce policy from `src/proxy.ts`.
* Keep the application on `127.0.0.1:3000`; do not expose port 3000 publicly.

Validate and reload:

```bash
nginx -t
systemctl reload nginx
```

---

## 10. SELinux and firewall

### SELinux

Check the current mode:

```bash
getenforce
```

If SELinux is enforcing and Nginx cannot reach the local application, inspect
denials:

```bash
ausearch -m avc -ts recent
```

Apply only the specific boolean or policy that the denial requires, with MICT
approval. For a standard Nginx-to-localhost proxy, the relevant boolean is
often:

```bash
getsebool httpd_can_network_connect
# Only if required by the audit denial and approved by MICT:
# setsebool -P httpd_can_network_connect 1
```

Do not set SELinux to permissive or disabled to work around a configuration
problem.

### Firewall

On the application host:

```bash
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
```

On the MySQL host, allow port 3306 only from the application host:

```bash
firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="<APP_HOST_IP>" port port="3306" protocol="tcp" accept'
firewall-cmd --reload
```

Do not open 3306 to the public internet. Do not open 3000 publicly.

---

## 11. Logs and monitoring

* Application logs go to the systemd journal (`journalctl -u cho-appointment`).
* Configure journald retention according to MICT policy.
* The application's audit log is in the `audit_logs` table. Protect database
  backups and restrict access because the audit trail records which
  administrator accessed which patient record.
* Monitor:
  * `GET /api/health` over HTTPS (rate limited).
  * systemd service state.
  * MySQL availability and connection count.
  * Disk space for MySQL and journald.
  * TLS certificate expiry.
* Do not place patient data in monitoring alerts or external log aggregators
  unless the CHO and DPO have approved the processor and the retention period.

---

## 12. Post-deployment verification

Run these checks after the service is started and Nginx is reloaded.

```bash
# Local application health (bypasses Nginx)
curl -fsS http://127.0.0.1:3000/api/health

# Public HTTPS health
curl -fsS https://<PUBLIC_HOST>/api/health

# Security headers
curl -sSI https://<PUBLIC_HOST>/ | sed -n '1,40p'
curl -sSI https://<PUBLIC_HOST>/admin | sed -n '1,40p'

# Database readiness
cd /opt/cho-appointment
set -a; . /etc/cho-appointment/cho-appointment.env; set +a
npm run db:verify
npm run db:migrate:status
```

Expected:

| Check | Expected |
| --- | --- |
| `/api/health` | `200` with a healthy database status |
| `/` response | `Content-Security-Policy` present with a nonce, no `'unsafe-inline'` in `script-src` |
| `/admin` response | `Cache-Control: no-store` and `X-Robots-Tag: noindex` |
| `db:verify` | Connection, version, checksums, required tables, and collation pass |
| `db:migrate:status` | No pending migrations |
| Admin login | Works over HTTPS; cookie has `Secure`, `HttpOnly`, `SameSite=Strict` |
| Booking flow | A test booking succeeds, appears in the admin dashboard, and the status page resolves the signed token |

Also confirm from an external network:

* Port 3000 is not reachable.
* Port 3306 is not reachable.
* HTTP redirects to HTTPS.
* The certificate chain is valid.

---

## 13. Rollback and recovery

### Application rollback

Keep the previous release directory and a symlink, or keep the previous build
artifact. To roll back:

1. Stop the service.
2. Point the service at the previous release.
3. Start the service.
4. Verify `/api/health` and the admin login.

Do not roll back the database by running reverse SQL. Migrations are
forward-only.

### Database recovery

1. Stop the application.
2. Restore the verified pre-change backup into a recovery database.
3. Validate the restored records.
4. Get MICT approval before pointing the application at the recovered database.
5. Write a new forward migration for any schema correction.

See `docs/DATABASE_MIGRATION.md` §8.

---

## 14. Manual actions required from MICT

The following items cannot be completed from the repository and require MICT,
CHO, or DPO action:

| # | Action | Owner |
| --- | --- | --- |
| 1 | Create the dedicated MySQL database and application account with the grants in §4 | MICT |
| 2 | Supply `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and TLS CA through an approved secret channel | MICT |
| 3 | Confirm the MySQL host-matching mode (`skip_name_resolve`) and create the matching account host | MICT |
| 4 | Confirm MySQL `utf8mb4` and strict SQL mode | MICT |
| 5 | Open only the required firewall paths; keep 3000 and 3306 private | MICT |
| 6 | Install Node.js 20.9+ and verify the absolute `npm` path for systemd | MICT |
| 7 | Create `/etc/cho-appointment/cho-appointment.env` with production values and restrictive permissions | MICT |
| 8 | Install the systemd unit and enable the service | MICT |
| 9 | Install the Nginx server block, TLS certificate, and confirm `X-Forwarded-For` is overwritten | MICT |
| 10 | Authorize and run the production migration; verify with `npm run db:verify` | MICT + CHO |
| 11 | Create the first administrator and store the credential in the approved password manager | CHO |
| 12 | Confirm backup, restore, retention, and monitoring policy | MICT |
| 13 | Decide whether to enable Turnstile and supply the Cloudflare keys | CHO + DPO |
| 14 | Confirm the public host name and TLS certificate match `APP_URL` and `NEXT_PUBLIC_APP_URL` | MICT + CHO |
| 15 | Confirm whether the application account remains DML-only after migrations | MICT |
| 16 | Run the post-deployment verification in §12 and record the result | MICT |

Until these actions are completed and recorded, the deployment should be
treated as prepared but not production-verified.
