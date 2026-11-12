import { existsSync, readFileSync } from 'node:fs'

/**
 * Loads .env.local and .env without overriding values that are already set in
 * the process environment. This mirrors the behaviour of the application's
 * deployment configuration and keeps local maintenance scripts convenient.
 */
export function loadEnvFiles(files = ['.env.local', '.env']) {
  for (const file of files) {
    if (!existsSync(file)) continue
    const content = readFileSync(file, 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(trimmed)
      if (!match) continue
      const [, key, rawValue] = match
      if (process.env[key] !== undefined) continue
      let value = rawValue.trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    }
  }
}

export function requiredEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export function readBoolean(name, fallback = false) {
  const value = process.env[name]?.trim().toLowerCase()
  if (!value) return fallback
  if (['true', '1', 'yes'].includes(value)) return true
  if (['false', '0', 'no'].includes(value)) return false
  throw new Error(`${name} must be true or false`)
}

export function readPositiveInteger(name, fallback, min, max) {
  const raw = process.env[name]
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`)
  }
  return value
}

function readSslCa() {
  const value = process.env.DB_SSL_CA?.trim()
  if (!value) return undefined
  if (value.includes('BEGIN CERTIFICATE')) return value
  if (!existsSync(value)) {
    throw new Error('DB_SSL_CA must be a readable PEM file path or an inline PEM certificate')
  }
  return readFileSync(value, 'utf8')
}

/**
 * Builds mysql2 connection options from DB_* environment variables.
 *
 * The returned object never contains a log-safe representation of the
 * password. Use describeDatabaseTarget() for user-facing status output.
 */
export function databaseOptions({ multipleStatements = false } = {}) {
  const database = requiredEnv('DB_NAME')
  if (!/^[A-Za-z0-9_]+$/.test(database)) {
    throw new Error('DB_NAME may only contain letters, numbers, and underscores')
  }

  const options = {
    host: requiredEnv('DB_HOST'),
    port: readPositiveInteger('DB_PORT', 3306, 1, 65535),
    user: requiredEnv('DB_USER'),
    password: requiredEnv('DB_PASSWORD'),
    database,
    charset: 'utf8mb4',
    timezone: 'Z',
    multipleStatements,
  }

  if (readBoolean('DB_SSL')) {
    const ca = readSslCa()
    options.ssl = {
      rejectUnauthorized: readBoolean('DB_SSL_REJECT_UNAUTHORIZED', true),
      ...(ca ? { ca } : {}),
    }
  }

  return options
}

export function describeDatabaseTarget(options) {
  return `${options.user}@${options.host}:${options.port}/${options.database}`
}
