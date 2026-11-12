import { randomBytes, scrypt as scryptCallback } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '@/server/auth/password'

function legacyHash(password: string): Promise<string> {
  const salt = randomBytes(16)
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      64,
      { N: 16384, r: 8, p: 1, maxmem: 128 * 1024 * 1024 },
      (error, derived) => {
        if (error) reject(error)
        else
          resolve(
            [
              'scrypt',
              16384,
              8,
              1,
              salt.toString('base64url'),
              (derived as Buffer).toString('base64url'),
            ].join('$')
          )
      }
    )
  })
}

describe('password hashing', () => {
  it('hashes with strong scrypt parameters and verifies the password', async () => {
    const password = 'correct horse battery staple'
    const hash = await hashPassword(password)

    expect(hash).toMatch(/^scrypt\$65536\$8\$2\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/)
    expect(await verifyPassword(password, hash)).toBe(true)
    expect(await verifyPassword('wrong password', hash)).toBe(false)
  })

  it('produces a different hash for every call', async () => {
    const password = 'correct horse battery staple'
    const first = await hashPassword(password)
    const second = await hashPassword(password)

    expect(first).not.toBe(second)
    expect(await verifyPassword(password, first)).toBe(true)
    expect(await verifyPassword(password, second)).toBe(true)
  })

  it('still verifies hashes created with the previous cost parameters', async () => {
    const password = 'legacy administrator password'
    const legacy = await legacyHash(password)

    expect(legacy).toMatch(/^scrypt\$16384\$8\$1\$/)
    expect(await verifyPassword(password, legacy)).toBe(true)
    expect(await verifyPassword('not the password', legacy)).toBe(false)
  })

  it('rejects short passwords and malformed stored hashes', async () => {
    await expect(hashPassword('short')).rejects.toThrow(/at least 12/)
    expect(await verifyPassword('anything', 'not-a-valid-hash')).toBe(false)
    expect(await verifyPassword('anything', 'scrypt$1$1$1$abc$def')).toBe(false)
  })

  it('rejects a stored hash with out-of-range cost parameters', async () => {
    const salt = randomBytes(16).toString('base64url')
    const digest = randomBytes(64).toString('base64url')

    expect(
      await verifyPassword('anything', `scrypt$1024$8$1$${salt}$${digest}`)
    ).toBe(false)
    expect(
      await verifyPassword('anything', `scrypt$1048576$8$1$${salt}$${digest}`)
    ).toBe(false)
    expect(
      await verifyPassword('anything', `scrypt$65536$99$1$${salt}$${digest}`)
    ).toBe(false)
    expect(
      await verifyPassword('anything', `scrypt$65536$8$1$${salt}$short`)
    ).toBe(false)
  })

  it('detects a modified hash', async () => {
    const hash = await hashPassword('a-secure-password')
    const [prefix, n, r, p, salt, digest] = hash.split('$')
    const firstCharacter = digest[0] === 'A' ? 'B' : 'A'
    const tampered = [prefix, n, r, p, salt, `${firstCharacter}${digest.slice(1)}`].join('$')
    expect(await verifyPassword('a-secure-password', tampered)).toBe(false)
  })

  it('rejects an oversized candidate password without hashing it', async () => {
    expect(await verifyPassword('x'.repeat(500), 'scrypt$65536$8$2$abc$def')).toBe(
      false
    )
  })
})
