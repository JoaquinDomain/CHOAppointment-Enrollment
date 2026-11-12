import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { UnauthorizedError, ForbiddenError } from '@/server/errors'

const { requireAdminSession, assertCsrfToken } = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  assertCsrfToken: vi.fn(),
}))

vi.mock('@/server/auth/session', () => ({
  requireAdminSession,
  assertCsrfToken,
  getAdminSession: vi.fn(async () => null),
  getSessionTokenFromCookies: vi.fn(async () => null),
  revokeAdminSession: vi.fn(async () => undefined),
  setSessionCookies: vi.fn(),
  clearSessionCookies: vi.fn(),
}))

vi.mock('@/server/security/rate-limit', () => ({
  consumeRateLimit: vi.fn(async () => ({
    allowed: true,
    limit: 10,
    remaining: 9,
    retryAfterSeconds: 60,
  })),
}))

vi.mock('@/server/db/mysql', () => ({
  dbQuery: vi.fn(async () => []),
  dbExecute: vi.fn(async () => ({ affectedRows: 0 })),
  isDatabaseConnectivityError: () => false,
  isUniqueConstraintError: () => false,
  withTransaction: vi.fn(),
  executeOn: vi.fn(),
}))

import { GET as listAppointments } from '@/app/api/appointments/route'
import { GET as getAdminDetail } from '@/app/api/admin/appointments/[id]/route'
import { POST as scanQr } from '@/app/api/admin/scan/route'
import { PATCH as updateStatus } from '@/app/api/admin/appointments/[id]/route'
import { GET as checkAuth } from '@/app/api/admin/check-auth/route'

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1]

function request(url: string, init?: NextRequestInit): NextRequest {
  return new NextRequest(`https://example.test${url}`, init)
}

beforeEach(() => {
  requireAdminSession.mockReset()
  assertCsrfToken.mockReset()
})

describe('unauthorised access to protected endpoints', () => {
  beforeEach(() => {
    requireAdminSession.mockRejectedValue(new UnauthorizedError())
  })

  it('rejects an unauthenticated appointment list request', async () => {
    const response = await listAppointments(request('/api/appointments'))

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.code).toBe('UNAUTHORIZED')
    expect(JSON.stringify(body)).not.toMatch(/full_name|contact_number|residential/i)
  })

  it('rejects an unauthenticated patient record request', async () => {
    const response = await getAdminDetail(
      request('/api/admin/appointments/1'),
      { params: Promise.resolve({ id: '1' }) }
    )

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.code).toBe('UNAUTHORIZED')
    expect(body.appointment).toBeUndefined()
  })

  it('rejects an unauthenticated QR scan', async () => {
    const response = await scanQr(
      request('/api/admin/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'v1.abc.123.signature' }),
      })
    )

    expect(response.status).toBe(401)
  })

  it('rejects an unauthenticated status update', async () => {
    const response = await updateStatus(
      request('/api/admin/appointments/1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      }),
      { params: Promise.resolve({ id: '1' }) }
    )

    expect(response.status).toBe(401)
  })

  it('reports an unauthenticated session on the auth probe endpoint', async () => {
    const response = await checkAuth(request('/api/admin/check-auth'))

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.authenticated).toBe(false)
    expect(body.admin).toBeUndefined()
  })

  it('never caches an authorisation failure', async () => {
    const response = await listAppointments(request('/api/appointments'))
    expect(response.headers.get('cache-control')).toContain('no-store')
  })
})

describe('authorised access control', () => {
  it('requires a CSRF token for state-changing administrator requests', async () => {
    requireAdminSession.mockResolvedValue({
      sessionId: 1,
      adminId: 1,
      username: 'cho.admin',
      role: 'admin',
      expiresAt: new Date(Date.now() + 60_000),
    })
    assertCsrfToken.mockImplementation(() => {
      throw new ForbiddenError('Invalid or missing CSRF token')
    })

    const response = await updateStatus(
      request('/api/admin/appointments/1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      }),
      { params: Promise.resolve({ id: '1' }) }
    )

    expect(response.status).toBe(403)
    expect(assertCsrfToken).toHaveBeenCalled()
  })

  it('rejects a cross-site origin on a state-changing public request', async () => {
    const response = await (
      await import('@/app/api/appointments/route')
    ).POST(
      request('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://evil.test',
        },
        body: JSON.stringify({}),
      })
    )

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.code).toBe('FORBIDDEN')
  })

  it('rejects a cross-site Sec-Fetch-Site header', async () => {
    const response = await (
      await import('@/app/api/appointments/route')
    ).POST(
      request('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Sec-Fetch-Site': 'cross-site',
        },
        body: JSON.stringify({}),
      })
    )

    expect(response.status).toBe(403)
  })
})
