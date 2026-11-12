import type { NextRequest } from 'next/server'
import { getAppointmentService, parseAppointmentStatus } from '@/server/appointments'
import { assertCsrfToken, requireAdminSession } from '@/server/auth/session'
import {
  assertTrustedOrigin,
  getClientIp,
  getRequestId,
  getUserAgent,
  readJsonBody,
} from '@/server/http/request'
import { errorResponse, jsonResponse } from '@/server/http/responses'
import { consumeRateLimit } from '@/server/security/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const requestId = getRequestId(request)
  const route = 'GET /api/admin/appointments/[id]'

  try {
    const session = await requireAdminSession()
    await consumeRateLimit('admin.detail', String(session.adminId), 120, 60)
    const { id } = await context.params
    const appointment = await getAppointmentService().getAdminDetail(id)
    return jsonResponse({ appointment })
  } catch (error) {
    return errorResponse(error, { requestId, route })
  }
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  const requestId = getRequestId(request)
  const route = 'PATCH /api/admin/appointments/[id]'

  try {
    assertTrustedOrigin(request)
    const session = await requireAdminSession()
    assertCsrfToken(request)
    const ip = getClientIp(request)
    await consumeRateLimit('admin.status', String(session.adminId), 60, 60)

    const body = await readJsonBody(request, 2 * 1024)
    const status = parseAppointmentStatus(body)
    const { id } = await context.params

    const appointment = await getAppointmentService().updateStatus(id, status, {
      adminId: session.adminId,
      adminUsername: session.username,
      ip,
      userAgent: getUserAgent(request),
      requestId,
    })

    return jsonResponse({ appointment })
  } catch (error) {
    return errorResponse(error, { requestId, route })
  }
}
