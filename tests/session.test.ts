import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { dbQuery, dbExecute } = vi.hoisted(() => ({
  dbQuery: vi.fn(),
  dbExecute: vi.fn(),
}))

const { cookieStore } = vi.hoisted(() => ({
  cookieStore: { get: vi.fn(), set: vi.fn() } as unknown as {
    get: (name: string) => { value: string } | undefined
    set: (...args: unknown[]) => void
  },
}))

vi.mock('@/server/db/mysql', () => ({
  dbQuery,
  dbExecute,
  isDatabaseConnectivityError: () => false,
}))

vi.mock('next/headers', () => ({
  cookies: async () => cookieStore,
}))

import {
  assertCsrfToken,
  getAdminSession,
  requireAdminSession,
  revokeAdminSession,
  validateAdminSession,
} from '@/server/auth/session'
import { ForbiddenError, UnauthorizedError } from '@/server/errors'

const RAW_TOKEN = 'raw-session-token-value'

function sessionRow(overrides: Record<string, unknown> = {}) {
  return {
    session_id: 7,
    admin_id: 3,
    username: 'cho.admin',
    role: 'admin',
    expires_at: '2026-12-31 23:59:59',
    last_seen_at: '2026-11-11 08:00:00',
    ...overrides,
  }
}

beforeEach(() => {
  dbQuery.mockReset()
  dbExecute.mockReset().mockResolvedValue({ affectedRows: 1 })
  cookieStore.get = vi.fn(() => undefined)
  process.env.APP_URL = 'https://example.test'
  process.env.APP_SECRET = 'test-secret-that-is-longer-than-thirty-two-characters'
  process.env.SESSION_TTL_HOURS = '8'
  process.env.COOKIE_SECURE = 'false'
  delete process.env.SESSION_IDLE_TIMEOUT_MINUTES
})

describe('administrator session validation', () => {
  it('rejects an empty or oversized token before touching the database', async () => {
    expect(await validateAdminSession('')).toBeNull()
    expect(await validateAdminSession('x'.repeat(300))).toBeNull()
    expect(dbQuery).not.toHaveBeenCalled()
  })

  it('stores only a hash of the session token', async () => {
    dbQuery.mockResolvedValue([sessionRow()])

    const session = await validateAdminSession(RAW_TOKEN)

    expect(session?.adminId).toBe(3)
    expect(session?.username).toBe('cho.admin')
    expect(session?.role).toBe('admin')

    const [sql, params] = dbQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('s.token_hash = ?')
    expect(sql).not.toContain(RAW_TOKEN)
    expect(params[0]).toBe(
      createHash('sha256').update(RAW_TOKEN).digest('hex')
    )
  })

  it('requires the session to be unrevoked, unexpired, and belong to an active account', async () => {
    dbQuery.mockResolvedValue([])
    expect(await validateAdminSession(RAW_TOKEN)).toBeNull()

    const [sql] = dbQuery.mock.calls[0] as [string]
    expect(sql).toContain('s.revoked_at IS NULL')
    expect(sql).toContain('s.expires_at > UTC_TIMESTAMP()')
    expect(sql).toContain('a.is_active = 1')
  })

  it('enforces the optional idle timeout', async () => {
    process.env.SESSION_IDLE_TIMEOUT_MINUTES = '30'
    dbQuery.mockResolvedValue([sessionRow()])

    await validateAdminSession(RAW_TOKEN)

    const [sql, params] = dbQuery.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('INTERVAL ? MINUTE')
    expect(params).toContain(30)
  })

  it('throws UnauthorizedError when no session is present', async () => {
    await expect(requireAdminSession()).rejects.toBeInstanceOf(UnauthorizedError)
    await expect(getAdminSession()).resolves.toBeNull()
  })
})

describe('administrator logout', () => {
  it('revokes the stored session by token hash', async () => {
    await revokeAdminSession(RAW_TOKEN)

    const [sql, params] = dbExecute.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('SET revoked_at = UTC_TIMESTAMP()')
    expect(sql).toContain('WHERE token_hash = ?')
    expect(params[0]).toBe(createHash('sha256').update(RAW_TOKEN).digest('hex'))
  })

  it('does nothing when there is no session token', async () => {
    await revokeAdminSession(null)
    expect(dbExecute).not.toHaveBeenCalled()
  })
})

describe('CSRF protection', () => {
  function requestWith(
    headers: Record<string, string>,
    cookies: Record<string, string> = {}
  ): NextRequest {
    const cookieHeader = Object.entries(cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ')
    return new NextRequest('https://example.test/api/admin/scan', {
      headers: cookieHeader ? { ...headers, cookie: cookieHeader } : headers,
    })
  }

  it('rejects a request without a CSRF header', () => {
    expect(() =>
      assertCsrfToken(requestWith({}, { cho_csrf: 'cookie-token' }))
    ).toThrow(ForbiddenError)
  })

  it('rejects a request whose header does not match the cookie', () => {
    expect(() =>
      assertCsrfToken(
        requestWith({ 'x-csrf-token': 'other-token' }, { cho_csrf: 'cookie-token' })
      )
    ).toThrow(ForbiddenError)
  })

  it('rejects a request that has a header but no cookie', () => {
    expect(() =>
      assertCsrfToken(requestWith({ 'x-csrf-token': 'header-token' }))
    ).toThrow(ForbiddenError)
  })

  it('accepts a matching header and cookie', () => {
    expect(() =>
      assertCsrfToken(
        requestWith({ 'x-csrf-token': 'cookie-token' }, { cho_csrf: 'cookie-token' })
      )
    ).not.toThrow()
  })

  it('accepts the production cookie name as well', () => {
    expect(() =>
      assertCsrfToken(
        requestWith(
          { 'x-csrf-token': 'cookie-token' },
          { '__Host-cho_csrf': 'cookie-token' }
        )
      )
    ).not.toThrow()
  })
})
