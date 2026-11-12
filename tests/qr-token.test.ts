import { beforeAll, describe, expect, it } from 'vitest'
import {
  createAppointmentStatusUrl,
  createAppointmentToken,
  extractAppointmentToken,
  verifyAppointmentToken,
} from '@/server/security/qr-token'

const PUBLIC_ID = '5a9f7c2e-6b6a-4c5d-9f24-3d2b1a0c9e88'

beforeAll(() => {
  process.env.APP_SECRET = 'test-secret-that-is-longer-than-thirty-two-characters'
  process.env.APP_URL = 'https://example.test'
})

describe('appointment QR tokens', () => {
  it('creates and verifies a signed token', () => {
    const token = createAppointmentToken(PUBLIC_ID, new Date(Date.now() + 60_000))
    const verified = verifyAppointmentToken(token)

    expect(verified?.publicId).toBe(PUBLIC_ID)
  })

  it('rejects tampered and expired tokens', () => {
    const token = createAppointmentToken(PUBLIC_ID, new Date(Date.now() + 60_000))
    const tampered = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`

    expect(verifyAppointmentToken(tampered)).toBeNull()
    expect(
      verifyAppointmentToken(
        createAppointmentToken(PUBLIC_ID, new Date(Date.now() - 1_000))
      )
    ).toBeNull()
  })

  it('builds a status URL containing the signed token', () => {
    const { token, url } = createAppointmentStatusUrl(PUBLIC_ID, '2026-11-09')
    expect(url.startsWith('https://example.test/appointment/status?token=')).toBe(true)
    expect(url).toContain(encodeURIComponent(token))
  })

  it('extracts tokens from URLs, raw tokens, and the CHO prefix', () => {
    const token = createAppointmentToken(PUBLIC_ID, new Date(Date.now() + 60_000))
    const url = `https://example.test/appointment/status?token=${encodeURIComponent(token)}`

    expect(extractAppointmentToken(url)).toBe(token)
    expect(extractAppointmentToken(token)).toBe(token)
    expect(extractAppointmentToken(`CHO:${token}`)).toBe(token)
    expect(extractAppointmentToken('https://example.test/no-token')).toBeNull()
    expect(extractAppointmentToken('')).toBeNull()
  })
})
