import type { NextRequest } from 'next/server'
import { getAppointmentService } from '@/server/appointments'
import { writeAuditLog } from '@/server/auth/audit'
import { assertCsrfToken, requireAdminSession } from '@/server/auth/session'
import { ValidationError } from '@/server/errors'
import {
  assertTrustedOrigin,
  getClientIp,
  getRequestId,
  getUserAgent,
  readJsonBody,
} from '@/server/http/request'
import { errorResponse, jsonResponse } from '@/server/http/responses'
import { consumeRateLimit } from '@/server/security/rate-limit'
import { extractAppointmentToken } from '@/server/security/qr-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId(request)
  const route = 'POST /api/admin/scan'

  try {
    assertTrustedOrigin(request)
    const session = await requireAdminSession()
    assertCsrfToken(request)
    const ip = getClientIp(request)
    await consumeRateLimit('admin.scan', String(session.adminId), 60, 60)

    const body = await readJsonBody(request, 4 * 1024)
    if (typeof body.token !== 'string') {
      throw new ValidationError('QR token is required')
    }
    const token = extractAppointmentToken(body.token)
    if (!token) {
      throw new ValidationError('QR code is invalid')
    }

    const appointment = await getAppointmentService().scanQr(token)

    await writeAuditLog({
      actorType: 'admin',
      actorId: session.adminId,
      action: 'appointment.qr_scanned',
      entityType: 'appointment',
      entityId: appointment.id,
      ip,
      userAgent: getUserAgent(request),
      requestId,
    })

    return jsonResponse({ appointment })
  } catch (error) {
    return errorResponse(error, { requestId, route })
  }
}
