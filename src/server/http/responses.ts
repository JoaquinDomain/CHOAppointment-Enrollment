import { NextResponse } from 'next/server'
import {
  AccountLockedError,
  AppError,
  DatabaseUnavailableError,
  RateLimitError,
} from '@/server/errors'
import { isDatabaseConnectivityError } from '@/server/db/mysql'
import { logError } from '@/server/logging/logger'

interface ErrorContext {
  requestId: string
  route: string
}

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
}

export function jsonResponse<T>(
  data: T,
  init: { status?: number; headers?: HeadersInit; noStore?: boolean } = {}
): NextResponse<T> {
  const headers = new Headers(init.headers)
  if (init.noStore !== false) {
    for (const [key, value] of Object.entries(NO_STORE_HEADERS)) {
      headers.set(key, value)
    }
  }
  return NextResponse.json(data, {
    status: init.status ?? 200,
    headers,
  })
}

export function errorResponse(error: unknown, context: ErrorContext): NextResponse {
  if (error instanceof RateLimitError || error instanceof AccountLockedError) {
    logError('api.rate_limited', error, {
      requestId: context.requestId,
      route: context.route,
      errorCode: error.code,
    })
    return jsonResponse(
      {
        error: error.message,
        code: error.code,
        requestId: context.requestId,
      },
      {
        status: error.status,
        headers: { 'Retry-After': String(error.retryAfterSeconds ?? 60) },
      }
    )
  }

  if (isDatabaseConnectivityError(error)) {
    const databaseError = new DatabaseUnavailableError()
    logError('api.database_unavailable', error, {
      requestId: context.requestId,
      route: context.route,
    })
    return jsonResponse(
      {
        error: databaseError.message,
        code: databaseError.code,
        requestId: context.requestId,
      },
      { status: databaseError.status }
    )
  }

  if (error instanceof AppError) {
    if (error.status >= 500) {
      logError('api.error', error, {
        requestId: context.requestId,
        route: context.route,
        errorCode: error.code,
      })
    }
    return jsonResponse(
      {
        error: error.expose ? error.message : 'An unexpected error occurred',
        code: error.code,
        requestId: context.requestId,
      },
      { status: error.status }
    )
  }

  logError('api.unhandled_error', error, {
    requestId: context.requestId,
    route: context.route,
  })

  return jsonResponse(
    {
      error: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
      requestId: context.requestId,
    },
    { status: 500 }
  )
}
