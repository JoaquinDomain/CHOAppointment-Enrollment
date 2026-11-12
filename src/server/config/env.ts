import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'

export interface DatabaseConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
  connectionLimit: number
  connectTimeoutMs: number
  acquireTimeoutMs: number
  ssl: false | { rejectUnauthorized: boolean; ca?: string }
  verifyOnStartup: boolean
}

export interface AppConfig {
  appUrl: string
  appSecret: string
  nodeEnv: 'development' | 'test' | 'production'
  isProduction: boolean
  sessionTtlHours: number
  sessionIdleTimeoutMinutes: number
  bookingWindowDays: number
  consentVersion: string
  trustProxy: boolean
  cookieSecure: boolean
  turnstileEnabled: boolean
  turnstileSecretKey: string
  turnstileSiteKey: string
}

let developmentSecret: string | null = null

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function readPositiveInteger(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Environment variable ${name} must be an integer between ${min} and ${max}`)
  }
  return value
}

function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase()
  if (!raw) return fallback
  if (['true', '1', 'yes'].includes(raw)) return true
  if (['false', '0', 'no'].includes(raw)) return false
  throw new Error(`Environment variable ${name} must be true or false`)
}

function getNodeEnv(): AppConfig['nodeEnv'] {
  const value = process.env.NODE_ENV
  if (value === 'production' || value === 'test') return value
  return 'development'
}

/**
 * DB_SSL_CA accepts either an inline PEM certificate or a path to a PEM file.
 * mysql2 expects the certificate contents, not a path, so a path is read here
 * and a missing/unreadable file fails startup with a clear message.
 */
function readSslCa(): string | undefined {
  const value = process.env.DB_SSL_CA?.trim()
  if (!value) return undefined
  if (value.includes('BEGIN CERTIFICATE')) return value
  if (!existsSync(value)) {
    throw new Error('DB_SSL_CA must be a readable PEM file path or an inline PEM certificate')
  }
  return readFileSync(value, 'utf8')
}

export function isProduction(): boolean {
  return getNodeEnv() === 'production'
}

export function getDatabaseConfig(): DatabaseConfig {
  const database = required('DB_NAME')
  if (!/^[A-Za-z0-9_]+$/.test(database)) {
    throw new Error('DB_NAME may only contain letters, numbers, and underscores')
  }

  const port = readPositiveInteger('DB_PORT', 3306, 1, 65535)
  const connectionLimit = readPositiveInteger('DB_CONNECTION_LIMIT', 10, 1, 100)
  const connectTimeoutMs = readPositiveInteger('DB_CONNECT_TIMEOUT_MS', 10000, 1000, 60000)
  const acquireTimeoutMs = readPositiveInteger('DB_ACQUIRE_TIMEOUT_MS', 15000, 1000, 120000)

  let ssl: DatabaseConfig['ssl'] = false
  if (readBoolean('DB_SSL', false)) {
    ssl = {
      rejectUnauthorized: readBoolean('DB_SSL_REJECT_UNAUTHORIZED', true),
      ca: readSslCa(),
    }
  }

  return {
    host: required('DB_HOST'),
    port,
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    database,
    connectionLimit,
    connectTimeoutMs,
    acquireTimeoutMs,
    ssl,
    verifyOnStartup: readBoolean('DB_VERIFY_ON_STARTUP', true),
  }
}

export function getAppConfig(): AppConfig {
  const nodeEnv = getNodeEnv()
  const isProd = nodeEnv === 'production'
  const appUrl = (process.env.APP_URL || (isProd ? '' : 'http://localhost:3000')).replace(/\/+$/, '')

  if (!appUrl) throw new Error('Missing required environment variable: APP_URL')
  if (isProd && !appUrl.startsWith('https://')) {
    throw new Error('APP_URL must use HTTPS in production')
  }

  let appSecret = process.env.APP_SECRET?.trim() || ''
  if (appSecret.length < 32) {
    if (isProd) {
      throw new Error('APP_SECRET must be at least 32 characters in production')
    }
    if (!developmentSecret) {
      developmentSecret = randomBytes(48).toString('base64url')
      console.warn('[config] APP_SECRET is not set; using an ephemeral development secret.')
    }
    appSecret = developmentSecret
  }

  const turnstileEnabled = readBoolean('TURNSTILE_ENABLED', false)
  const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY?.trim() || ''
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || ''

  if (turnstileEnabled && !turnstileSecretKey) {
    throw new Error('TURNSTILE_SECRET_KEY is required when TURNSTILE_ENABLED is true')
  }

  if (turnstileEnabled && !turnstileSiteKey) {
    throw new Error(
      'NEXT_PUBLIC_TURNSTILE_SITE_KEY is required when TURNSTILE_ENABLED is true, otherwise the browser cannot present the verification widget'
    )
  }

  return {
    appUrl,
    appSecret,
    nodeEnv,
    isProduction: isProd,
    sessionTtlHours: readPositiveInteger('SESSION_TTL_HOURS', 8, 1, 168),
    sessionIdleTimeoutMinutes: readPositiveInteger('SESSION_IDLE_TIMEOUT_MINUTES', 0, 0, 720),
    bookingWindowDays: readPositiveInteger('APPOINTMENT_BOOKING_WINDOW_DAYS', 365, 1, 730),
    consentVersion: (process.env.CONSENT_VERSION || 'v1').trim(),
    trustProxy: readBoolean('TRUST_PROXY', isProd),
    cookieSecure: readBoolean('COOKIE_SECURE', isProd),
    turnstileEnabled,
    turnstileSecretKey,
    turnstileSiteKey,
  }
}

export function getPrivacyConfig() {
  return {
    officerName: process.env.NEXT_PUBLIC_PRIVACY_OFFICER_NAME?.trim() || '',
    contactEmail: process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL?.trim() || '',
    contactPhone: process.env.NEXT_PUBLIC_PRIVACY_CONTACT_PHONE?.trim() || '',
    retentionSummary: process.env.NEXT_PUBLIC_RETENTION_POLICY_SUMMARY?.trim() || '',
  }
}

export function getAllowedOrigins(): string[] {
  const config = getAppConfig()
  const origins = new Set<string>([config.appUrl])
  if (!config.isProduction) {
    origins.add('http://localhost:3000')
    origins.add('http://127.0.0.1:3000')
  }
  const extra = process.env.ALLOWED_ORIGINS?.split(',') ?? []
  for (const origin of extra) {
    const trimmed = origin.trim().replace(/\/+$/, '')
    if (trimmed) origins.add(trimmed)
  }
  return [...origins]
}

export function validateServerEnv(): void {
  const config = getAppConfig()
  const database = getDatabaseConfig()
  if (database.connectionLimit < 2) {
    throw new Error('DB_CONNECTION_LIMIT must be at least 2')
  }
  if (!config.consentVersion) {
    throw new Error('CONSENT_VERSION must not be empty')
  }
}

export function getStartupSummary(): Record<string, string> {
  const config = getAppConfig()
  const database = getDatabaseConfig()
  return {
    environment: config.nodeEnv,
    appUrl: config.appUrl,
    databaseHost: database.host,
    databaseName: database.database,
    databaseSsl: database.ssl ? 'enabled' : 'disabled',
  }
}
