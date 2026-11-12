import type { NextRequest } from 'next/server'
import {
  assertCsrfToken,
  clearSessionCookies,
  getAdminSession,
  getSessionTokenFromCookies,
  revokeAdminSession,
} from '@/server/auth/session'
import { writeAuditLog } from '@/server/auth/audit'
import { assertTrustedOrigin, getClientIp, getRequestId, getUserAgent } from '@/server/http/request'
import { errorResponse, jsonResponse } from '@/server/http/responses'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId(request)
  const route = 'POST /api/admin/logout'

  try {
    assertTrustedOrigin(request)
    const session = await getAdminSession()
    if (session) assertCsrfToken(request)

    const token = await getSessionTokenFromCookies()
    await revokeAdminSession(token)

    if (session) {
      await writeAuditLog({
        actorType: 'admin',
        actorId: session.adminId,
        action: 'auth.logout',
        entityType: 'admin_session',
        entityId: String(session.sessionId),
        ip: getClientIp(request),
        userAgent: getUserAgent(request),
        requestId,
      })
    }

    const response = jsonResponse({ success: true })
    clearSessionCookies(response)
    return response
  } catch (error) {
    const response = errorResponse(error, { requestId, route })
    clearSessionCookies(response)
    return response
  }
}
