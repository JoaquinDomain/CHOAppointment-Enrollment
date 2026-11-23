import type { NextRequest } from 'next/server'
import { requireAdminSession } from '@/server/auth/session'
import { getRequestId } from '@/server/http/request'
import { errorResponse, jsonResponse } from '@/server/http/responses'
import { consumeRateLimit } from '@/server/security/rate-limit'
import { getServiceAdminService } from '@/server/services'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = getRequestId(request)
  const route = 'GET /api/admin/services'

  try {
    const session = await requireAdminSession()
    await consumeRateLimit('admin.services.list', String(session.adminId), 120, 60)

    const services = await getServiceAdminService().list()
    return jsonResponse({ services })
  } catch (error) {
    return errorResponse(error, { requestId, route })
  }
}
