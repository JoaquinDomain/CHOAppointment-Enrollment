import type { NextRequest } from 'next/server'
import { getAppointmentService } from '@/server/appointments'
import { ValidationError } from '@/server/errors'
import { getRateLimitIdentifier, getRequestId } from '@/server/http/request'
import { errorResponse, jsonResponse } from '@/server/http/responses'
import { consumeRateLimit } from '@/server/security/rate-limit'
import { isValidISODate } from '@/server/utils/date'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = getRequestId(request)
  const route = 'GET /api/availability'

  try {
    await consumeRateLimit('availability.read', getRateLimitIdentifier(request), 180, 60)

    const date = request.nextUrl.searchParams.get('date')
    if (!date || !isValidISODate(date)) {
      throw new ValidationError('A valid date in YYYY-MM-DD format is required')
    }

    const availability = await getAppointmentService().getAvailability(date)
    return jsonResponse(availability)
  } catch (error) {
    return errorResponse(error, { requestId, route })
  }
}
