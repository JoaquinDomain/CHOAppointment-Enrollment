import { beforeEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import {
  assertTrustedOrigin,
  getClientIp,
  getRateLimitIdentifier,
  getRequestId,
  readJsonBody,
} from '@/server/http/request'
import { AppError, ForbiddenError } from '@/server/errors'

function request(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(`https://example.test${url}`, init as never)
}

beforeEach(() => {
  process.env.APP_URL = 'https://example.test'
  process.env.APP_SECRET = 'test-secret-that-is-longer-than-thirty-two-characters'
  process.env.TRUST_PROXY = 'true'
  delete process.env.ALLOWED_ORIGINS
})

describe('client address handling', () => {
  it('uses the forwarded client address only when a proxy is trusted', () => {
    const forwarded = request('/api/appointments', {
      headers: { 'X-Forwarded-For': '203.0.113.5, 198.51.100.7' },
    })

    expect(getClientIp(forwarded)).toBe('203.0.113.5')
  })

  it('ignores forwarded addresses when the proxy is not trusted', () => {
    process.env.TRUST_PROXY = 'false'

    const forwarded = request('/api/appointments', {
      headers: { 'X-Forwarded-For': '203.0.113.5' },
    })

    expect(getClientIp(forwarded)).toBe('unknown')
  })

  it('rejects a forwarded value that is not an IP address', () => {
    const forwarded = request('/api/appointments', {
      headers: { 'X-Forwarded-For': 'not-an-ip' },
    })

    expect(getClientIp(forwarded)).toBe('unknown')
  })

  it('keeps unrelated visitors in separate rate-limit buckets when the address is unknown', () => {
    process.env.TRUST_PROXY = 'false'

    const first = request('/api/availability', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0)' },
    })
    const same = request('/api/availability', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0)' },
    })
    const other = request('/api/availability', {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' },
    })

    const identifier = getRateLimitIdentifier(first)
    expect(identifier).toBe(getRateLimitIdentifier(same))
    expect(identifier).not.toBe(getRateLimitIdentifier(other))
    expect(identifier.startsWith('fp:')).toBe(true)
  })

  it('uses the client address for rate limiting when it is available', () => {
    const forwarded = request('/api/availability', {
      headers: { 'X-Forwarded-For': '203.0.113.5' },
    })

    expect(getRateLimitIdentifier(forwarded)).toBe('203.0.113.5')
  })
})

describe('request origin validation', () => {
  it('rejects an origin that is not the application origin', () => {
    expect(() =>
      assertTrustedOrigin(
        request('/api/appointments', { headers: { Origin: 'https://evil.test' } })
      )
    ).toThrow(ForbiddenError)
  })

  it('rejects a cross-site Sec-Fetch-Site header', () => {
    expect(() =>
      assertTrustedOrigin(
        request('/api/appointments', { headers: { 'Sec-Fetch-Site': 'cross-site' } })
      )
    ).toThrow(ForbiddenError)
  })

  it('accepts the application origin and same-site requests', () => {
    expect(() =>
      assertTrustedOrigin(
        request('/api/appointments', { headers: { Origin: 'https://example.test' } })
      )
    ).not.toThrow()

    expect(() =>
      assertTrustedOrigin(
        request('/api/appointments', { headers: { 'Sec-Fetch-Site': 'same-origin' } })
      )
    ).not.toThrow()

    expect(() => assertTrustedOrigin(request('/api/appointments'))).not.toThrow()
  })
})

describe('request body handling', () => {
  it('rejects a body that is not JSON', async () => {
    await expect(
      readJsonBody(
        request('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'a=1',
        })
      )
    ).rejects.toMatchObject({ status: 415 })
  })

  it('rejects an oversized body', async () => {
    await expect(
      readJsonBody(
        request('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ padding: 'x'.repeat(5000) }),
        }),
        1024
      )
    ).rejects.toMatchObject({ status: 413 })
  })

  it('rejects malformed and non-object JSON', async () => {
    await expect(
      readJsonBody(
        request('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{not json',
        })
      )
    ).rejects.toBeInstanceOf(AppError)

    await expect(
      readJsonBody(
        request('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '["array"]',
        })
      )
    ).rejects.toBeInstanceOf(AppError)
  })

  it('parses a valid JSON object', async () => {
    const body = await readJsonBody(
      request('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_type: 'consultation' }),
      })
    )

    expect(body.service_type).toBe('consultation')
  })
})

describe('request identifiers', () => {
  it('accepts a well-formed supplied identifier', () => {
    expect(
      getRequestId(request('/api/appointments', { headers: { 'x-request-id': 'req-12345678' } }))
    ).toBe('req-12345678')
  })

  it('replaces a malformed supplied identifier', () => {
    const generated = getRequestId(
      request('/api/appointments', { headers: { 'x-request-id': 'bad id with spaces' } })
    )

    expect(generated).not.toBe('bad id with spaces')
    expect(generated.length).toBeGreaterThan(10)
  })
})
