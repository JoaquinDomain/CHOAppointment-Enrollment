import type { NextRequest } from 'next/server'
import { checkDatabaseConnection } from '@/server/db/mysql'
import { RateLimitError } from '@/server/errors'
import { getRateLimitIdentifier, getRequestId } from '@/server/http/request'
import { errorResponse, jsonResponse } from '@/server/http/responses'
import { consumeRateLimit } from '@/server/security/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = getRequestId(request)
  const route = 'GET /api/health'

  try {
    await consumeRateLimit('health.read', getRateLimitIdentifier(request), 30, 60)
  } catch (error) {
    if (error instanceof RateLimitError) {
      return errorResponse(error, { requestId, route })
    }
    return jsonResponse(
      { status: 'unavailable', database: 'down', requestId },
      { status: 503 }
    )
  }

  try {
    await checkDatabaseConnection()
    return jsonResponse({ status: 'ok', database: 'up', requestId })
  } catch {
    return jsonResponse(
      { status: 'unavailable', database: 'down', requestId },
      { status: 503 }
    )
  }
}
