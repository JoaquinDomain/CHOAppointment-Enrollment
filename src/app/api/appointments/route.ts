import type { NextRequest } from 'next/server'
import {
  getAppointmentService,
  parseAdminSearch,
  parseDateFilter,
  parseFacilityFilter,
  parseLimit,
  parseStatusFilter,
} from '@/server/appointments'
import { requireAdminSession } from '@/server/auth/session'
import {
  assertTrustedOrigin,
  getClientIp,
  getRateLimitIdentifier,
  getRequestId,
  getUserAgent,
  readJsonBody,
} from '@/server/http/request'
import { errorResponse, jsonResponse } from '@/server/http/responses'
import { consumeRateLimit } from '@/server/security/rate-limit'
import { assertTurnstileVerified } from '@/server/security/turnstile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = getRequestId(request)
  const route = 'GET /api/appointments'

  try {
    const session = await requireAdminSession()
    await consumeRateLimit('admin.list', String(session.adminId), 120, 60)

    const params = request.nextUrl.searchParams
    const filters = {
      search: parseAdminSearch(params.get('search')),
      facility: parseFacilityFilter(params.get('facility')),
      status: parseStatusFilter(params.get('status')),
      date: parseDateFilter(params.get('date')),
      limit: parseLimit(params.get('limit')),
    }

    const data = await getAppointmentService().listForAdmin(filters)
    return jsonResponse(data)
  } catch (error) {
    return errorResponse(error, { requestId, route })
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId(request)
  const route = 'POST /api/appointments'

  try {
    assertTrustedOrigin(request)
    const ip = getClientIp(request)
    await consumeRateLimit('appointment.create', getRateLimitIdentifier(request), 10, 600)

    const body = await readJsonBody(request, 24 * 1024)

    await assertTurnstileVerified(body.turnstile_token, ip)

    const result = await getAppointmentService().create(body, {
      ip,
      userAgent: getUserAgent(request),
      requestId,
    })

    return jsonResponse(result, { status: 201 })
  } catch (error) {
    return errorResponse(error, { requestId, route })
  }
}
