import { execFile } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import mysql, { type Pool } from 'mysql2/promise'

const execFileAsync = promisify(execFile)

export const testDatabase = {
  host: process.env.DB_TEST_HOST?.trim() || '',
  port: Number(process.env.DB_TEST_PORT || 3306),
  user: process.env.DB_TEST_USER?.trim() || '',
  password: process.env.DB_TEST_PASSWORD ?? '',
  database: process.env.DB_TEST_NAME?.trim() || '',
}

export const hasTestDatabase = Boolean(
  testDatabase.host && testDatabase.user && testDatabase.database
)

export function assertTestDatabaseSafety(): void {
  if (!hasTestDatabase) {
    throw new Error(
      'DB_TEST_HOST, DB_TEST_USER, and DB_TEST_NAME are required for MySQL integration tests.'
    )
  }
  if (!/test|ci|integration/i.test(testDatabase.database)) {
    throw new Error(
      `Refusing to run destructive integration tests against "${testDatabase.database}". ` +
        'DB_TEST_NAME must contain "test", "ci", or "integration".'
    )
  }
  if (process.env.DB_TEST_CONFIRM !== 'yes') {
    throw new Error(
      'Set DB_TEST_CONFIRM=yes to acknowledge that the integration suite drops and recreates tables in the dedicated test database.'
    )
  }
}

function sslOptions() {
  if (process.env.DB_TEST_SSL !== 'true') return undefined
  const caValue = process.env.DB_TEST_SSL_CA?.trim()
  const ca =
    caValue && !caValue.includes('BEGIN CERTIFICATE')
      ? readFileSync(caValue, 'utf8')
      : caValue
  return {
    rejectUnauthorized: process.env.DB_TEST_SSL_REJECT_UNAUTHORIZED !== 'false',
    ...(ca ? { ca } : {}),
  }
}

export function createTestPool(connectionLimit = 10): Pool {
  return mysql.createPool({
    host: testDatabase.host,
    port: testDatabase.port,
    user: testDatabase.user,
    password: testDatabase.password,
    database: testDatabase.database,
    connectionLimit,
    waitForConnections: true,
    charset: 'utf8mb4',
    timezone: 'Z',
    ssl: sslOptions(),
  })
}

/**
 * Copies the dedicated test database settings into the application's DB_*
 * variables. This is what lets the real repository, auth, and pool code run
 * against the test database instead of a development database.
 */
export function pointApplicationAtTestDatabase(): void {
  process.env.DB_HOST = testDatabase.host
  process.env.DB_PORT = String(testDatabase.port)
  process.env.DB_USER = testDatabase.user
  process.env.DB_PASSWORD = testDatabase.password
  process.env.DB_NAME = testDatabase.database
  process.env.DB_SSL = process.env.DB_TEST_SSL === 'true' ? 'true' : 'false'
  if (process.env.DB_TEST_SSL_CA) process.env.DB_SSL_CA = process.env.DB_TEST_SSL_CA
  process.env.DB_SSL_REJECT_UNAUTHORIZED =
    process.env.DB_TEST_SSL_REJECT_UNAUTHORIZED ?? 'true'
  process.env.DB_CONNECTION_LIMIT = process.env.DB_TEST_CONNECTION_LIMIT ?? '10'
  process.env.DB_CONNECT_TIMEOUT_MS = '5000'
  process.env.DB_ACQUIRE_TIMEOUT_MS = '10000'
  process.env.DB_VERIFY_ON_STARTUP = 'false'
  process.env.APP_URL = 'https://example.test'
  process.env.APP_SECRET = 'integration-test-secret-that-is-at-least-32-characters'
  process.env.COOKIE_SECURE = 'false'
  process.env.TRUST_PROXY = 'false'
}

const DATA_TABLES = [
  'consent_records',
  'appointment_status_history',
  'appointments',
  'service_daily_capacity',
  'admin_sessions',
  'audit_logs',
  'rate_limit_buckets',
  'patients',
  'administrators',
]

const SCHEMA_TABLES = [
  ...DATA_TABLES,
  'laboratory_services',
  'schema_migrations',
]

export async function dropTestSchema(pool: Pool): Promise<void> {
  assertTestDatabaseSafety()
  const connection = await pool.getConnection()
  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0')
    for (const table of SCHEMA_TABLES) {
      await connection.query(`DROP TABLE IF EXISTS \`${table}\``)
    }
  } finally {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => undefined)
    connection.release()
  }
}

export async function resetTestDatabase(pool: Pool): Promise<void> {
  assertTestDatabaseSafety()
  const connection = await pool.getConnection()
  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0')
    for (const table of DATA_TABLES) {
      await connection.query(`TRUNCATE TABLE \`${table}\``)
    }
  } finally {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => undefined)
    connection.release()
  }
}

/**
 * Drops and recreates the schema by running the production migration runner
 * against the test database. This exercises the same migration path used by
 * MICT instead of a separate test-only schema.
 */
export async function migrateTestDatabase(): Promise<void> {
  assertTestDatabaseSafety()

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'test',
    DB_HOST: testDatabase.host,
    DB_PORT: String(testDatabase.port),
    DB_USER: testDatabase.user,
    DB_PASSWORD: testDatabase.password,
    DB_NAME: testDatabase.database,
    DB_SSL: process.env.DB_TEST_SSL === 'true' ? 'true' : 'false',
    DB_SSL_REJECT_UNAUTHORIZED:
      process.env.DB_TEST_SSL_REJECT_UNAUTHORIZED ?? 'true',
    ...(process.env.DB_TEST_SSL_CA ? { DB_SSL_CA: process.env.DB_TEST_SSL_CA } : {}),
  }

  await execFileAsync(process.execPath, ['scripts/db-migrate.mjs', 'up'], {
    cwd: path.resolve('.'),
    env,
    timeout: 120_000,
  })
}

export function migrationFiles(): string[] {
  return readdirSync(path.resolve('mysql', 'migrations'))
    .filter(file => file.endsWith('.sql'))
    .sort()
}
