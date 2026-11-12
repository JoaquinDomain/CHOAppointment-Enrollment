import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import type { NextRequest, NextResponse } from 'next/server'
import type { RowDataPacket } from 'mysql2/promise'
import { getAppConfig } from '@/server/config/env'
import { dbExecute, dbQuery } from '@/server/db/mysql'
import {
  AccountLockedError,
  ForbiddenError,
  UnauthorizedError,
} from '@/server/errors'
import { logError } from '@/server/logging/logger'
import {
  hashPassword,
  needsPasswordRehash,
  verifyAgainstDummyHash,
  verifyPassword,
} from './password'
import { writeAuditLog } from './audit'

export type AdminRole = 'admin' | 'superadmin'

export interface AdminSession {
  sessionId: number
  adminId: number
  username: string
  role: AdminRole
  expiresAt: Date
}

interface AdminRow extends RowDataPacket {
  id: number
  username: string
  password_hash: string
  role: AdminRole
  is_active: number
  failed_login_count: number
  locked_until: string | null
}

interface SessionRow extends RowDataPacket {
  session_id: number
  admin_id: number
  username: string
  role: AdminRole
  expires_at: string
  last_seen_at: string | null
}

interface AuthMetadata {
  ip: string
  userAgent: string
  requestId: string
}

const SESSION_COOKIE_DEV = 'cho_admin_session'
const SESSION_COOKIE_PROD = '__Host-cho_admin_session'
const CSRF_COOKIE_DEV = 'cho_csrf'
const CSRF_COOKIE_PROD = '__Host-cho_csrf'
const MAX_LOGIN_FAILURES = 5
const ACCOUNT_LOCK_MINUTES = 15

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function parseDatabaseDate(value: string): Date {
  return new Date(`${value.replace(' ', 'T')}Z`)
}

function safeTokenEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8')
  const rightBuffer = Buffer.from(right, 'utf8')
  return (
    leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
  )
}

export function getSessionCookieName(): string {
  return getAppConfig().cookieSecure ? SESSION_COOKIE_PROD : SESSION_COOKIE_DEV
}

export function getCsrfCookieName(): string {
  return getAppConfig().cookieSecure ? CSRF_COOKIE_PROD : CSRF_COOKIE_DEV
}

function getSessionCookieCandidates(): string[] {
  return [getSessionCookieName(), SESSION_COOKIE_PROD, SESSION_COOKIE_DEV]
}

function getCsrfCookieCandidates(): string[] {
  return [getCsrfCookieName(), CSRF_COOKIE_PROD, CSRF_COOKIE_DEV]
}

export async function getSessionTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies()
  for (const name of getSessionCookieCandidates()) {
    const value = cookieStore.get(name)?.value
    if (value) return value
  }
  return null
}

export async function validateAdminSession(token: string): Promise<AdminSession | null> {
  if (!token || token.length > 256) return null

  const idleTimeoutMinutes = getAppConfig().sessionIdleTimeoutMinutes

  const rows = await dbQuery<SessionRow[]>(
    `SELECT s.id AS session_id, s.admin_id, a.username, a.role, s.expires_at, s.last_seen_at
       FROM admin_sessions s
       INNER JOIN administrators a ON a.id = s.admin_id
      WHERE s.token_hash = ?
        AND s.revoked_at IS NULL
        AND s.expires_at > UTC_TIMESTAMP()
        AND a.is_active = 1
        ${
          idleTimeoutMinutes > 0
            ? 'AND (s.last_seen_at IS NULL OR s.last_seen_at > UTC_TIMESTAMP() - INTERVAL ? MINUTE)'
            : ''
        }
      LIMIT 1`,
    idleTimeoutMinutes > 0 ? [hashToken(token), idleTimeoutMinutes] : [hashToken(token)]
  )

  const row = rows[0]
  if (!row) return null

  void dbExecute(
    `UPDATE admin_sessions
        SET last_seen_at = UTC_TIMESTAMP()
      WHERE id = ?
        AND (last_seen_at IS NULL OR last_seen_at < UTC_TIMESTAMP() - INTERVAL 5 MINUTE)`,
    [row.session_id]
  ).catch(error => logError('auth.last_seen_update_failed', error))

  void cleanupExpiredSessions()

  return {
    sessionId: Number(row.session_id),
    adminId: Number(row.admin_id),
    username: row.username,
    role: row.role,
    expiresAt: parseDatabaseDate(row.expires_at),
  }
}

const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000
let lastSessionCleanupAt = 0

/**
 * Removes session rows that expired more than a day ago.
 *
 * The cleanup is opportunistic, bounded, and rate limited to at most once per
 * hour so that it never turns every administrative request into a write. Live
 * sessions are never touched.
 */
function cleanupExpiredSessions(): void {
  const now = Date.now()
  if (now - lastSessionCleanupAt < SESSION_CLEANUP_INTERVAL_MS) return
  lastSessionCleanupAt = now

  void dbExecute(
    `DELETE FROM admin_sessions
        WHERE expires_at < UTC_TIMESTAMP() - INTERVAL 1 DAY
        LIMIT 500`
  ).catch(error => logError('auth.session_cleanup_failed', error))
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = await getSessionTokenFromCookies()
  if (!token) return null
  return validateAdminSession(token)
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession()
  if (!session) throw new UnauthorizedError()
  return session
}

export function requireAdminRole(
  session: AdminSession,
  roles: readonly AdminRole[]
): void {
  if (!roles.includes(session.role)) {
    throw new ForbiddenError()
  }
}

export function assertCsrfToken(request: NextRequest): void {
  const headerToken = request.headers.get('x-csrf-token')?.trim()
  let cookieToken: string | undefined
  for (const name of getCsrfCookieCandidates()) {
    cookieToken = request.cookies.get(name)?.value
    if (cookieToken) break
  }

  if (!headerToken || !cookieToken || !safeTokenEqual(headerToken, cookieToken)) {
    throw new ForbiddenError('Invalid or missing CSRF token')
  }
}

export async function revokeAdminSession(token: string | null): Promise<void> {
  if (!token) return
  await dbExecute(
    `UPDATE admin_sessions
        SET revoked_at = UTC_TIMESTAMP()
      WHERE token_hash = ?
        AND revoked_at IS NULL`,
    [hashToken(token)]
  )
}

interface CreatedSession {
  token: string
  csrfToken: string
  expiresAt: Date
  session: AdminSession
}

/**
 * Re-hashes a successful sign-in password with the current cost parameters.
 *
 * Hashes written by an earlier version of this application are protected by
 * weaker work factors. They stay verifiable so that no administrator is
 * locked out, and they are upgraded transparently the first time the owner
 * signs in.
 *
 * The upgrade is best effort: a failure is logged and never blocks the sign-in.
 */
async function upgradePasswordHashIfNeeded(
  admin: AdminRow,
  password: string,
  metadata: AuthMetadata
): Promise<void> {
  if (!needsPasswordRehash(admin.password_hash)) return

  try {
    const upgradedHash = await hashPassword(password)
    await dbExecute(
      'UPDATE administrators SET password_hash = ? WHERE id = ?',
      [upgradedHash, admin.id]
    )
    await writeAuditLog({
      actorType: 'admin',
      actorId: Number(admin.id),
      action: 'auth.password_hash_upgraded',
      entityType: 'administrator',
      entityId: String(admin.id),
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      requestId: metadata.requestId,
    })
  } catch (error) {
    // The stored hash remains valid, so the administrator stays signed in.
    logError('auth.password_upgrade_failed', error, { adminId: admin.id })
  }
}

async function createSessionRecord(
  admin: AdminRow,
  metadata: AuthMetadata
): Promise<CreatedSession> {
  const config = getAppConfig()
  const token = randomBytes(32).toString('base64url')
  const csrfToken = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + config.sessionTtlHours * 60 * 60 * 1000)
  const ipHash = metadata.ip === 'unknown'
    ? null
    : createHash('sha256').update(metadata.ip).digest('hex')

  await dbExecute(
    `INSERT INTO admin_sessions
       (admin_id, token_hash, ip_hash, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      admin.id,
      hashToken(token),
      ipHash,
      metadata.userAgent.slice(0, 255),
      expiresAt,
    ]
  )

  return {
    token,
    csrfToken,
    expiresAt,
    session: {
      sessionId: 0,
      adminId: Number(admin.id),
      username: admin.username,
      role: admin.role,
      expiresAt,
    },
  }
}

export async function authenticateAdmin(
  username: string,
  password: string,
  metadata: AuthMetadata
): Promise<CreatedSession> {
  const rows = await dbQuery<AdminRow[]>(
    `SELECT id, username, password_hash, role, is_active, failed_login_count, locked_until
       FROM administrators
      WHERE username = ?
      LIMIT 1`,
    [username]
  )
  const admin = rows[0]

  if (!admin) {
    await verifyAgainstDummyHash(password)
    await writeAuditLog({
      actorType: 'system',
      action: 'auth.login_failed',
      entityType: 'administrator',
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      requestId: metadata.requestId,
      metadata: { reason: 'unknown_username' },
    })
    throw new UnauthorizedError('Invalid username or password')
  }

  if (!admin.is_active) {
    await verifyAgainstDummyHash(password)
    await writeAuditLog({
      actorType: 'system',
      action: 'auth.login_failed',
      entityType: 'administrator',
      entityId: String(admin.id),
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      requestId: metadata.requestId,
      metadata: { reason: 'inactive_account' },
    })
    throw new UnauthorizedError('Invalid username or password')
  }

  if (admin.locked_until) {
    const lockedUntil = parseDatabaseDate(admin.locked_until)
    if (lockedUntil.getTime() > Date.now()) {
      const retryAfter = Math.max(
        1,
        Math.ceil((lockedUntil.getTime() - Date.now()) / 1000)
      )
      await writeAuditLog({
        actorType: 'system',
        action: 'auth.login_locked',
        entityType: 'administrator',
        entityId: String(admin.id),
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        requestId: metadata.requestId,
      })
      throw new AccountLockedError(retryAfter)
    }
  }

  const passwordValid = await verifyPassword(password, admin.password_hash)

  if (!passwordValid) {
    await dbExecute(
      `UPDATE administrators
          SET failed_login_count = failed_login_count + 1,
              locked_until = CASE
                WHEN failed_login_count + 1 >= ?
                  THEN DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE)
                ELSE locked_until
              END
        WHERE id = ?`,
      [MAX_LOGIN_FAILURES, ACCOUNT_LOCK_MINUTES, admin.id]
    )
    await writeAuditLog({
      actorType: 'system',
      action: 'auth.login_failed',
      entityType: 'administrator',
      entityId: String(admin.id),
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      requestId: metadata.requestId,
      metadata: { reason: 'invalid_password' },
    })
    throw new UnauthorizedError('Invalid username or password')
  }

  await dbExecute(
    `UPDATE administrators
        SET failed_login_count = 0,
            locked_until = NULL,
            last_login_at = UTC_TIMESTAMP()
      WHERE id = ?`,
    [admin.id]
  )

  await upgradePasswordHashIfNeeded(admin, password, metadata)

  const created = await createSessionRecord(admin, metadata)

  await writeAuditLog({
    actorType: 'admin',
    actorId: Number(admin.id),
    action: 'auth.login_succeeded',
    entityType: 'admin_session',
    ip: metadata.ip,
    userAgent: metadata.userAgent,
    requestId: metadata.requestId,
  })

  return created
}

export function setSessionCookies(
  response: NextResponse,
  token: string,
  csrfToken: string,
  expiresAt: Date
): void {
  const config = getAppConfig()
  const commonOptions = {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'strict' as const,
    path: '/',
    expires: expiresAt,
  }

  const sessionName = getSessionCookieName()
  const csrfName = getCsrfCookieName()

  // Remove any cookie left over from a previous deployment or naming scheme so
  // that exactly one session token is ever active in the browser.
  for (const name of new Set([SESSION_COOKIE_PROD, SESSION_COOKIE_DEV])) {
    if (name === sessionName) continue
    response.cookies.set(name, '', {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    })
  }
  for (const name of new Set([CSRF_COOKIE_PROD, CSRF_COOKIE_DEV])) {
    if (name === csrfName) continue
    response.cookies.set(name, '', {
      httpOnly: false,
      secure: config.cookieSecure,
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    })
  }

  response.cookies.set(sessionName, token, commonOptions)
  response.cookies.set(csrfName, csrfToken, {
    ...commonOptions,
    httpOnly: false,
  })
}

export function clearSessionCookies(response: NextResponse): void {
  const config = getAppConfig()
  for (const name of new Set([
    SESSION_COOKIE_PROD,
    SESSION_COOKIE_DEV,
    getSessionCookieName(),
  ])) {
    response.cookies.set(name, '', {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    })
  }
  for (const name of new Set([
    CSRF_COOKIE_PROD,
    CSRF_COOKIE_DEV,
    getCsrfCookieName(),
  ])) {
    response.cookies.set(name, '', {
      httpOnly: false,
      secure: config.cookieSecure,
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    })
  }
}
