import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { Pool, RowDataPacket } from 'mysql2/promise'
import {
  assertTestDatabaseSafety,
  createTestPool,
  dropTestSchema,
  hasTestDatabase,
  migrateTestDatabase,
  pointApplicationAtTestDatabase,
  resetTestDatabase,
  testDatabase,
} from './helpers'

const { cookieJar } = vi.hoisted(() => {
  const store = new Map<string, string>()
  return {
    cookieJar: {
      store,
      get(name: string) {
        const value = store.get(name)
        return value === undefined ? undefined : { name, value }
      },
      set(name: string, value: string) {
        store.set(name, value)
      },
      clear() {
        store.clear()
      },
    },
  }
})

// The only boundary stubbed here is Next.js's request-scoped cookie reader.
// Everything below it — session validation, role checks, repositories, and the
// real route handlers — runs against the test MySQL database.
vi.mock('next/headers', () => ({
  cookies: async () => cookieJar,
}))

const describeDb = hasTestDatabase ? describe : describe.skip
const execFileAsync = promisify(execFile)

const CONTEXT = {
  ip: '203.0.113.9',
  userAgent: 'vitest-admin-rbac-integration',
  requestId: 'rbac-integration-request',
}

const DEFAULT_PASSWORD = 'integration-password-123'

type DbModule = typeof import('@/server/db/mysql')
type AuthModule = typeof import('@/server/auth/session')
type PasswordModule = typeof import('@/server/auth/password')
type ErrorsModule = typeof import('@/server/errors')
type RepositoryModule = typeof import('@/server/services/mysql-admin-users')
type UsersRouteModule = typeof import('@/app/api/admin/users/route')
type UserRouteModule = typeof import('@/app/api/admin/users/[id]/route')
type AuditRouteModule = typeof import('@/app/api/admin/audit-logs/route')
type AdminRepository = InstanceType<RepositoryModule['MySqlAdminUserRepository']>

let testPool: Pool
let db: DbModule
let auth: AuthModule
let passwordModule: PasswordModule
let errors: ErrorsModule
let repository: AdminRepository
let usersRoute: UsersRouteModule
let userRoute: UserRouteModule
let auditRoute: AuditRouteModule

function originHeaders(): Record<string, string> {
  return {
    Origin: 'https://example.test',
    'sec-fetch-site': 'same-origin',
  }
}

function getRequest(url = '/api/admin/users'): NextRequest {
  return new NextRequest(`https://example.test${url}`, { headers: originHeaders() })
}

function patchRequest(id: number | string, body: unknown): NextRequest {
  return new NextRequest(`https://example.test/api/admin/users/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: 'cho_csrf=test-csrf-token',
      'x-csrf-token': 'test-csrf-token',
      ...originHeaders(),
    },
    body: JSON.stringify(body),
  })
}

async function insertAdmin(
  username: string,
  role: 'admin' | 'superadmin',
  options: { plainPassword?: string; isActive?: boolean } = {}
): Promise<number> {
  const hash = await passwordModule.hashPassword(options.plainPassword ?? DEFAULT_PASSWORD)
  const result = await db.dbExecute(
    `INSERT INTO administrators (username, password_hash, role, is_active)
     VALUES (?, ?, ?, ?)`,
    [username, hash, role, options.isActive === false ? 0 : 1]
  )
  return Number(result.insertId)
}

async function signIn(
  username: string,
  password = DEFAULT_PASSWORD
): Promise<{ token: string; csrfToken: string }> {
  const created = await auth.authenticateAdmin(username, password, CONTEXT)
  cookieJar.clear()
  cookieJar.set(auth.getSessionCookieName(), created.token)
  return { token: created.token, csrfToken: created.csrfToken }
}

async function scalar(sql: string, params: unknown[] = []): Promise<number> {
  const [rows] = await testPool.query<RowDataPacket[]>(sql, params)
  return Number(rows[0]?.value ?? 0)
}

function cliEnv(extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DB_HOST: testDatabase.host,
    DB_PORT: String(testDatabase.port),
    DB_USER: testDatabase.user,
    DB_PASSWORD: testDatabase.password,
    DB_NAME: testDatabase.database,
    DB_SSL: process.env.DB_TEST_SSL === 'true' ? 'true' : 'false',
    DB_SSL_REJECT_UNAUTHORIZED: process.env.DB_TEST_SSL_REJECT_UNAUTHORIZED ?? 'true',
    ...extra,
  }
  return env
}

async function adminRow(username: string): Promise<RowDataPacket> {
  const [rows] = await testPool.query<RowDataPacket[]>(
    `SELECT username, display_name, password_hash, role, is_active,
            failed_login_count, locked_until, last_login_at, updated_at
       FROM administrators
      WHERE username = ?
      LIMIT 1`,
    [username]
  )
  return rows[0]
}

function independentRepository(pool: Pool): AdminRepository {
  return new repositoryModule.MySqlAdminUserRepository((operation) =>
    db.withTransactionOnPool(pool, operation, { retries: 5 })
  )
}

let repositoryModule: RepositoryModule

describeDb('administrator RBAC integration', () => {
  beforeAll(async () => {
    assertTestDatabaseSafety()
    pointApplicationAtTestDatabase()

    testPool = createTestPool()
    await dropTestSchema(testPool)
    await migrateTestDatabase()

    db = await import('@/server/db/mysql')
    auth = await import('@/server/auth/session')
    passwordModule = await import('@/server/auth/password')
    errors = await import('@/server/errors')
    repositoryModule = await import('@/server/services/mysql-admin-users')

    repository = new repositoryModule.MySqlAdminUserRepository()

    usersRoute = await import('@/app/api/admin/users/route')
    userRoute = await import('@/app/api/admin/users/[id]/route')
    auditRoute = await import('@/app/api/admin/audit-logs/route')
  })

  beforeEach(async () => {
    cookieJar.clear()
    await resetTestDatabase(testPool)
  })

  afterAll(async () => {
    if (db) await db.closeDatabasePool()
    if (testPool) await testPool.end()
  })

  it('rejects unauthenticated access to /admin/users', async () => {
    const response = await usersRoute.GET(getRequest())
    expect(response.status).toBe(401)
  })

  it('rejects an ADMIN at the /admin/users API and audit log API', async () => {
    await insertAdmin('rbac-admin', 'admin')
    await signIn('rbac-admin')

    const listResponse = await usersRoute.GET(getRequest())
    expect(listResponse.status).toBe(403)

    const auditResponse = await auditRoute.GET(getRequest('/api/admin/audit-logs'))
    expect(auditResponse.status).toBe(403)

    const targetId = await insertAdmin('rbac-target', 'admin')
    const patchResponse = await userRoute.PATCH(
      patchRequest(targetId, { is_active: false }),
      { params: Promise.resolve({ id: String(targetId) }) }
    )
    expect(patchResponse.status).toBe(403)
  })

  it('removes Super Admin access on the next protected request after demotion', async () => {
    const superA = await insertAdmin('rbac-super-a', 'superadmin')
    const superB = await insertAdmin('rbac-super-b', 'superadmin')
    const signedIn = await signIn('rbac-super-a')

    const before = await usersRoute.GET(getRequest())
    expect(before.status).toBe(200)

    // The database role is read on every request, so a still-valid session for
    // a demoted account must lose Super Admin access immediately.
    await repository.update(
      String(superA),
      { role: 'admin' },
      { adminId: superB, username: 'rbac-super-b', ...CONTEXT }
    )

    const session = await auth.validateAdminSession(signedIn.token)
    expect(session?.role).toBe('admin')

    const after = await usersRoute.GET(getRequest())
    expect(after.status).toBe(403)

    const auditAfter = await auditRoute.GET(getRequest('/api/admin/audit-logs'))
    expect(auditAfter.status).toBe(403)

    const targetId = await insertAdmin('rbac-target', 'admin')
    const patchAfter = await userRoute.PATCH(
      patchRequest(targetId, { is_active: false }),
      { params: Promise.resolve({ id: String(targetId) }) }
    )
    expect(patchAfter.status).toBe(403)
  })

  it('invalidates the affected session when an account is deactivated', async () => {
    const superA = await insertAdmin('rbac-super-a', 'superadmin')
    const superB = await insertAdmin('rbac-super-b', 'superadmin')
    const signedIn = await signIn('rbac-super-a')

    await repository.update(
      String(superA),
      { isActive: false },
      { adminId: superB, username: 'rbac-super-b', ...CONTEXT }
    )

    await expect(auth.validateAdminSession(signedIn.token)).resolves.toBeNull()

    const response = await usersRoute.GET(getRequest())
    expect(response.status).toBe(401)

    const revoked = await scalar(
      `SELECT COUNT(*) AS value
         FROM admin_sessions
        WHERE admin_id = ? AND revoked_at IS NOT NULL`,
      [superA]
    )
    expect(revoked).toBeGreaterThan(0)
  })

  it('invalidates existing sessions after a password reset', async () => {
    const superA = await insertAdmin('rbac-super-a', 'superadmin')
    const superB = await insertAdmin('rbac-super-b', 'superadmin')
    const signedIn = await signIn('rbac-super-a')

    const newPasswordHash = await passwordModule.hashPassword('brand-new-password-456')
    await repository.update(
      String(superA),
      { passwordHash: newPasswordHash },
      { adminId: superB, username: 'rbac-super-b', ...CONTEXT }
    )

    await expect(auth.validateAdminSession(signedIn.token)).resolves.toBeNull()
    expect((await usersRoute.GET(getRequest())).status).toBe(401)

    await expect(
      auth.authenticateAdmin('rbac-super-a', DEFAULT_PASSWORD, CONTEXT)
    ).rejects.toBeInstanceOf(errors.UnauthorizedError)

    const fresh = await auth.authenticateAdmin(
      'rbac-super-a',
      'brand-new-password-456',
      CONTEXT
    )
    expect(fresh.token.length).toBeGreaterThan(32)
  })

  it('reports the RBAC schema is present after migration', async () => {
    await expect(db.checkRequiredSchema()).resolves.toEqual([])
  })

  describe('promote-superadmin CLI', () => {
    function promote(username: string) {
      return execFileAsync(
        process.execPath,
        [
          path.resolve('scripts', 'promote-superadmin.mjs'),
          '--username',
          username,
          '--confirm',
          username,
        ],
        { cwd: path.resolve('.'), env: cliEnv(), timeout: 30_000 }
      )
    }

    it('promotes an existing active administrator and records the audit atomically', async () => {
      await insertAdmin('rbac-promote', 'admin')

      const { stdout } = await promote('rbac-promote')
      expect(stdout).toMatch(/SUPER_ADMIN|super administrator/i)

      const row = await adminRow('rbac-promote')
      expect(row.role).toBe('superadmin')
      expect(
        await scalar(
          `SELECT COUNT(*) AS value
             FROM audit_logs
            WHERE action = 'admin.user.bootstrap_promoted'
              AND entity_id = ?`,
          ['rbac-promote']
        )
      ).toBe(1)
    })

    it('refuses to promote an inactive account and leaves it unchanged', async () => {
      await insertAdmin('rbac-inactive', 'admin', { isActive: false })

      await expect(promote('rbac-inactive')).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringMatching(/inactive/i),
      })

      const row = await adminRow('rbac-inactive')
      expect(row.role).toBe('admin')
      expect(Number(row.is_active)).toBe(0)
    })

    it('refuses to promote an account that does not exist', async () => {
      await expect(promote('rbac-missing')).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringMatching(/does not exist/i),
      })
    })
  })

  it('keeps the existing account completely unchanged when create-admin targets a duplicate username', async () => {
    const username = 'rbac-cli-existing'
    const originalHash = await passwordModule.hashPassword('original-password-123')
    await db.dbExecute(
      `INSERT INTO administrators
         (username, display_name, password_hash, role, is_active, failed_login_count, locked_until)
       VALUES (?, 'Original Name', ?, 'admin', 0, 3, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE))`,
      [username, originalHash]
    )

    const before = await adminRow(username)
    const auditBefore = await scalar(
      `SELECT COUNT(*) AS value FROM audit_logs WHERE action = 'admin.user.created'`
    )

    await expect(
      execFileAsync(
        process.execPath,
        [path.resolve('scripts', 'create-admin.mjs'), '--username', username],
        {
          cwd: path.resolve('.'),
          env: cliEnv({ ADMIN_PASSWORD: 'brand-new-password-456' }),
          timeout: 30_000,
        }
      )
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringMatching(/already exists|unchanged/i),
    })

    const after = await adminRow(username)
    expect(after).toEqual(before)

    const auditAfter = await scalar(
      `SELECT COUNT(*) AS value FROM audit_logs WHERE action = 'admin.user.created'`
    )
    expect(auditAfter).toBe(auditBefore)
  })

  describe('concurrent final Super Admin protection', () => {
    async function activeSuperAdminCount(): Promise<number> {
      return scalar(
        `SELECT COUNT(*) AS value
           FROM administrators
          WHERE role = 'superadmin' AND is_active = 1`
      )
    }

    it.each([
      { case: 'simultaneous demotion', updateA: { role: 'admin' as const }, updateB: { role: 'admin' as const } },
      { case: 'simultaneous deactivation', updateA: { isActive: false }, updateB: { isActive: false } },
      { case: 'demotion and deactivation', updateA: { role: 'admin' as const }, updateB: { isActive: false } },
    ])('keeps at least one active Super Admin during $case', async ({ updateA, updateB }) => {
      const superA = await insertAdmin('rbac-concurrent-a', 'superadmin')
      const superB = await insertAdmin('rbac-concurrent-b', 'superadmin')

      const poolA = createTestPool(1)
      const poolB = createTestPool(1)

      try {
        const repositoryA = independentRepository(poolA)
        const repositoryB = independentRepository(poolB)

        // Each concurrent change is performed by the other Super Admin, so
        // neither request is a self-deactivation. Only superA and superB are
        // active Super Admins, so exactly one change must be rejected by the
        // last-active-Super-Admin safeguard.
        const results = await Promise.allSettled([
          repositoryA.update(String(superA), updateA, {
            adminId: superB,
            username: 'rbac-concurrent-b',
            ...CONTEXT,
          }),
          repositoryB.update(String(superB), updateB, {
            adminId: superA,
            username: 'rbac-concurrent-a',
            ...CONTEXT,
          }),
        ])

        const fulfilled = results.filter(result => result.status === 'fulfilled')
        const rejected = results.filter(
          (result): result is PromiseRejectedResult => result.status === 'rejected'
        )

        expect(fulfilled).toHaveLength(1)
        expect(rejected).toHaveLength(1)

        const reason = rejected[0].reason
        expect(reason).toBeInstanceOf(errors.ConflictError)
        expect((reason as InstanceType<ErrorsModule['ConflictError']>).code).toBe(
          'LAST_SUPER_ADMIN'
        )

        // At least one active Super Admin must remain, and no more than one of
        // the two accounts may have changed.
        expect(await activeSuperAdminCount()).toBe(1)

        const winnerIndex = results.findIndex(result => result.status === 'fulfilled')
        const winnerId = winnerIndex === 0 ? superA : superB
        const loserId = winnerIndex === 0 ? superB : superA

        const [winner] = await testPool.query<RowDataPacket[]>(
          'SELECT role, is_active FROM administrators WHERE id = ?',
          [winnerId]
        )
        const [loser] = await testPool.query<RowDataPacket[]>(
          'SELECT role, is_active FROM administrators WHERE id = ?',
          [loserId]
        )

        // The losing account is completely untouched: still an active Super Admin.
        expect(loser[0].role).toBe('superadmin')
        expect(Number(loser[0].is_active)).toBe(1)

        // The winning account actually changed.
        const winnerChanged =
          winner[0].role !== 'superadmin' || Number(winner[0].is_active) !== 1
        expect(winnerChanged).toBe(true)

        // Exactly one audit record was written for the two target accounts, and
        // the rolled-back operation left no partial audit entry.
        const auditCount = await scalar(
          `SELECT COUNT(*) AS value
             FROM audit_logs
            WHERE action IN ('admin.user.role_changed', 'admin.user.deactivated')
              AND entity_id IN (?, ?)`,
          [String(superA), String(superB)]
        )
        expect(auditCount).toBe(1)
      } finally {
        await poolA.end()
        await poolB.end()
      }
    })
  })
})
