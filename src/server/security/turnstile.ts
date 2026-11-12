import { getAppConfig } from '@/server/config/env'
import { TURNSTILE_ACTION } from '@/constants/turnstile'
import { AppError } from '@/server/errors'
import { logWarn } from '@/server/logging/logger'

/**
 * Server-side Cloudflare Turnstile verification for public forms.
 *
 * The site key is public by design and is used only by the browser widget. The
 * secret key stays on the server and is only ever read from the environment.
 *
 * Verification fails closed: when Turnstile is enabled and the token cannot be
 * verified (missing, expired, duplicated, or the verification service is
 * unreachable) the request is rejected rather than accepted.
 */

const VERIFY_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const REQUEST_TIMEOUT_MS = 5000
const MAX_TOKEN_LENGTH = 4096

/**
 * Action that the browser widget must declare. Cloudflare returns the action
 * in the verification response, so a token that was minted for a different
 * action cannot be replayed against the booking endpoint.
 */
export { TURNSTILE_ACTION }

export interface TurnstileOutcome {
  success: boolean
  errorCodes: string[]
  action?: string
  hostname?: string
}

export interface TurnstileVerifyDeps {
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

function isEnabled(): boolean {
  return getAppConfig().turnstileEnabled
}

/**
 * Validates the shape of a Turnstile token before it is sent to Cloudflare.
 *
 * Turnstile tokens are opaque strings, so only structural constraints are
 * enforced: a non-empty value within the documented length, with no
 * whitespace or control characters. The request body is encoded with
 * `URLSearchParams`, so the token can never alter the verification request.
 */
export function isWellFormedTurnstileToken(token: unknown): token is string {
  return (
    typeof token === 'string' &&
    token.length > 0 &&
    token.length <= MAX_TOKEN_LENGTH &&
    !/[\s\u0000-\u001F\u007F]/.test(token)
  )
}

/**
 * Verifies a Turnstile token with Cloudflare.
 *
 * Returns `success: false` (rather than throwing) for a token Cloudflare
 * rejects. Throws only when the verification service itself cannot be reached,
 * so callers can distinguish "rejected" from "unavailable".
 */
export async function verifyTurnstileToken(
  token: string,
  remoteIp: string | null,
  deps: TurnstileVerifyDeps = {}
): Promise<TurnstileOutcome> {
  const config = getAppConfig()
  if (!config.turnstileSecretKey) {
    throw new Error('TURNSTILE_SECRET_KEY is not configured')
  }

  const fetchImpl = deps.fetchImpl ?? fetch
  const timeoutMs = deps.timeoutMs ?? REQUEST_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const body = new URLSearchParams({
      secret: config.turnstileSecretKey,
      response: token,
    })
    if (remoteIp && remoteIp !== 'unknown') {
      body.set('remoteip', remoteIp)
    }

    const response = await fetchImpl(VERIFY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: controller.signal,
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`Turnstile verification returned HTTP ${response.status}`)
    }

    const payload = (await response.json()) as {
      success?: unknown
      action?: unknown
      hostname?: unknown
      'error-codes'?: unknown
    }

    const errorCodes = Array.isArray(payload['error-codes'])
      ? payload['error-codes'].filter(
          (code): code is string => typeof code === 'string'
        )
      : []

    return {
      success: payload.success === true,
      errorCodes,
      action: typeof payload.action === 'string' ? payload.action : undefined,
      hostname:
        typeof payload.hostname === 'string' ? payload.hostname : undefined,
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Guards a public submission with Turnstile.
 *
 * No-ops when Turnstile is disabled. When enabled, a missing or invalid token
 * is rejected with a 400 and a verification service outage is rejected with a
 * 503, so the endpoint never silently accepts unverified submissions.
 */
export async function assertTurnstileVerified(
  token: unknown,
  remoteIp: string | null,
  deps: TurnstileVerifyDeps = {}
): Promise<void> {
  if (!isEnabled()) return

  if (!isWellFormedTurnstileToken(token)) {
    throw new AppError(
      400,
      'TURNSTILE_REQUIRED',
      'Please complete the human verification check and try again.'
    )
  }

  let outcome: TurnstileOutcome
  try {
    outcome = await verifyTurnstileToken(token, remoteIp, deps)
  } catch (error) {
    logWarn('turnstile.verification_unavailable', {
      errorMessage: error instanceof Error ? error.message.slice(0, 200) : 'unknown',
    })
    throw new AppError(
      503,
      'VERIFICATION_UNAVAILABLE',
      'Human verification is temporarily unavailable. Please try again later.',
      { expose: true }
    )
  }

  if (!outcome.success) {
    logWarn('turnstile.token_rejected', { errorCodes: outcome.errorCodes.join(',') })
    throw new AppError(
      400,
      'TURNSTILE_FAILED',
      'Human verification failed. Please try again.'
    )
  }

  // Cloudflare echoes the action that the widget declared. A token that was
  // issued for a different action is refused even though Cloudflare itself
  // considers it valid.
  if (outcome.action !== TURNSTILE_ACTION) {
    logWarn('turnstile.action_mismatch', {
      receivedAction: outcome.action ?? 'none',
      expectedAction: TURNSTILE_ACTION,
    })
    throw new AppError(
      400,
      'TURNSTILE_FAILED',
      'Human verification failed. Please try again.'
    )
  }
}
