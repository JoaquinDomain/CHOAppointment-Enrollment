import type { NextRequest } from 'next/server'
import { requireAdminRole, requireAdminSession } from '@/server/auth/session'
import { getRequestId } from '@/server/http/request'
import { errorResponse, jsonResponse } from '@/server/http/responses'
import { consumeRateLimit } from '@/server/security/rate-limit'
import { getAdminUserService } from '@/server/services'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = getRequestId(request)
  const route = 'GET /api/admin/audit-logs'

  try {
    const session = await requireAdminSession()
    requireAdminRole(session, ['superadmin'])
    await consumeRateLimit('admin.audit.list', String(session.adminId), 120, 60)

    const logs = await getAdminUserService().listAudit(
      request.nextUrl.searchParams.get('limit')
    )

    return jsonResponse({ logs })
  } catch (error) {
    return errorResponse(error, { requestId, route })
  }
}
