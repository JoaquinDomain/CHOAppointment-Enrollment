import type { NextRequest } from 'next/server'
import {
  assertCsrfToken,
  requireAdminRole,
  requireAdminSession,
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
import { getAdminUserService } from '@/server/services'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  const requestId = getRequestId(request)
  const route = 'PATCH /api/admin/users/[id]'

  try {
    assertTrustedOrigin(request)
    const session = await requireAdminSession()
    requireAdminRole(session, ['superadmin'])
    assertCsrfToken(request)
    const ip = getClientIp(request)
    await consumeRateLimit('admin.users.update', String(session.adminId), 60, 60)

    const body = await readJsonBody(request, 8 * 1024)
    const { id } = await context.params

    const user = await getAdminUserService().update(id, body, {
      adminId: session.adminId,
      username: session.username,
      ip,
      userAgent: getUserAgent(request),
      requestId,
    })

    return jsonResponse({ user })
  } catch (error) {
    return errorResponse(error, { requestId, route })
  }
}
