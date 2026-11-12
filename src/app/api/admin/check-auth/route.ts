import type { NextRequest } from 'next/server'
import { getAdminSession } from '@/server/auth/session'
import { getRequestId } from '@/server/http/request'
import { errorResponse, jsonResponse } from '@/server/http/responses'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = getRequestId(request)
  const route = 'GET /api/admin/check-auth'

  try {
    const session = await getAdminSession()
    if (!session) {
      return jsonResponse(
        { authenticated: false, error: 'Authentication required', code: 'UNAUTHORIZED', requestId },
        { status: 401 }
      )
    }
    return jsonResponse({
      authenticated: true,
      admin: { username: session.username, role: session.role },
    })
  } catch (error) {
    return errorResponse(error, { requestId, route })
  }
}
