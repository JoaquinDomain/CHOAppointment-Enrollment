# Security Assessment and Hardening Report

**Application:** CHO Laboratory Appointment & Enrollment System (`CHOAppointment-Enrollment`)
**Scope of this document:** security posture of the application code, the controls that are
implemented, the controls that require deployment configuration or official approval, and the
known gaps that must be reviewed by the City Health Office (CHO) and the Data Protection
Officer (DPO).

Status labels used throughout:

| Label | Meaning |
| --- | --- |
| `FIXED` | The weakness was corrected in the application code during this review. |
| `VERIFIED` | The control was exercised by an automated test or a live request and passed. |
| `NEEDS CONFIGURATION` | The control exists in code but only takes effect once a deployment setting, secret, or proxy rule is supplied. |
| `NEEDS OFFICIAL REVIEW` | The behaviour depends on a policy, legal, or governance decision that CHO and the DPO must make. |
| `NOT IMPLEMENTED` | Deliberately not done; the reason is stated. |

No deployment, production configuration change, credential rotation, or database change was
performed as part of this review.

---

## 1. System overview

| Property | Value |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Data store | MySQL 8.0 through `mysql2/promise`, single connection pool |
| Authentication | Server-rendered session cookies backed by `admin_sessions` rows |
| Public surface | `/` booking form, `/appointment/status?token=…`, `/privacy`, `/robots.txt` |
| Administrative surface | `/admin/login`, `/admin`, `/api/admin/*` |

### Trust boundaries

1. **Internet → public routes.** Unauthenticated. Inputs are validated and rate limited
   server-side; the public booking endpoint additionally accepts an optional Turnstile token.
2. **Authenticated administrator → administrative routes.** Guarded by a session cookie, an
   origin check, and a CSRF token for state-changing requests.
3. **Application → MySQL.** Every statement is a prepared statement with bound parameters.

---

## 2. Vulnerabilities discovered

### 2.1 Patient identity data leaked into the application logs — `FIXED`

**Severity: High (confidentiality).**

The structured logger copied raw database error messages into the log stream. MySQL reports
duplicate-key failures as
`Duplicate entry 'Maria Cruz Santos-1990-01-15-09171234567' for key 'uq_patients_identity'`,
so every duplicate-patient event wrote a full identity tuple — name, birthdate, and mobile
number — into the server log, where it was visible to anyone with log access and to any log
aggregation or backup system.

*Correction:* `src/server/logging/logger.ts` now sanitises every error message and every
string metadata value through `sanitizeLogMessage()`, which removes duplicated tuple values,
e-mail addresses, Philippine mobile numbers, and government-style identifiers. The database
error code, SQL state, and error number are preserved so administrators keep the technical
detail they need. `tests/logger.test.ts` covers the behaviour.

### 2.2 Spreadsheet formula injection in the administrator CSV export — `FIXED`

**Severity: Medium (integrity of exported records).**

`escapeCsvCell()` in the administrator dashboard neutralised a leading `=`, `+`, `-`, or `@`,
but not a leading tab, carriage return, or line feed. Spreadsheet applications trim those
characters while parsing CSV, so a cell such as `\t=…` would have been evaluated as a formula
when the exported file was opened. The escaping logic was also embedded in a client
component and therefore had no automated coverage.

*Correction:* the escaping logic now lives in `src/lib/csv.ts` (`escapeCsvCell`,
`needsCsvEscaping`, `buildCsvDocument`), covers the whitespace-trigger variants, and is
covered by `tests/csv.test.ts`.

### 2.3 Password hashing cost could not be raised — `FIXED`

**Severity: Medium (resistance to offline cracking).**

Passwords were hashed with scrypt `N = 2^14, r = 8, p = 1`, which is the OWASP minimum. More
importantly, `verifyPassword()` compared the stored cost parameters with the constants used
for hashing and rejected any difference, so the parameters could never be increased without
locking every existing administrator out.

*Correction:* new hashes use scrypt `N = 2^16, r = 8, p = 2` (approximately 64 MiB of memory
per hash). Verification now parses the parameters out of the stored hash and accepts any set
within safe bounds (`N` 16384–262144, `r` 8–16, `p` 1–4, `N` a power of two, `128 · N · r`
below 256 MiB), so hashes created by earlier versions continue to verify. `scripts/create-admin.mjs`
was updated to produce hashes with the new parameters. Covered by `tests/password.test.ts`,
including an explicit legacy-hash compatibility case.

### 2.4 A single rate-limit bucket for the whole site when the client address is unknown — `FIXED`

**Severity: Medium (availability).**

Rate-limit identifiers were derived solely from the client network address. When the address
could not be resolved — `TRUST_PROXY=false`, a proxy that does not forward `X-Forwarded-For`,
or a missing header — every visitor collapsed into the single `unknown` bucket. One abusive
client could therefore lock out the entire public site, and conversely one client could not be
distinguished from any other.

*Correction:* `getRateLimitIdentifier()` in `src/server/http/request.ts` uses the client
address when it is available and otherwise falls back to a salted, non-identifying SHA-256
fingerprint of stable request headers. Unrelated visitors are kept in separate buckets. The
fingerprint can still be varied by a determined client, so `TRUST_PROXY=true` remains
required for reliable per-network limiting — see §7.

### 2.5 No human verification on the public booking form — `FIXED` (opt-in)

**Severity: Medium (automated abuse).**

The published Privacy Policy states that the public booking form uses Cloudflare Turnstile.
No such control existed in the application, so the policy overstated the implemented
safeguards and automated bookings were limited only by the rate limiter.

*Correction:* a complete, server-verified Turnstile implementation now exists
(`src/server/security/turnstile.ts`, `src/components/TurnstileWidget.tsx`). It is **disabled
by default** so that no deployment is broken by it, and it fails closed when enabled.
See §6.

### 2.6 Expired session rows were never removed — `FIXED`

**Severity: Low (data retention and hygiene).**

`admin_sessions` rows were only ever marked `revoked_at` or left in place; nothing removed
rows once they expired. The published policy states that session records are deleted
automatically when they expire, which was not true of the implementation.

*Correction:* `validateAdminSession()` triggers a bounded, opportunistic cleanup that deletes
at most 500 session rows more than a day past expiry. Live sessions are never touched.

### 2.7 Stale session cookies were left in the browser — `FIXED`

**Severity: Low (session confusion).**

The application supports two cookie names (`cho_admin_session` and the `__Host-` prefixed
production name). A browser could hold both, and only the newly issued one was overwritten on
sign-in, leaving an older token present in the client.

*Correction:* `setSessionCookies()` now clears the inactive cookie variant on every sign-in,
and a successful sign-in revokes the session that was previously active in that browser.

### 2.8 The health endpoint was unrated and disclosed database state — `FIXED`

**Severity: Low (information disclosure, resource use).**

`GET /api/health` was publicly reachable and unrated. It performs a database round trip on
every call, so it could be used to consume database connections or to probe availability.

*Correction:* the endpoint now applies a `health.read` rate limit of 30 requests per minute
per client identifier and returns `429` with a `Retry-After` header when the limit is
exceeded.

### 2.9 Reserved address characters were accepted in a stored field — `FIXED`

**Severity: Low (stored-content hardening).**

The residential address field accepted any printable character. Values are bound as query
parameters, so this was never a SQL injection, but it allowed quotes, semicolons, and angle
brackets to be persisted into a patient record that is later displayed, printed, and exported.

*Correction:* the address is now restricted to letters, marks, digits, spaces, and common
address punctuation (`.,'()-/ #&`). Names were already restricted to a letter/mark/punctuation
set.

### 2.10 Weaknesses considered and decisions taken

| Item | Decision and reason |
| --- | --- |
| Nonce-based Content Security Policy | Implemented in `src/proxy.ts`. A per-request nonce is generated and `script-src` uses `'self' 'nonce-…' 'strict-dynamic'` without `'unsafe-inline'`. `next.config.ts` deliberately does not send a second CSP header, because the browser would enforce the intersection of the two policies and reject the nonce-only script list. |
| Argon2id instead of scrypt | scrypt with `N = 2^16` meets the OWASP Password Storage Cheat Sheet. Adding a native Argon2 dependency would increase the supply-chain surface without a meaningful gain. |
| Record deletion endpoint | The published policy states that staff can delete appointment records through the dashboard, but no delete operation exists. Adding one is a data-governance decision (retention, legal hold, audit) and not a security fix, so it is raised in `docs/PRIVACY_POLICY_REVIEW.md` instead. |
| `secure` attribute on the CSRF cookie | The CSRF token must be readable by the dashboard script to be echoed in a request header. The cookie holds a random, non-secret, single-purpose token and is `Secure` in production. |
| Third-party bot protection beyond Turnstile | Only Turnstile was added, and only as an opt-in. No analytics, advertising, or tracking service was introduced. |

---

## 3. Authentication and session architecture

### 3.1 Password storage — `VERIFIED`

* Administrator passwords are hashed with scrypt using a 16-byte random salt and a 64-byte
  derived key, formatted as `scrypt$N$r$p$salt$hash`.
* New hashes use `N = 65536, r = 8, p = 2` with a 256 MiB memory ceiling.
* Verification compares the derived key with the stored key using `timingSafeEqual`.
* Hashes are self-describing, so the cost can be raised again without invalidating existing
  accounts.
* Minimum password length is 12 characters, maximum 200 characters.
* Plaintext passwords are never stored, logged, or returned by any endpoint.

### 3.2 Sign-in — `VERIFIED`

* `POST /api/admin/login` accepts only `application/json` bodies of at most 4 KiB.
* The request origin must be the application origin, and `Sec-Fetch-Site` must not be
  `cross-site`.
* Rate limits: 5 attempts per 15 minutes per client address, and 10 attempts per 15 minutes
  per username.
* Account lockout: after 5 failed attempts the account is locked for 15 minutes.
* **User enumeration is prevented.** An unknown username, an inactive account, and a wrong
  password all return the identical `Invalid username or password` response with the same
  status code, and the unknown-username and inactive-account paths perform a dummy hash
  verification so the response time does not reveal whether the account exists.
* Every sign-in attempt, success or failure, is written to the audit log with the requesting
  address stored only as a SHA-256 hash.

### 3.3 Sessions — `VERIFIED`

| Property | Implementation |
| --- | --- |
| Token generation | 32 random bytes from `crypto.randomBytes`, base64url encoded (256 bits of entropy) |
| Storage | Only the SHA-256 hash of the token is stored, in `admin_sessions.token_hash` (`CHAR(64)`, binary collation) |
| Cookie flags | `HttpOnly`, `Secure` in production, `SameSite=Strict`, `Path=/`, absolute expiry, `__Host-` prefix in production |
| Absolute expiry | `SESSION_TTL_HOURS` (default 8 hours), enforced in SQL against `UTC_TIMESTAMP()` |
| Idle expiry | Optional `SESSION_IDLE_TIMEOUT_MINUTES` (default `0`, disabled) — `NEEDS CONFIGURATION` |
| Server-side validation | Every administrative route resolves the cookie to a live, unrevoked, unexpired session belonging to an active account. Client-side state is never trusted. |
| Revocation on logout | `revoked_at` is set and both cookies are expired — `VERIFIED` |
| Fixation | A brand-new token is generated on every sign-in, and any session previously active in the same browser is revoked |

### 3.4 Cross-site request forgery — `VERIFIED`

* Every state-changing administrative request (`PATCH /api/admin/appointments/[id]`,
  `POST /api/admin/scan`, `POST /api/admin/logout`) requires the `x-csrf-token` header to
  match the `__Host-cho_csrf` / `cho_csrf` cookie. The comparison is constant-time.
* Every mutating route additionally validates the request origin and `Sec-Fetch-Site`.
* The public booking route requires `Content-Type: application/json`, which forces a CORS
  pre-flight for cross-origin requests, and validates the origin.

---

## 4. API and database protections

### 4.1 Parameterised queries — `VERIFIED`

Every statement in `src/server/appointments/mysql-appointments.ts` and
`src/server/auth/session.ts` is executed with `mysql2`'s `execute()` using `?` placeholders.
No user-supplied value is concatenated into SQL text. `tests/sql-injection.test.ts` asserts
this directly: an injected search term appears only in the bound parameter array and never in
the SQL string.

Schema changes are version-controlled in `mysql/migrations/` and applied by
`scripts/db-migrate.mjs`. Applied files are checksummed in `schema_migrations`; the runner
refuses to continue if an applied migration changed. The migration files contain no
user-supplied input.

### 4.2 Server-side validation — `VERIFIED`

`src/server/appointments/appointment.validation.ts` re-validates every field independently of
the browser: required fields, string types, length bounds, control characters, name and
address character sets, enumerated values, Philippine mobile and landline formats, twelve-digit
PhilHealth numbers, birthdate plausibility, weekday-only dates, Philippine holiday exclusion,
the configurable booking window, time-slot requirements, and the consent flag. Client-side
validation is treated purely as a convenience.

### 4.3 Authorisation and object-level access control — `VERIFIED`

* `GET /api/appointments`, `GET|PATCH /api/admin/appointments/[id]`, `POST /api/admin/scan`,
  and `GET /api/admin/check-auth` all require a valid administrator session.
* The fast-path guard in `src/proxy.ts` only checks for the presence of a cookie; the
  authoritative check is the server-side session lookup performed by each route and by
  `/admin` itself.
* Record identifiers are validated before use: a non-numeric appointment identifier and a
  malformed public identifier are rejected without a database round trip, so identifier
  enumeration cannot reach patient data.
* The public status page returns a masked patient name and no address, contact number, or
  coverage data.

### 4.4 Error handling — `VERIFIED`

* Unhandled errors produce `500` with the body `An unexpected error occurred` and a request
  identifier. Stack traces, SQL text, and driver messages are never returned.
* Database connectivity problems produce `503` with a fixed message.
* Validation and authorisation failures produce `400`, `401`, `403`, `404`, or `409` with
  messages that describe the problem without revealing internals.
* Sign-in failures never disclose whether an administrator account exists.

### 4.5 Secrets — `VERIFIED`

* `DB_PASSWORD`, `APP_SECRET`, `TURNSTILE_SECRET_KEY`, and the database host and name are
  read only from server-side environment variables.
* No secret is exposed through a `NEXT_PUBLIC_` variable. The `NEXT_PUBLIC_` variables in use
  are `APP_URL`, `ENVI_URL`, `TURNSTILE_SITE_KEY` (public by design), and the privacy
  contact details that the policy itself publishes.
* `.gitignore` excludes `.env`, `.env.*`, and every environment file except `.env.example`,
  along with `*.pem` and `*.tsbuildinfo`.

---

## 5. Patient data, QR codes, and exports

### 5.1 Data minimisation — `VERIFIED`

The public booking form collects the fields the service needs. The public status page and the
appointment QR code contain only a signed reference; the QR payload carries no name, no
medical information, and no free-text field.

### 5.2 QR verification — `VERIFIED`

* Tokens are HMAC-SHA256 signed with `APP_SECRET` and carry the public identifier plus an
  expiry.
* Verification happens on the server in `verifyAppointmentToken()`; the signature comparison
  is constant-time and the token format is validated before use.
* A scanned QR code is only accepted by an authenticated administrator, on a CSRF-protected
  route, and every scan is written to the audit log.
* Expiry is 30 days after the appointment date.
* The status token lives in a URL; `Referrer-Policy: strict-origin-when-cross-origin` keeps
  the query string out of cross-origin referrers, and the status route is served with
  `Cache-Control: no-store` and `X-Robots-Tag: noindex`.

### 5.3 Capacity and duplicate submissions — `VERIFIED`

* Capacity is reserved with a single conditional statement,
  `UPDATE … SET booked_count = booked_count + 1 WHERE … AND booked_count < ?`, executed inside
  a transaction. If the statement affects no row the booking is rejected with
  `CAPACITY_EXCEEDED`. Concurrent submissions therefore cannot exceed the daily limit.
* Duplicate bookings are prevented twice over: a `SELECT … FOR UPDATE` check inside the same
  transaction, and a unique generated column (`booking_guard`) in the `appointments` table
  that MySQL enforces.
* Covered by `tests/appointment-capacity.test.ts` (mocked boundary) and
  `tests/db/mysql.integration.test.ts` (real MySQL, skipped without a test database).

### 5.4 CSV export — `VERIFIED`

* The export is generated in the administrator browser from data already fetched through an
  authenticated endpoint, so no unauthenticated download path exists.
* The exported columns are deliberately limited to the reference, patient name, age,
  appointment date and time, facility, status, YAKAP flag, service, and creation time. The
  address, contact number, PhilHealth number, and household number are not exported.
* Every cell is neutralised against spreadsheet formula evaluation — see §2.2.

---

## 6. Rate limiting and automated abuse protection

Rate-limit counters are stored in the MySQL table `rate_limit_buckets`, so limits are shared
across every instance of the application and survive a restart. Expired buckets are removed
opportunistically.

| Scope | Limit | Window | Applies to |
| --- | --- | --- | --- |
| `admin.login.ip` | 5 | 15 min | Administrator sign-in, per client address |
| `admin.login.username` | 10 | 15 min | Administrator sign-in, per username |
| `appointment.create` | 10 | 10 min | Public appointment submission |
| `availability.read` | 180 | 1 min | Public availability lookup |
| `health.read` | 30 | 1 min | Health check |
| `admin.list` | 120 | 1 min | Administrator appointment list |
| `admin.detail` | 120 | 1 min | Administrator patient record read |
| `admin.status` | 60 | 1 min | Administrator status change |
| `admin.scan` | 60 | 1 min | QR check-in |

Identifiers are hashed with SHA-256 before being used as a bucket key, so the bucket table
never contains a network address.

### Cloudflare Turnstile — `NEEDS CONFIGURATION`

The server-side verification is implemented and fails closed:

* The secret key is read only from `TURNSTILE_SECRET_KEY` and is never sent to the browser.
* The public site key (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`) is embedded by the build and used
  only by the browser widget.
* A missing, malformed, expired, or duplicate token is rejected with `400`.
* A verification service outage is rejected with `503` — the endpoint never silently accepts
  an unverified submission.
* `TURNSTILE_ENABLED=true` requires both keys; the application refuses to start otherwise, so
  a partially configured deployment cannot accept unverified bookings.
* The Content Security Policy is extended with the Cloudflare origins automatically when the
  site key is present at build time.

**The control is off by default.** Enabling it requires Cloudflare account credentials and
CHO approval — see §9 and `docs/PRIVACY_POLICY_REVIEW.md`.

---

## 7. Security headers — `VERIFIED`

Static headers are configured in `next.config.ts`. The Content Security Policy is
issued by `src/proxy.ts` with a per-request nonce so that `script-src` does not need
`'unsafe-inline'`.

| Header | Value |
| --- | --- |
| `Content-Security-Policy` | `default-src 'self'`; `script-src 'self' 'nonce-<per-request>' 'strict-dynamic'` (production; `'unsafe-eval'` is added only in development); `style-src 'self' 'unsafe-inline'`; `script-src-attr 'none'`; `style-src-attr 'unsafe-inline'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`; `frame-src 'self'`; `img-src 'self' data: blob:`; `font-src 'self' data:`; `connect-src 'self'`; `media-src 'self' blob:`; `worker-src 'self' blob:`; `manifest-src 'self'`; `upgrade-insecure-requests` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` (production only) |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(self), microphone=(), geolocation=(), payment=(), usb=()` — the QR scanner is the only feature needing the camera |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `X-DNS-Prefetch-Control` | `off` |
| `X-Permitted-Cross-Domain-Policies` | `none` |
| `Cache-Control` | `no-store, max-age=0` on `/admin`, `/api/*`, and `/appointment/status` |
| `X-Robots-Tag` | `noindex, nofollow, noarchive, nosnippet` on `/admin`, `/api/*`, and `/appointment/status` |

`src/app/robots.ts` additionally disallows `/admin`, `/api/`, and `/appointment/status`.

---

## 8. Environment variables

### Required in production

| Variable | Purpose |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection. `DB_NAME` is restricted to letters, digits, and underscores. |
| `APP_URL` | Public origin used for QR links. Must be `https://` in production. |
| `APP_SECRET` | HMAC secret for QR tokens; at least 32 characters. Rotating it invalidates every outstanding QR code. |
| `NEXT_PUBLIC_APP_URL` | Public origin used for the site QR poster and canonical metadata. |

The application refuses to start in production when these are missing or invalid
(`src/instrumentation.ts`).

### Strongly recommended

| Variable | Default | Purpose |
| --- | --- | --- |
| `TRUST_PROXY` | `true` in production | Trust `X-Forwarded-For` / `X-Real-IP`. **The proxy must overwrite, not append to, these headers**, otherwise a client can spoof its address and evade per-address rate limits. |
| `COOKIE_SECURE` | `true` in production | Enables `__Host-` cookies. Must be `true` behind HTTPS. |
| `SESSION_TTL_HOURS` | `8` | Absolute administrator session lifetime. |
| `SESSION_IDLE_TIMEOUT_MINUTES` | `0` (disabled) | Optional idle timeout for administrator sessions. |
| `APPOINTMENT_BOOKING_WINDOW_DAYS` | `365` | How far ahead patients may book. |
| `CONSENT_VERSION` | `v1` | Consent version recorded with every booking. Bump when the consent text changes. |
| `DB_VERIFY_ON_STARTUP` | `true` | Verify the database and required tables at startup. |
| `DB_SSL`, `DB_SSL_REJECT_UNAUTHORIZED`, `DB_SSL_CA` | `false`, `true`, unset | TLS to a managed MySQL instance. |
| `DB_CONNECTION_LIMIT`, `DB_CONNECT_TIMEOUT_MS`, `DB_ACQUIRE_TIMEOUT_MS` | `10`, `10000`, `15000` | Pool sizing, connect timeout, and maximum wait for a pooled connection. |

### Optional

| Variable | Purpose |
| --- | --- |
| `TURNSTILE_ENABLED` | Enables human verification on the public booking form. Off by default. |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key. Server-side only. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key. Public by design. |
| `ALLOWED_ORIGINS` | Extra comma-separated origins permitted to make mutating requests. |
| `NEXT_PUBLIC_ENVI_URL` | External ENVI System URL for health certificates. |
| `NEXT_PUBLIC_PRIVACY_*` | Privacy notice contact details; blank values fall back to the details published in the official policy. |

---

## 9. Deployment considerations — `NEEDS CONFIGURATION`

1. **The reverse proxy must overwrite `X-Forwarded-For`.** If it appends, a client can supply
   an arbitrary address and defeat the per-address rate limits and the audit trail. This is
   the single most important deployment requirement for this application.
2. **Serve everything over HTTPS** and keep `COOKIE_SECURE=true`, otherwise the `__Host-`
   cookies will not be issued.
3. **The public site URL must match the official policy host.** The policy is published at
   `https://cho-laboratory-services-appointment.bacolodcity.gov.ph/privacy-policy`, while the
   application's default `APP_URL` is
   `https://cho-appointment-services.bacolodcity.gov.ph`. The site QR poster renders
   `NEXT_PUBLIC_APP_URL`, so the printed poster must point at the address patients are
   actually served from.
4. **Do not run the administrative portal on a shared origin** with unrelated applications.
   `SameSite=Strict` protects the session, but a dedicated origin removes any doubt.
5. **Rotate `APP_SECRET` and administrator passwords** after the review. The scrypt cost
   increase means newly issued passwords are hashed with the stronger parameters; existing
   hashes remain valid and are transparently upgraded at the next successful sign-in.
6. **Restrict MySQL network access** so the database is not reachable from the public
   internet, and use a dedicated least-privilege application account. Runtime needs only
   `SELECT, INSERT, UPDATE, DELETE`; grant `CREATE, ALTER, INDEX, REFERENCES` only while a
   migration is applied. See `docs/MICT_DEPLOYMENT.md` and
   `mysql/mict-database-setup.example.sql`.
7. **Enable `DB_SSL`** when the database is hosted by a managed provider. Keep
   `DB_SSL_REJECT_UNAUTHORIZED=true` and install the CA rather than disabling verification.
8. **Configure log retention and access control** so that the audit trail and the application
   log are protected, since the audit trail records who accessed which patient record.
9. **Set `SESSION_IDLE_TIMEOUT_MINUTES`** if the CHO requires an inactivity limit for shared
   workstations.
10. **Apply schema changes only through the migration runner** after a verified backup:
    `npm run db:migrate`, then `npm run db:verify`. Never edit an applied migration; the runner
    rejects checksum changes. See `docs/DATABASE_MIGRATION.md`.

---

## 10. Verification performed

All commands were executed from the repository root on Node.js 24.21.0 / npm 11.19.0.

| Check | Command | Result |
| --- | --- | --- |
| TypeScript | `npm run typecheck` | Passed — no errors |
| ESLint | `npm run lint` | Passed — no errors, no warnings |
| Unit and mocked-boundary tests | `npm test` | Passed — 17 files, 124 tests |
| Real MySQL integration tests | `npm run test:db` | Skipped — 1 file, 13 tests; no MySQL server is available in this environment |
| Production build | `npm run build` | Passed — all routes compiled, TypeScript passed, 2 static routes prerendered |
| Runtime headers | production server on `127.0.0.1:3111`, `GET /privacy` | All headers in §7 present with the expected values |
| Runtime CSP nonce | production server on `127.0.0.1:3111`, `GET /privacy` | `script-src` contained `'nonce-…' 'strict-dynamic'` and no `'unsafe-inline'`; `X-Frame-Options: DENY` and `Referrer-Policy: strict-origin-when-cross-origin` present |
| Runtime privacy link | `GET /`, `/admin/login`, `/privacy` | `Read the Privacy Policy` and the exact official URL present in the rendered HTML on every page, with `rel="noopener noreferrer external"` |
| Runtime authorisation | `GET /api/appointments` without a session | `401` with `{"error":"Authentication required","code":"UNAUTHORIZED","requestId":"…"}` — no patient data in the body |
| Runtime fail-closed database behaviour | `GET /api/health` with no reachable database | `503`, no internal detail |
| Crawler directives | `GET /robots.txt` | Disallows `/admin`, `/api/`, `/appointment/status` |
| Dependency audit | `npm audit --omit=dev` | 0 vulnerabilities |
| Dependency audit | `npm audit` | 0 vulnerabilities — a scoped `overrides` entry pins `minimatch` to `^11.0.1` inside `@typescript-eslint/typescript-estree`, which removes the 7 moderate `globparts` amplification advisories that were present in the development toolchain. The production dependency tree was never affected. |

### Test coverage added by this review

| File | Focus |
| --- | --- |
| `tests/session.test.ts` | Token hashing, expiry and revocation conditions, idle timeout, logout revocation, CSRF accept/reject |
| `tests/api-authorization.test.ts` | `401` on every protected endpoint, `403` on CSRF failure and cross-site origins, `no-store` on failures |
| `tests/sql-injection.test.ts` | Bound parameters, rejection of injection payloads, identifier validation before any query |
| `tests/appointment-capacity.test.ts` | Conditional capacity reservation, capacity exhaustion, duplicate booking rejection, unique-constraint mapping |
| `tests/turnstile.test.ts` | Secret handling, rejection of invalid tokens, fail-closed on service outage, disabled-mode no-op |
| `tests/csv.test.ts` | Formula-trigger neutralisation including the whitespace variants |
| `tests/logger.test.ts` | Removal of patient identity values from database error messages |
| `tests/request-security.test.ts` | Origin validation, body limits, client address handling, rate-limit identifier separation |
| `tests/privacy-policy-link.test.ts` | Exact URL and label, presence in all four required locations, no competing consent checkbox |
| `tests/password.test.ts` (extended) | New cost parameters, legacy-hash compatibility, out-of-range parameter rejection |
| `tests/validation.test.ts` (extended) | SQL and script payloads in free-text fields, control characters, wrong types, booking window |
| `tests/migrations.test.ts` | Migration naming, no destructive SQL, required tables, utf8mb4, no `CREATE DATABASE`/`USE` |
| `tests/db/mysql.integration.test.ts` | Real MySQL connection/pool, startup verification, enrollment/consent/appointment persistence, status history, admin sessions, transaction rollback, duplicate and concurrent booking, pool recovery, parameter binding, optional strict-privilege DDL denial |

**Not executed:** no test ran against a live MySQL instance in this environment. The capacity,
duplicate booking, and transaction behaviour was verified against a mocked database boundary
that reproduces the conditional-update semantics, not against a real server. A real MySQL 8.0
integration suite now exists (`npm run test:db`), but it was skipped because no test database
is available here. Real contention remains unverified until MICT runs the suite against a
disposable MySQL 8.0 database — `NEEDS CONFIGURATION`.

---

## 11. Remaining risks

| # | Risk | Label |
| --- | --- | --- |
| 1 | The published Privacy Policy does not describe every field this application collects, and describes several features it does not have. | `NEEDS OFFICIAL REVIEW` |
| 2 | Turnstile is implemented but disabled; the published policy already claims it is active. | `NEEDS CONFIGURATION` |
| 3 | A destructive record-deletion capability does not exist, so a data-subject erasure request cannot be fulfilled through the dashboard. | `NEEDS OFFICIAL REVIEW` |
| 4 | The reverse proxy must not add a second `Content-Security-Policy` header; the browser would enforce the intersection and reject the application's nonce-only `script-src`. | `NEEDS CONFIGURATION` |
| 5 | Rate-limit identifier accuracy depends on the proxy overwriting `X-Forwarded-For`. | `NEEDS CONFIGURATION` |
| 6 | A real MySQL integration suite exists but was skipped here; concurrent capacity reservation has not been exercised against a live server. | `NEEDS CONFIGURATION` |
| 7 | The `typescript-eslint` / `minimatch` advisories in the development toolchain were resolved with a scoped `overrides` entry. There is no stable upstream `typescript-eslint` release yet that removes the advisory at its source, so the override should be revisited when one is published. | `NEEDS CONFIGURATION` |
| 8 | No automated penetration test, dependency pinning policy, or SAST pipeline is in place. | `NEEDS OFFICIAL REVIEW` |
| 9 | The administrator CSV export is generated in the browser, so exported copies exist outside the system's access control. The published policy acknowledges this and subjects the copies to City records rules. | `NEEDS OFFICIAL REVIEW` |

---

## 12. Privacy Policy mismatches

The full comparison of the published policy against the running application is in
[`docs/PRIVACY_POLICY_REVIEW.md`](./PRIVACY_POLICY_REVIEW.md). It lists the personal
information the application collects but the policy does not describe, the features the
policy describes but the application does not implement, and the changes the City Health
Office and the Data Protection Officer must decide on before the policy is amended.

The application now links to the official policy from the booking form, the enrolment form,
the public footer, and the administrator login page, using the exact label
**Read the Privacy Policy** and the exact published address.
