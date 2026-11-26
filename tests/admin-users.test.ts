import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError, NotFoundError, ValidationError } from '@/server/errors'
import type { AdminUser } from '@/types/admin'

const {
  dbQuery,
  executeOn,
  withTransaction,
  insertAuditLog,
  hashPassword,
  isUniqueConstraintError,
} = vi.hoisted(() => {
  const executeOn = vi.fn()
  const withTransaction = vi.fn(
    async (operation: (connection: unknown) => Promise<unknown>) => operation({})
  )
  return {
    dbQuery: vi.fn(),
    executeOn,
    withTransaction,
    insertAuditLog: vi.fn(async () => undefined),
    hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
    isUniqueConstraintError: vi.fn(() => false),
  }
})

vi.mock('@/server/db/mysql', () => ({
  dbQuery,
  dbExecute: vi.fn(),
  executeOn,
  withTransaction,
  isDatabaseConnectivityError: () => false,
  isUniqueConstraintError,
}))

vi.mock('@/server/auth/audit', () => ({
  insertAuditLog,
}))

vi.mock('@/server/auth/password', () => ({
  hashPassword,
  MIN_PASSWORD_LENGTH: 12,
  MAX_PASSWORD_LENGTH: 200,
}))

import { AdminUserService } from '@/server/services/admin-user.service'
import { MySqlAdminUserRepository } from '@/server/services/mysql-admin-users'
import {
  isValidAdminId,
  normalizeAdminRole,
  parseAdminUserCreateInput,
  parseAdminUserUpdateInput,
  parseAuditLimit,
} from '@/server/services/admin-user.validation'

const AUDIT = {
  adminId: 1,
  username: 'cho.super',
  ip: '203.0.113.10',
  userAgent: 'vitest',
  requestId: 'req-admin-users',
}

interface AdminRowFixture {
  id: number
  username: string
  display_name: string | null
  role: 'admin' | 'superadmin'
  is_active: number
  created_at: string
  updated_at: string
  last_login_at: string | null
}

function adminRow(overrides: Partial<AdminRowFixture> = {}): AdminRowFixture {
  return {
    id: 2,
    username: 'cho.admin',
    display_name: 'CHO Admin',
    role: 'admin',
    is_active: 1,
    created_at: '2026-01-01 08:00:00.000000',
    updated_at: '2026-01-01 08:00:00.000000',
    last_login_at: null,
    ...overrides,
  }
}

function adminUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 2,
    username: 'cho.admin',
    display_name: 'CHO Admin',
    role: 'admin',
    is_active: true,
    created_at: '2026-01-01 08:00:00.000000',
    updated_at: '2026-01-01 08:00:00.000000',
    last_login_at: null,
    ...overrides,
  }
}

function arrangeUpdate(
  current: AdminRowFixture,
  updated: AdminRowFixture,
  activeSuperAdmins: Array<{ id: number }> = [{ id: current.id }]
) {
  executeOn.mockImplementation(async (_connection: unknown, sql: string) => {
    const statement = String(sql)
    if (statement.includes('SELECT id') && statement.includes("role = 'superadmin'")) {
      return activeSuperAdmins
    }
    if (statement.includes('FOR UPDATE') && statement.includes('FROM administrators')) {
      return [current]
    }
    if (statement.startsWith('UPDATE administrators')) return { affectedRows: 1 }
    if (statement.includes('UPDATE admin_sessions')) return { affectedRows: 1 }
    if (statement.includes('FROM administrators')) return [updated]
    return { affectedRows: 1 }
  })
}

beforeEach(() => {
  dbQuery.mockReset()
  executeOn.mockReset()
  withTransaction.mockClear()
  insertAuditLog.mockClear()
  hashPassword.mockClear()
  isUniqueConstraintError.mockReset()
  isUniqueConstraintError.mockReturnValue(false)
  withTransaction.mockImplementation(
    async (operation: (connection: unknown) => Promise<unknown>) => operation({})
  )
})

describe('administrator role and validation', () => {
  it('normalises the role labels used by the UI and API', () => {
    expect(normalizeAdminRole('ADMIN')).toBe('admin')
    expect(normalizeAdminRole('SUPER_ADMIN')).toBe('superadmin')
    expect(normalizeAdminRole('superadmin')).toBe('superadmin')
    expect(normalizeAdminRole('super-admin')).toBe('superadmin')
    expect(normalizeAdminRole('owner')).toBeNull()
    expect(normalizeAdminRole(undefined)).toBeNull()
  })

  it('accepts a new administrator and defaults the role to ADMIN', () => {
    expect(
      parseAdminUserCreateInput({
        username: 'cho.admin2',
        display_name: '  Maria Santos ',
        password: 'correct horse battery',
        confirm_password: 'correct horse battery',
      })
    ).toEqual({
      username: 'cho.admin2',
      displayName: 'Maria Santos',
      role: 'admin',
      password: 'correct horse battery',
    })
  })

  it('accepts an explicit SUPER_ADMIN role when creating an account', () => {
    const input = parseAdminUserCreateInput({
      username: 'cho.super2',
      password: 'correct horse battery',
      role: 'SUPER_ADMIN',
    })
    expect(input.role).toBe('superadmin')
  })

  it.each([
    { username: 'ab', password: 'correct horse battery' },
    { username: 'bad name', password: 'correct horse battery' },
    { username: 'cho.admin', password: 'short' },
    { username: 'cho.admin', password: 'correct horse battery', role: 'owner' },
    {
      username: 'cho.admin',
      password: 'correct horse battery',
      confirm_password: 'different password',
    },
    { username: 'cho.admin', password: 'correct horse battery', is_active: true },
  ])('rejects invalid create input %#', payload => {
    expect(() => parseAdminUserCreateInput(payload)).toThrow(ValidationError)
  })

  it('accepts a partial update and normalises the role', () => {
    expect(
      parseAdminUserUpdateInput({
        display_name: ' Updated Name ',
        role: 'SUPER_ADMIN',
        is_active: false,
      })
    ).toEqual({
      displayName: 'Updated Name',
      role: 'superadmin',
      isActive: false,
    })
  })

  it('allows clearing a display name to null', () => {
    expect(parseAdminUserUpdateInput({ display_name: null })).toEqual({
      displayName: null,
    })
  })

  it('rejects an empty or invalid update', () => {
    expect(() => parseAdminUserUpdateInput({})).toThrow(ValidationError)
    expect(() => parseAdminUserUpdateInput({ is_active: 'yes' })).toThrow(ValidationError)
    expect(() => parseAdminUserUpdateInput({ role: 'owner' })).toThrow(ValidationError)
    expect(() =>
      parseAdminUserUpdateInput({ password: 'short', confirm_password: 'short' })
    ).toThrow(ValidationError)
    expect(() => parseAdminUserUpdateInput({ confirm_password: 'anything' })).toThrow(
      ValidationError
    )
    expect(() => parseAdminUserUpdateInput({ unexpected: true })).toThrow(ValidationError)
  })

  it('only accepts positive numeric administrator ids', () => {
    expect(isValidAdminId('1')).toBe(true)
    expect(isValidAdminId('9007199254740991')).toBe(true)
    expect(isValidAdminId('0')).toBe(false)
    expect(isValidAdminId('-1')).toBe(false)
    expect(isValidAdminId('1 OR 1=1')).toBe(false)
    expect(isValidAdminId('../etc/passwd')).toBe(false)
  })

  it('bounds the audit log limit', () => {
    expect(parseAuditLimit(null)).toBe(100)
    expect(parseAuditLimit('25')).toBe(25)
    expect(() => parseAuditLimit('0')).toThrow(ValidationError)
    expect(() => parseAuditLimit('201')).toThrow(ValidationError)
    expect(() => parseAuditLimit(['1'])).toThrow(ValidationError)
  })
})

describe('administrator service', () => {
  it('hashes the password before creating an administrator', async () => {
    const repository = {
      list: vi.fn(),
      countActiveSuperAdmins: vi.fn(),
      create: vi.fn(async () => adminUser()),
      update: vi.fn(),
      listAudit: vi.fn(),
    }

    await new AdminUserService(repository).create(
      {
        username: 'cho.admin',
        display_name: 'CHO Admin',
        password: 'correct horse battery',
        role: 'admin',
      },
      AUDIT
    )

    expect(hashPassword).toHaveBeenCalledWith('correct horse battery')
    expect(repository.create).toHaveBeenCalledWith(
      {
        username: 'cho.admin',
        displayName: 'CHO Admin',
        role: 'admin',
        passwordHash: 'hashed:correct horse battery',
      },
      AUDIT
    )
  })

  it('rejects a malformed administrator id before touching the repository', async () => {
    const repository = {
      list: vi.fn(),
      countActiveSuperAdmins: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      listAudit: vi.fn(),
    }

    await expect(
      new AdminUserService(repository).update('../etc/passwd', { is_active: false }, AUDIT)
    ).rejects.toBeInstanceOf(NotFoundError)

    expect(repository.update).not.toHaveBeenCalled()
  })

  it('hashes a password only when a reset was requested', async () => {
    const repository = {
      list: vi.fn(),
      countActiveSuperAdmins: vi.fn(),
      create: vi.fn(),
      update: vi.fn(async () => adminUser()),
      listAudit: vi.fn(),
    }

    await new AdminUserService(repository).update('2', { is_active: false }, AUDIT)
    expect(hashPassword).not.toHaveBeenCalled()

    await new AdminUserService(repository).update(
      '2',
      { password: 'another long password', confirm_password: 'another long password' },
      AUDIT
    )
    expect(hashPassword).toHaveBeenCalledWith('another long password')
    expect(repository.update).toHaveBeenLastCalledWith(
      '2',
      expect.objectContaining({ passwordHash: 'hashed:another long password' }),
      AUDIT
    )
  })
})

describe('administrator repository', () => {
  it('lists administrators without password hashes', async () => {
    dbQuery.mockResolvedValue([
      adminRow({ is_active: 0, role: 'superadmin', last_login_at: '2026-02-01 10:00:00.000000' }),
    ])

    const users = await new MySqlAdminUserRepository().list()

    expect(users).toEqual([
      {
        id: 2,
        username: 'cho.admin',
        display_name: 'CHO Admin',
        role: 'superadmin',
        is_active: false,
        created_at: '2026-01-01 08:00:00.000000',
        updated_at: '2026-01-01 08:00:00.000000',
        last_login_at: '2026-02-01 10:00:00.000000',
      },
    ])
    expect(JSON.stringify(users)).not.toMatch(/password/i)
  })

  it('counts active super administrators', async () => {
    dbQuery.mockResolvedValue([{ count: '2' }])
    expect(await new MySqlAdminUserRepository().countActiveSuperAdmins()).toBe(2)
  })

  it('creates an administrator and writes an audit record without secrets', async () => {
    executeOn.mockImplementation(async (_connection: unknown, sql: string) => {
      const statement = String(sql)
      if (statement.startsWith('INSERT INTO administrators')) {
        return { insertId: 9, affectedRows: 1 }
      }
      if (statement.includes('FROM administrators')) return [adminRow({ id: 9 })]
      return { affectedRows: 1 }
    })

    const created = await new MySqlAdminUserRepository().create(
      {
        username: 'cho.admin',
        displayName: 'CHO Admin',
        role: 'admin',
        passwordHash: 'hashed:secret-password',
      },
      AUDIT
    )

    expect(created.id).toBe(9)
    expect(insertAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'admin.user.created',
        entityType: 'administrator',
        entityId: '9',
        actorId: 1,
        metadata: {
          target_username: 'cho.admin',
          role: 'admin',
          display_name: 'CHO Admin',
        },
      })
    )
    expect(JSON.stringify(insertAuditLog.mock.calls)).not.toContain('hashed:secret-password')
  })

  it('rejects a duplicate username', async () => {
    isUniqueConstraintError.mockReturnValue(true)
    executeOn.mockRejectedValue({ code: 'ER_DUP_ENTRY' })

    await expect(
      new MySqlAdminUserRepository().create(
        {
          username: 'cho.admin',
          displayName: null,
          role: 'admin',
          passwordHash: 'hashed:secret-password',
        },
        AUDIT
      )
    ).rejects.toBeInstanceOf(ConflictError)
  })

  it('refuses to let an administrator deactivate their own account', async () => {
    arrangeUpdate(adminRow({ id: 1 }), adminRow({ id: 1, is_active: 0 }))

    await expect(
      new MySqlAdminUserRepository().update('1', { isActive: false }, AUDIT)
    ).rejects.toBeInstanceOf(ConflictError)

    const updateCall = executeOn.mock.calls.find(call =>
      String(call[1]).startsWith('UPDATE administrators')
    )
    expect(updateCall).toBeUndefined()
  })

  it('refuses to demote the last active super administrator', async () => {
    arrangeUpdate(
      adminRow({ id: 1, role: 'superadmin', is_active: 1 }),
      adminRow({ id: 1, role: 'admin' }),
      [{ id: 1 }]
    )

    await expect(
      new MySqlAdminUserRepository().update('1', { role: 'admin' }, AUDIT)
    ).rejects.toThrow(/last active super administrator/i)
  })

  it('refuses to deactivate the last active super administrator', async () => {
    arrangeUpdate(
      adminRow({ id: 1, role: 'superadmin', is_active: 1 }),
      adminRow({ id: 1, role: 'superadmin', is_active: 0 }),
      [{ id: 1 }]
    )

    await expect(
      new MySqlAdminUserRepository().update('1', { isActive: false }, AUDIT)
    ).rejects.toBeInstanceOf(ConflictError)
  })

  it('demotes a super administrator when another active one remains', async () => {
    arrangeUpdate(
      adminRow({ id: 2, role: 'superadmin', is_active: 1 }),
      adminRow({ id: 2, role: 'admin', is_active: 1 }),
      [{ id: 1 }, { id: 2 }]
    )

    const updated = await new MySqlAdminUserRepository().update(
      '2',
      { role: 'admin' },
      AUDIT
    )

    expect(updated.role).toBe('admin')
    expect(insertAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'admin.user.role_changed',
        metadata: expect.objectContaining({
          previous_role: 'superadmin',
          new_role: 'admin',
          target_username: 'cho.admin',
        }),
      })
    )
  })

  it('resets a password, revokes sessions, and never records the hash', async () => {
    arrangeUpdate(adminRow(), adminRow())

    await new MySqlAdminUserRepository().update(
      '2',
      { passwordHash: 'hashed:another long password' },
      AUDIT
    )

    const updateCall = executeOn.mock.calls.find(call =>
      String(call[1]).startsWith('UPDATE administrators')
    )
    expect(String(updateCall?.[1])).toContain('password_hash = ?')
    expect(updateCall?.[2]).toContain('hashed:another long password')

    const revokeCall = executeOn.mock.calls.find(call =>
      String(call[1]).includes('UPDATE admin_sessions')
    )
    expect(revokeCall).toBeDefined()
    expect(insertAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'admin.user.password_reset' })
    )
    expect(JSON.stringify(insertAuditLog.mock.calls)).not.toContain(
      'hashed:another long password'
    )
  })

  it('revokes sessions when deactivating an account', async () => {
    arrangeUpdate(adminRow(), adminRow({ is_active: 0 }))

    await new MySqlAdminUserRepository().update('2', { isActive: false }, AUDIT)

    expect(
      executeOn.mock.calls.some(call => String(call[1]).includes('UPDATE admin_sessions'))
    ).toBe(true)
    expect(insertAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'admin.user.deactivated' })
    )
  })

  it('records a display name change', async () => {
    arrangeUpdate(adminRow(), adminRow({ display_name: 'Renamed' }))

    await new MySqlAdminUserRepository().update(
      '2',
      { displayName: 'Renamed' },
      AUDIT
    )

    expect(insertAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'admin.user.updated',
        metadata: expect.objectContaining({
          previous_display_name: 'CHO Admin',
          display_name: 'Renamed',
        }),
      })
    )
  })

  it('rejects an update for an account that does not exist', async () => {
    executeOn.mockResolvedValue([])

    await expect(
      new MySqlAdminUserRepository().update('404', { isActive: false }, AUDIT)
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('lists administrative audit entries with parsed metadata', async () => {
    dbQuery.mockResolvedValue([
      {
        id: 5,
        actor_type: 'admin',
        actor_id: '1',
        actor_username: 'cho.super',
        action: 'admin.user.role_changed',
        entity_type: 'administrator',
        entity_id: '2',
        metadata: '{"previous_role":"admin","new_role":"superadmin"}',
        created_at: '2026-03-01 09:00:00.000000',
      },
      {
        id: 4,
        actor_type: 'system',
        actor_id: null,
        actor_username: null,
        action: 'admin.user.bootstrap_promoted',
        entity_type: 'administrator',
        entity_id: 'cho.super',
        metadata: null,
        created_at: '2026-03-01 08:00:00.000000',
      },
    ])

    const logs = await new MySqlAdminUserRepository().listAudit(50)

    expect(dbQuery).toHaveBeenCalledWith(expect.any(String), [50])
    expect(logs[0]).toMatchObject({
      id: 5,
      actor_id: 1,
      actor_username: 'cho.super',
      metadata: { previous_role: 'admin', new_role: 'superadmin' },
    })
    expect(logs[1].metadata).toBeNull()
  })
})
