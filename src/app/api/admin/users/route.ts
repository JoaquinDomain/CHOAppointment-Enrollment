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

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = getRequestId(request)
  const route = 'GET /api/admin/users'

  try {
    const session = await requireAdminSession()
    requireAdminRole(session, ['superadmin'])
    await consumeRateLimit('admin.users.list', String(session.adminId), 120, 60)

    const service = getAdminUserService()
    const [users, activeSuperadminCount] = await Promise.all([
      service.list(),
      service.countActiveSuperAdmins(),
    ])

    return jsonResponse({
      users,
      active_superadmin_count: activeSuperadminCount,
    })
  } catch (error) {
    return errorResponse(error, { requestId, route })
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId(request)
  const route = 'POST /api/admin/users'

  try {
    assertTrustedOrigin(request)
    const session = await requireAdminSession()
    requireAdminRole(session, ['superadmin'])
    assertCsrfToken(request)
    const ip = getClientIp(request)
    await consumeRateLimit('admin.users.create', String(session.adminId), 20, 60)

    const body = await readJsonBody(request, 8 * 1024)
    const user = await getAdminUserService().create(body, {
      adminId: session.adminId,
      username: session.username,
      ip,
      userAgent: getUserAgent(request),
      requestId,
    })

    return jsonResponse({ user }, { status: 201 })
  } catch (error) {
    return errorResponse(error, { requestId, route })
  }
}
