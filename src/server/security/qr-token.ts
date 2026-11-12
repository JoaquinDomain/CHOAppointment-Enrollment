import { createHmac, timingSafeEqual } from 'node:crypto'
import { getAppConfig } from '@/server/config/env'
import { addDaysISO, parseISODateUTC } from '@/server/utils/date'

const TOKEN_VERSION = 'v1'
const TOKEN_PATTERN = /^v1\.([A-Za-z0-9_-]{1,128})\.(\d{1,12})\.([A-Za-z0-9_-]{43})$/
const MAX_TOKEN_LENGTH = 512

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function createAppointmentToken(publicId: string, expiresAt: Date): string {
  if (!/^[A-Za-z0-9-]{8,64}$/.test(publicId)) {
    throw new Error('Invalid appointment public identifier')
  }
  const expiresAtSeconds = Math.floor(expiresAt.getTime() / 1000)
  const payload = `${TOKEN_VERSION}.${encodeBase64Url(publicId)}.${expiresAtSeconds}`
  return `${payload}.${sign(payload, getAppConfig().appSecret)}`
}

export function verifyAppointmentToken(
  token: string,
  now: Date = new Date()
): { publicId: string; expiresAt: Date } | null {
  if (!token || token.length > MAX_TOKEN_LENGTH) return null
  const match = TOKEN_PATTERN.exec(token)
  if (!match) return null

  const [, encodedPublicId, expiryValue, suppliedSignature] = match
  const payload = `${TOKEN_VERSION}.${encodedPublicId}.${expiryValue}`
  const expectedSignature = sign(payload, getAppConfig().appSecret)

  const suppliedBuffer = Buffer.from(suppliedSignature, 'utf8')
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8')
  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return null
  }

  const expiresAtSeconds = Number(expiryValue)
  if (!Number.isSafeInteger(expiresAtSeconds)) return null
  if (expiresAtSeconds * 1000 < now.getTime()) return null

  let publicId: string
  try {
    publicId = decodeBase64Url(encodedPublicId)
  } catch {
    return null
  }
  if (!/^[A-Za-z0-9-]{8,64}$/.test(publicId)) return null

  return { publicId, expiresAt: new Date(expiresAtSeconds * 1000) }
}

export function tokenExpiryForAppointmentDate(appointmentDate: string): Date {
  const validUntil = addDaysISO(appointmentDate, 30)
  return new Date(parseISODateUTC(validUntil).getTime() + 86_400_000 - 1)
}

export function createAppointmentStatusUrl(publicId: string, appointmentDate: string): {
  token: string
  url: string
} {
  const token = createAppointmentToken(
    publicId,
    tokenExpiryForAppointmentDate(appointmentDate)
  )
  const baseUrl = getAppConfig().appUrl
  return {
    token,
    url: `${baseUrl}/appointment/status?token=${encodeURIComponent(token)}`,
  }
}

export function extractAppointmentToken(decodedText: string): string | null {
  const value = decodedText?.trim()
  if (!value || value.length > 2048) return null

  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      const url = new URL(value)
      const token = url.searchParams.get('token')
      return token && token.length <= MAX_TOKEN_LENGTH ? token : null
    } catch {
      return null
    }
  }

  const prefixed = value.startsWith('CHO:') ? value.slice(4) : value
  return prefixed.length <= MAX_TOKEN_LENGTH ? prefixed : null
}
