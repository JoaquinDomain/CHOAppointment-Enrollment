import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SESSION_COOKIE_NAMES = ['__Host-cho_admin_session', 'cho_admin_session']

const isDevelopment = process.env.NODE_ENV !== 'production'
const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim())

/**
 * Content Security Policy.
 *
 * The policy is issued here rather than in `next.config.ts` because it carries
 * a per-request nonce. Next.js reads the nonce from the incoming request's
 * `Content-Security-Policy` header and applies it to the inline scripts it
 * renders, which is what allows `script-src` to omit `'unsafe-inline'`.
 *
 * The policy must only be set in one place. If `next.config.ts` also sent a
 * `Content-Security-Policy` header, the browser would enforce the stricter of
 * the two and the nonce-only policy would be rejected.
 */
function buildContentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${
      isDevelopment ? " 'unsafe-eval'" : ""
    }${turnstileEnabled ? " https://challenges.cloudflare.com" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${
      turnstileEnabled ? " https://challenges.cloudflare.com" : ""
    }`,
    "font-src 'self' data:",
    `connect-src 'self'${isDevelopment ? " ws: wss:" : ""}${
      turnstileEnabled ? " https://challenges.cloudflare.com" : ""
    }`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `frame-src 'self'${
      turnstileEnabled ? " https://challenges.cloudflare.com" : ""
    }`,
    "manifest-src 'self'",
    ...(isDevelopment
      ? []
      : ["script-src-attr 'none'", "style-src-attr 'unsafe-inline'"]),
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ].join('; ')
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const nonce = randomBytes(16).toString('base64')
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy)

  let response: NextResponse

  if (pathname === '/api/admin/login' || pathname === '/admin/login') {
    response = NextResponse.next({ request: { headers: requestHeaders } })
  } else if (
    (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) &&
    !SESSION_COOKIE_NAMES.some(name => Boolean(request.cookies.get(name)?.value))
  ) {
    if (pathname.startsWith('/api/')) {
      response = NextResponse.json(
        {
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
          requestId: request.headers.get('x-request-id') ?? undefined,
        },
        {
          status: 401,
          headers: { 'Cache-Control': 'no-store' },
        }
      )
    } else {
      response = NextResponse.redirect(new URL('/admin/login', request.url))
    }
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } })
  }

  response.headers.set('Content-Security-Policy', contentSecurityPolicy)
  return response
}

export const config = {
  // The policy has to reach every rendered page, so the proxy runs for all
  // routes except the immutable build output and the image optimiser.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
