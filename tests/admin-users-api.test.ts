import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ForbiddenError, UnauthorizedError } from '@/server/errors'
import type { AdminSession } from '@/server/auth/session'

const {
  requireAdminSession,
  assertCsrfToken,
  getAdminUserService,
  service,
} = vi.hoisted(() => {
  const service = {
    list: vi.fn(),
    countActiveSuperAdmins: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    listAudit: vi.fn(),
  }
  return {
    requireAdminSession: vi.fn(),
    assertCsrfToken: vi.fn(),
    getAdminUserService: vi.fn(() => service),
    service,
  }
})

vi.mock('@/server/auth/session', async importOriginal => {
  const actual = await importOriginal<typeof import('@/server/auth/session')>()
  return {
    ...actual,
    requireAdminSession,
    assertCsrfToken,
    getAdminSession: vi.fn(async () => null),
    getSessionTokenFromCookies: vi.fn(async () => null),
    revokeAdminSession: vi.fn(async () => undefined),
    setSessionCookies: vi.fn(),
    clearSessionCookies: vi.fn(),
  }
})

vi.mock('@/server/security/rate-limit', () => ({
  consumeRateLimit: vi.fn(async () => ({
    allowed: true,
    limit: 120,
    remaining: 119,
    retryAfterSeconds: 60,
  })),
}))

vi.mock('@/server/services', () => ({
  getAdminUserService,
}))

vi.mock('@/server/db/mysql', () => ({
  dbQuery: vi.fn(async () => []),
  dbExecute: vi.fn(async () => ({ affectedRows: 0 })),
  isDatabaseConnectivityError: () => false,
  isUniqueConstraintError: () => false,
  withTransaction: vi.fn(),
  executeOn: vi.fn(),
}))

import { GET as listUsers, POST as createUser } from '@/app/api/admin/users/route'
import { PATCH as updateUser } from '@/app/api/admin/users/[id]/route'
import { GET as listAudit } from '@/app/api/admin/audit-logs/route'

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1]

function request(url: string, init?: NextRequestInit): NextRequest {
  return new NextRequest(`https://example.test${url}`, init)
}

function session(role: 'admin' | 'superadmin'): AdminSession {
  return {
    sessionId: 1,
    adminId: 1,
    username: 'cho.super',
    role,
    expiresAt: new Date(Date.now() + 60_000),
  }
}

function jsonRequest(url: string, method: string, body: unknown): NextRequest {
  return request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const USER = {
  id: 2,
  username: 'cho.admin',
  display_name: 'CHO Admin',
  role: 'admin' as const,
  is_active: true,
  created_at: '2026-01-01 08:00:00.000000',
  updated_at: '2026-01-01 08:00:00.000000',
  last_login_at: null,
}

beforeEach(() => {
  requireAdminSession.mockReset()
  assertCsrfToken.mockReset()
  getAdminUserService.mockClear()
  service.list.mockReset()
  service.countActiveSuperAdmins.mockReset()
  service.create.mockReset()
  service.update.mockReset()
  service.listAudit.mockReset()
})

describe('administrator management authorization', () => {
  it.each(['GET', 'POST', 'PATCH', 'AUDIT'])(
    'rejects an unauthenticated %s request',
    async method => {
      requireAdminSession.mockRejectedValue(new UnauthorizedError())

      let response: Response
      if (method === 'GET') response = await listUsers(request('/api/admin/users'))
      else if (method === 'POST')
        response = await createUser(jsonRequest('/api/admin/users', 'POST', { username: 'x' }))
      else if (method === 'PATCH')
        response = await updateUser(
          jsonRequest('/api/admin/users/2', 'PATCH', { is_active: false }),
          { params: Promise.resolve({ id: '2' }) }
        )
      else response = await listAudit(request('/api/admin/audit-logs'))

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.code).toBe('UNAUTHORIZED')
      expect(service.list).not.toHaveBeenCalled()
      expect(service.create).not.toHaveBeenCalled()
      expect(service.update).not.toHaveBeenCalled()
      expect(service.listAudit).not.toHaveBeenCalled()
    }
  )

  it.each(['GET', 'POST', 'PATCH', 'AUDIT'])(
    'rejects an ADMIN %s request',
    async method => {
      requireAdminSession.mockResolvedValue(session('admin'))

      let response: Response
      if (method === 'GET') response = await listUsers(request('/api/admin/users'))
      else if (method === 'POST')
        response = await createUser(
          jsonRequest('/api/admin/users', 'POST', {
            username: 'cho.admin',
            password: 'correct horse battery',
          })
        )
      else if (method === 'PATCH')
        response = await updateUser(
          jsonRequest('/api/admin/users/2', 'PATCH', { is_active: false }),
          { params: Promise.resolve({ id: '2' }) }
        )
      else response = await listAudit(request('/api/admin/audit-logs'))

      expect(response.status).toBe(403)
      expect(service.list).not.toHaveBeenCalled()
      expect(service.create).not.toHaveBeenCalled()
      expect(service.update).not.toHaveBeenCalled()
      expect(service.listAudit).not.toHaveBeenCalled()
    }
  )

  it('does not let an ADMIN escalate by sending a SUPER_ADMIN role', async () => {
    requireAdminSession.mockResolvedValue(session('admin'))

    const response = await createUser(
      jsonRequest('/api/admin/users', 'POST', {
        username: 'cho.attacker',
        password: 'correct horse battery',
        role: 'superadmin',
      })
    )

    expect(response.status).toBe(403)
    expect(service.create).not.toHaveBeenCalled()
  })

  it('allows a SUPER_ADMIN to list administrators', async () => {
    requireAdminSession.mockResolvedValue(session('superadmin'))
    service.list.mockResolvedValue([USER])
    service.countActiveSuperAdmins.mockResolvedValue(1)

    const response = await listUsers(request('/api/admin/users'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.users).toEqual([USER])
    expect(body.active_superadmin_count).toBe(1)
    expect(JSON.stringify(body)).not.toMatch(/password|hash/i)
  })

  it('allows a SUPER_ADMIN to create an ADMIN and a SUPER_ADMIN', async () => {
    requireAdminSession.mockResolvedValue(session('superadmin'))
    service.create.mockResolvedValue(USER)

    const createAdmin = await createUser(
      jsonRequest('/api/admin/users', 'POST', {
        username: 'cho.admin',
        display_name: 'CHO Admin',
        password: 'correct horse battery',
        confirm_password: 'correct horse battery',
        role: 'ADMIN',
      })
    )
    expect(createAdmin.status).toBe(201)
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'cho.admin', role: 'ADMIN' }),
      expect.objectContaining({ adminId: 1, username: 'cho.super' })
    )

    const createSuperAdmin = await createUser(
      jsonRequest('/api/admin/users', 'POST', {
        username: 'cho.super2',
        password: 'correct horse battery',
        role: 'SUPER_ADMIN',
      })
    )
    expect(createSuperAdmin.status).toBe(201)
  })

  it('allows a SUPER_ADMIN to update an account', async () => {
    requireAdminSession.mockResolvedValue(session('superadmin'))
    service.update.mockResolvedValue({ ...USER, role: 'superadmin' })

    const response = await updateUser(
      jsonRequest('/api/admin/users/2', 'PATCH', {
        role: 'SUPER_ADMIN',
        is_active: true,
      }),
      { params: Promise.resolve({ id: '2' }) }
    )

    expect(response.status).toBe(200)
    expect(service.update).toHaveBeenCalledWith(
      '2',
      { role: 'SUPER_ADMIN', is_active: true },
      expect.objectContaining({ adminId: 1 })
    )
  })

  it('allows a SUPER_ADMIN to read the administrative audit log', async () => {
    requireAdminSession.mockResolvedValue(session('superadmin'))
    service.listAudit.mockResolvedValue([
      {
        id: 1,
        actor_type: 'admin',
        actor_id: 1,
        actor_username: 'cho.super',
        action: 'admin.user.created',
        entity_type: 'administrator',
        entity_id: '2',
        metadata: { target_username: 'cho.admin' },
        created_at: '2026-01-01 08:00:00.000000',
      },
    ])

    const response = await listAudit(
      request('/api/admin/audit-logs?limit=25')
    )

    expect(response.status).toBe(200)
    expect(service.listAudit).toHaveBeenCalledWith('25')
    const body = await response.json()
    expect(body.logs).toHaveLength(1)
    expect(JSON.stringify(body)).not.toMatch(/password|hash/i)
  })

  it('keeps CSRF protection on create and update', async () => {
    requireAdminSession.mockResolvedValue(session('superadmin'))
    assertCsrfToken.mockImplementation(() => {
      throw new ForbiddenError('Invalid or missing CSRF token')
    })

    const createResponse = await createUser(
      jsonRequest('/api/admin/users', 'POST', {
        username: 'cho.admin',
        password: 'correct horse battery',
      })
    )
    expect(createResponse.status).toBe(403)
    expect(service.create).not.toHaveBeenCalled()

    const updateResponse = await updateUser(
      jsonRequest('/api/admin/users/2', 'PATCH', { is_active: false }),
      { params: Promise.resolve({ id: '2' }) }
    )
    expect(updateResponse.status).toBe(403)
    expect(service.update).not.toHaveBeenCalled()
  })

  it('keeps trusted-origin protection on create and update', async () => {
    requireAdminSession.mockResolvedValue(session('superadmin'))

    const createResponse = await createUser(
      request('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://evil.test',
        },
        body: JSON.stringify({
          username: 'cho.admin',
          password: 'correct horse battery',
        }),
      })
    )
    expect(createResponse.status).toBe(403)
    expect(service.create).not.toHaveBeenCalled()

    const updateResponse = await updateUser(
      request('/api/admin/users/2', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://evil.test',
        },
        body: JSON.stringify({ is_active: false }),
      }),
      { params: Promise.resolve({ id: '2' }) }
    )
    expect(updateResponse.status).toBe(403)
    expect(service.update).not.toHaveBeenCalled()
  })
})
