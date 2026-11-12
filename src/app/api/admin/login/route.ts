import type { NextRequest } from 'next/server'
import {
  authenticateAdmin,
  getSessionTokenFromCookies,
  revokeAdminSession,
  setSessionCookies,
} from '@/server/auth/session'
import {
  assertTrustedOrigin,
  getClientIp,
  getRequestId,
  getUserAgent,
  readJsonBody,
} from '@/server/http/request'
import { errorResponse, jsonResponse } from '@/server/http/responses'
import { consumeRateLimit } from '@/server/security/rate-limit'
import { ValidationError } from '@/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId(request)
  const route = 'POST /api/admin/login'

  try {
    assertTrustedOrigin(request)
    const ip = getClientIp(request)

    await consumeRateLimit('admin.login.ip', ip, 5, 900)

    const body = await readJsonBody(request, 4 * 1024)
    const username = typeof body.username === 'string' ? body.username.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!username || username.length > 100) {
      throw new ValidationError('Username is required')
    }
    if (!password || password.length > 200) {
      throw new ValidationError('Password is required')
    }

    await consumeRateLimit('admin.login.username', username.toLowerCase(), 10, 900)

    const created = await authenticateAdmin(username, password, {
      ip,
      userAgent: getUserAgent(request),
      requestId,
    })

    // A successful sign-in always starts a brand new session. Any session that
    // was active in this browser is revoked so that a stale token cannot
    // outlive the sign-in that replaced it.
    await revokeAdminSession(await getSessionTokenFromCookies())

    const response = jsonResponse({
      success: true,
      admin: {
        username: created.session.username,
        role: created.session.role,
      },
    })
    setSessionCookies(response, created.token, created.csrfToken, created.expiresAt)
    return response
  } catch (error) {
    return errorResponse(error, { requestId, route })
  }
}
