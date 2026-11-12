import { randomBytes, scrypt as scryptCallback } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { dbQuery, dbExecute } = vi.hoisted(() => ({
  dbQuery: vi.fn(),
  dbExecute: vi.fn(),
}))

vi.mock('@/server/db/mysql', () => ({
  dbQuery,
  dbExecute,
  isDatabaseConnectivityError: () => false,
}))

import {
  authenticateAdmin,
  revokeAdminSession,
  validateAdminSession,
} from '@/server/auth/session'
import { hashPassword, needsPasswordRehash, verifyPassword } from '@/server/auth/password'

const PASSWORD = 'a-legacy-administrator-password'

const METADATA = {
  ip: '203.0.113.5',
  userAgent: 'vitest',
  requestId: 'req-upgrade',
}

function legacyHash(password: string, n = 16384, r = 8, p = 1): Promise<string> {
  const salt = randomBytes(16)
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      64,
      { N: n, r, p, maxmem: 256 * 1024 * 1024 },
      (error, derived) => {
        if (error) reject(error)
        else
          resolve(
            [
              'scrypt',
              n,
              r,
              p,
              salt.toString('base64url'),
              (derived as Buffer).toString('base64url'),
            ].join('$')
          )
      }
    )
  })
}

function adminRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    username: 'cho.admin',
    password_hash: '',
    role: 'admin',
    is_active: 1,
    failed_login_count: 0,
    locked_until: null,
    ...overrides,
  }
}

beforeEach(() => {
  dbQuery.mockReset()
  dbExecute.mockReset().mockResolvedValue({ affectedRows: 1 })
  process.env.APP_URL = 'https://example.test'
  process.env.APP_SECRET = 'test-secret-that-is-longer-than-thirty-two-characters'
  process.env.COOKIE_SECURE = 'false'
})

describe('existing administrator accounts', () => {
  it('authenticates an account that still uses the previous scrypt cost', async () => {
    const legacy = await legacyHash(PASSWORD)
    dbQuery.mockResolvedValue([adminRow({ password_hash: legacy })])

    const created = await authenticateAdmin('cho.admin', PASSWORD, METADATA)

    expect(created.session.username).toBe('cho.admin')
    expect(created.token.length).toBeGreaterThan(32)
  })

  it('refuses the same account when the password is wrong', async () => {
    const legacy = await legacyHash(PASSWORD)
    dbQuery.mockResolvedValue([adminRow({ password_hash: legacy })])

    await expect(
      authenticateAdmin('cho.admin', 'not the password', METADATA)
    ).rejects.toThrow(/Invalid username or password/i)
  })
})

describe('password hash upgrade', () => {
  it('detects a hash that uses outdated cost parameters', async () => {
    const legacy = await legacyHash(PASSWORD)
    const current = await hashPassword(PASSWORD)

    expect(needsPasswordRehash(legacy)).toBe(true)
    expect(needsPasswordRehash(current)).toBe(false)
    expect(needsPasswordRehash('garbage')).toBe(true)
  })

  it('re-hashes an outdated hash with the current parameters on sign-in', async () => {
    const legacy = await legacyHash(PASSWORD)
    dbQuery.mockResolvedValue([adminRow({ password_hash: legacy })])

    await authenticateAdmin('cho.admin', PASSWORD, METADATA)

    const update = dbExecute.mock.calls.find(call =>
      String(call[0]).includes('UPDATE administrators SET password_hash')
    )
    expect(update).toBeDefined()

    const [, params] = update as [string, unknown[]]
    const stored = String(params[0])
    expect(stored).toMatch(/^scrypt\$65536\$8\$2\$/)
    expect(needsPasswordRehash(stored)).toBe(false)
    expect(await verifyPassword(PASSWORD, stored)).toBe(true)
  })

  it('does not rewrite a hash that already uses the current parameters', async () => {
    const current = await hashPassword(PASSWORD)
    dbQuery.mockResolvedValue([adminRow({ password_hash: current })])

    await authenticateAdmin('cho.admin', PASSWORD, METADATA)

    const update = dbExecute.mock.calls.find(call =>
      String(call[0]).includes('UPDATE administrators SET password_hash')
    )
    expect(update).toBeUndefined()
  })

  it('still signs the administrator in when the upgrade cannot be written', async () => {
    const legacy = await legacyHash(PASSWORD)
    dbQuery.mockResolvedValue([adminRow({ password_hash: legacy })])

    dbExecute.mockImplementation(async (sql: string) => {
      if (String(sql).includes('SET password_hash = ?')) {
        throw new Error('write failed')
      }
      return { affectedRows: 1 }
    })

    const created = await authenticateAdmin('cho.admin', PASSWORD, METADATA)
    expect(created.session.username).toBe('cho.admin')
  })

  it('keeps the upgraded hash verifiable for later sign-ins', async () => {
    const legacy = await legacyHash(PASSWORD)
    dbQuery.mockResolvedValue([adminRow({ password_hash: legacy })])

    await authenticateAdmin('cho.admin', PASSWORD, METADATA)

    const update = dbExecute.mock.calls.find(call =>
      String(call[0]).includes('UPDATE administrators SET password_hash')
    )
    const [, params] = update as [string, unknown[]]

    dbQuery.mockResolvedValue([adminRow({ password_hash: String(params[0]) })])
    const second = await authenticateAdmin('cho.admin', PASSWORD, METADATA)
    expect(second.session.username).toBe('cho.admin')
  })
})

describe('session lifecycle', () => {
  it('revokes the previous session and creates a new one', async () => {
    const current = await hashPassword(PASSWORD)
    dbQuery.mockResolvedValue([adminRow({ password_hash: current })])

    const created = await authenticateAdmin('cho.admin', PASSWORD, METADATA)

    expect(created.token).not.toBe(created.csrfToken)
    expect(created.csrfToken).not.toBe(created.token)
  })

  it('does not accept a revoked session', async () => {
    dbQuery.mockResolvedValue([])

    expect(await validateAdminSession('some-token')).toBeNull()
  })

  it('revokes by token hash only', async () => {
    await revokeAdminSession('raw-token')

    const [sql, params] = dbExecute.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('WHERE token_hash = ?')
    expect(params[0]).not.toBe('raw-token')
    expect(String(params[0])).toMatch(/^[0-9a-f]{64}$/)
  })
})
