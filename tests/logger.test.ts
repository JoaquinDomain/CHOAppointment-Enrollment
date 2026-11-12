import { describe, expect, it } from 'vitest'
import { describeError, sanitizeLogMessage } from '@/server/logging/logger'

function databaseError(message: string, code = 'ER_DUP_ENTRY'): Error {
  return Object.assign(new Error(message), { code, errno: 1062, sqlState: '23000' })
}

describe('log sanitisation', () => {
  it('removes duplicated patient identity values from database errors', () => {
    const described = describeError(
      databaseError(
        "Duplicate entry 'Maria Cruz Santos-1990-01-15-09171234567' for key 'uq_patients_identity'"
      )
    )

    expect(described.message).not.toContain('09171234567')
    expect(described.message).not.toContain('Maria Cruz Santos')
    expect(described.message).toContain('[redacted]')
    expect(described.message).toContain('uq_patients_identity')
  })

  it('removes e-mail addresses and Philippine mobile numbers from messages', () => {
    expect(sanitizeLogMessage('contact maria.santos@example.test for updates')).toBe(
      'contact [redacted-email] for updates'
    )
    expect(sanitizeLogMessage('called +639171234567 twice')).toBe(
      'called [redacted-phone] twice'
    )
    expect(sanitizeLogMessage('called 09171234567 twice')).toBe(
      'called [redacted-phone] twice'
    )
  })

  it('keeps technical context that administrators need', () => {
    const described = describeError(
      databaseError('Deadlock found when trying to get lock', 'ER_LOCK_DEADLOCK')
    )

    expect(described.errorCode).toBe('ER_LOCK_DEADLOCK')
    expect(described.errorNumber).toBe(1062)
    expect(described.sqlState).toBe('23000')
    expect(described.message).toContain('Deadlock')
  })

  it('sanitises string metadata values', () => {
    const described = describeError('plain failure')
    expect(described.message).toBe('plain failure')
  })
})
