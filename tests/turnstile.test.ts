import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assertTurnstileVerified,
  isWellFormedTurnstileToken,
  verifyTurnstileToken,
} from '@/server/security/turnstile'
import { TURNSTILE_ACTION } from '@/constants/turnstile'
import { AppError } from '@/server/errors'

const ORIGINAL_ENV = { ...process.env }

function enableTurnstile(): void {
  process.env.TURNSTILE_ENABLED = 'true'
  process.env.TURNSTILE_SECRET_KEY = 'test-secret-key'
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'test-site-key'
  process.env.APP_URL = 'https://example.test'
  process.env.APP_SECRET = 'test-secret-that-is-longer-than-thirty-two-characters'
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  enableTurnstile()
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('Turnstile token validation', () => {
  it('accepts only well-formed opaque tokens', () => {
    expect(isWellFormedTurnstileToken('abcDEF_123-456.789')).toBe(true)
    expect(isWellFormedTurnstileToken('')).toBe(false)
    expect(isWellFormedTurnstileToken(undefined)).toBe(false)
    expect(isWellFormedTurnstileToken('token with spaces')).toBe(false)
    expect(isWellFormedTurnstileToken('x'.repeat(5000))).toBe(false)
  })
})

describe('Turnstile server-side verification', () => {
  it('sends the secret key, the token, and the client address to Cloudflare', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: true }))
    const outcome = await verifyTurnstileToken('token-value', '203.0.113.5', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(outcome.success).toBe(true)
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    const body = String(init.body)
    expect(body).toContain('secret=test-secret-key')
    expect(body).toContain('response=token-value')
    expect(body).toContain('remoteip=203.0.113.5')
  })

  it('reports a rejected token without throwing', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ success: false, 'error-codes': ['invalid-input-response'] })
    )
    const outcome = await verifyTurnstileToken('token-value', null, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(outcome.success).toBe(false)
    expect(outcome.errorCodes).toEqual(['invalid-input-response'])
  })

  it('fails closed when the verification service is unreachable', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down')
    })

    await expect(
      assertTurnstileVerified('token-value', null, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ status: 503, code: 'VERIFICATION_UNAVAILABLE' })
  })

  it('fails closed when Cloudflare answers with an error status', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 500))

    await expect(
      assertTurnstileVerified('token-value', null, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ status: 503, code: 'VERIFICATION_UNAVAILABLE' })
  })

  it('rejects a missing or malformed token without contacting Cloudflare', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: true }))

    await expect(
      assertTurnstileVerified(undefined, null, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ status: 400, code: 'TURNSTILE_REQUIRED' })

    await expect(
      assertTurnstileVerified('bad token!', null, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ status: 400, code: 'TURNSTILE_REQUIRED' })

    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects a token Cloudflare refuses', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: false }))

    await expect(
      assertTurnstileVerified('token-value', null, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ status: 400, code: 'TURNSTILE_FAILED' })
  })

  it('accepts a token that Cloudflare confirms for the booking action', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ success: true, action: TURNSTILE_ACTION })
    )

    await expect(
      assertTurnstileVerified('token-value', null, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toBeUndefined()
  })

  it('refuses a token that was issued for a different action', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ success: true, action: 'something-else' })
    )

    await expect(
      assertTurnstileVerified('token-value', null, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ status: 400, code: 'TURNSTILE_FAILED' })
  })

  it('refuses a token that carries no action at all', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: true }))

    await expect(
      assertTurnstileVerified('token-value', null, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ status: 400, code: 'TURNSTILE_FAILED' })
  })

  it('exposes a safe message when the verification service is unavailable', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down')
    })

    const error = await assertTurnstileVerified('token-value', null, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(AppError)
    expect((error as AppError).expose).toBe(true)
    expect((error as AppError).message).toMatch(/temporarily unavailable/i)
  })

  it('is a no-op when Turnstile is disabled', async () => {
    process.env.TURNSTILE_ENABLED = 'false'
    const fetchImpl = vi.fn(async () => jsonResponse({ success: true }))

    await expect(
      assertTurnstileVerified(undefined, null, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toBeUndefined()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('surfaces verification failures as an AppError so responses stay sanitised', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: false }))

    await expect(
      assertTurnstileVerified('token-value', null, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toBeInstanceOf(AppError)
  })
})
