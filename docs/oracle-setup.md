# Oracle Database Setup

The system supports two database backends, selected with `DB_PROVIDER`:

| Provider | Value | Notes |
|----------|-------|-------|
| Supabase (Postgres) | `DB_PROVIDER=supabase` | Default. Current behavior, unchanged. |
| Oracle | `DB_PROVIDER=oracle` | Requires Oracle 12c+ (identity columns). |

All runtime queries go through `/api/appointments`, which delegates to the
configured provider, so switching backends needs no code changes.

## 1. Create the schema

Run `docs/oracle-schema.sql` as your application user (SQL*Plus, SQL Developer,
or APEX SQL Workshop). It creates the `APPOINTMENTS` table plus indexes.

## 2. Configure environment variables

```bash
DB_PROVIDER=oracle
ORACLE_USER=cho_app
ORACLE_PASSWORD=<strong-password>
ORACLE_CONNECT_STRING=myhost:1521/ORCLPDB1
# Optional pool tuning (defaults shown)
ORACLE_POOL_MIN=1
ORACLE_POOL_MAX=4
```

`ORACLE_CONNECT_STRING` uses the Easy Connect format
`host:port/service_name`.

## 3. Thin vs thick mode

- **Thin mode (default):** pure JavaScript, no client libraries needed. Works on
  Vercel / serverless out of the box.
- **Thick mode:** only needed for advanced features (e.g. external auth).
  Set `ORACLE_CLIENT_LIB_DIR` to your Instant Client path. Thick mode does
  **not** work on Vercel serverless — use thin mode there.

## 4. Notes

- Boolean flags (`YAKAP_REGISTERED`, `PWD`, …) are stored as `NUMBER(1)`
  (`0`/`1`); the repository converts them automatically.
- `ID` is a numeric identity column. The API exposes it as a string, so the
  frontend and printable forms are unaffected.
- Dates are exchanged as `YYYY-MM-DD` strings.
- If Oracle is unreachable at runtime, API calls fail fast with a 500 and the
  error is logged server-side (no silent mock fallback — a mock would risk
  losing patient data).
