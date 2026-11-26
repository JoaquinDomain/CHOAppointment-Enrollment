import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminSession } from '@/server/auth/session'

const { getAdminSession, redirect } = vi.hoisted(() => ({
  getAdminSession: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock('@/server/auth/session', () => ({
  getAdminSession,
}))

vi.mock('next/navigation', () => ({
  redirect,
}))

vi.mock('@/components/AdminUsersManager', () => ({
  default: () => null,
}))

import AdminUsersPage from '@/app/admin/users/page'

function session(role: 'admin' | 'superadmin'): AdminSession {
  return {
    sessionId: 1,
    adminId: 7,
    username: 'cho.user',
    role,
    expiresAt: new Date(Date.now() + 60_000),
  }
}

interface RedirectSignal extends Error {
  destination: string
}

beforeEach(() => {
  redirect.mockReset()
  redirect.mockImplementation((destination: string) => {
    const error = new Error('NEXT_REDIRECT') as RedirectSignal
    error.destination = destination
    throw error
  })
})

describe('/admin/users page authorization', () => {
  it('redirects unauthenticated users to the login page', async () => {
    getAdminSession.mockResolvedValue(null)

    await expect(AdminUsersPage()).rejects.toMatchObject({
      destination: '/admin/login',
    })
  })

  it('redirects to login when session lookup fails', async () => {
    getAdminSession.mockRejectedValue(new Error('session store unavailable'))

    await expect(AdminUsersPage()).rejects.toMatchObject({
      destination: '/admin/login',
    })
  })

  it('redirects ADMIN users away from administrator management', async () => {
    getAdminSession.mockResolvedValue(session('admin'))

    await expect(AdminUsersPage()).rejects.toMatchObject({
      destination: '/admin',
    })
  })

  it('renders the manager for a SUPER_ADMIN session', async () => {
    getAdminSession.mockResolvedValue(session('superadmin'))

    const element = await AdminUsersPage()

    expect(element).toBeTruthy()
    expect(redirect).not.toHaveBeenCalled()
  })
})
