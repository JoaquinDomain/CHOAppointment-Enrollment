import { createHash, randomUUID } from 'node:crypto'
import { isIP } from 'node:net'
import type { NextRequest } from 'next/server'
import { getAllowedOrigins, getAppConfig } from '@/server/config/env'
import { AppError, ForbiddenError, ValidationError } from '@/server/errors'

const DEFAULT_MAX_BODY_BYTES = 32 * 1024

export function getRequestId(request: NextRequest): string {
  const supplied = request.headers.get('x-request-id')?.trim()
  if (supplied && /^[A-Za-z0-9_-]{8,100}$/.test(supplied)) {
    return supplied
  }
  return randomUUID()
}

export function getClientIp(request: NextRequest): string {
  const config = getAppConfig()
  if (config.trustProxy) {
    const forwarded = request.headers.get('x-forwarded-for')
    if (forwarded) {
      const first = forwarded.split(',')[0]?.trim()
      if (first && isIP(first)) return first
    }
    const realIp = request.headers.get('x-real-ip')?.trim()
    if (realIp && isIP(realIp)) return realIp
  }
  return 'unknown'
}

export function getUserAgent(request: NextRequest): string {
  return (request.headers.get('user-agent') || '').slice(0, 255)
}

/**
 * Identifier used to bucket a request for rate limiting.
 *
 * The client network address is preferred. When the deployment sits behind a
 * proxy that does not forward it, every visitor would otherwise share a
 * single bucket and a single abusive client could lock out the whole site.
 * The fallback is a salted, non-identifying fingerprint of stable request
 * headers so that unrelated visitors are kept apart.
 *
 * Note: the fingerprint can be varied by a determined client, so the proxy
 * must forward the real client address (`TRUST_PROXY=true`) for per-network
 * limiting to be reliable.
 */
export function getRateLimitIdentifier(request: NextRequest): string {
  const ip = getClientIp(request)
  if (ip !== 'unknown') return ip

  const fingerprint = [
    request.headers.get('user-agent') ?? '',
    request.headers.get('accept-language') ?? '',
    request.headers.get('accept-encoding') ?? '',
  ].join('|')

  return `fp:${createHash('sha256').update(fingerprint).digest('hex').slice(0, 32)}`
}

export function assertTrustedOrigin(request: NextRequest): void {
  const origin = request.headers.get('origin')
  const secFetchSite = request.headers.get('sec-fetch-site')

  if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
    throw new ForbiddenError('Cross-site requests are not allowed')
  }

  if (!origin) return

  const normalized = origin.replace(/\/+$/, '')
  if (!getAllowedOrigins().includes(normalized)) {
    throw new ForbiddenError('Request origin is not allowed')
  }
}

export async function readJsonBody(
  request: NextRequest,
  maxBytes = DEFAULT_MAX_BODY_BYTES
): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.includes('application/json')) {
    throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json')
  }

  const contentLength = Number(request.headers.get('content-length') || 0)
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large')
  }

  let raw: string
  try {
    raw = await request.text()
  } catch {
    throw new ValidationError('Unable to read request body')
  }

  if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
    throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large')
  }

  if (!raw.trim()) {
    throw new ValidationError('Request body is required')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new ValidationError('Request body must contain valid JSON')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ValidationError('Request body must be a JSON object')
  }

  return parsed as Record<string, unknown>
}
