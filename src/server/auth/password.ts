import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto'

function scrypt(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error)
      else resolve(derivedKey)
    })
  })
}

/**
 * Cost parameters used for newly created hashes.
 *
 * N = 2^16, r = 8, p = 2 (approximately 64 MiB of memory per hash) follows the
 * OWASP Password Storage Cheat Sheet recommendation for scrypt and is
 * materially stronger than the 2^14 / 8 / 1 parameters that earlier versions
 * of this application used.
 */
const SCRYPT_N = 65536
const SCRYPT_R = 8
const SCRYPT_P = 2
const KEY_LENGTH = 64
const SALT_LENGTH = 16
const MAX_PASSWORD_LENGTH = 200
const MIN_PASSWORD_LENGTH = 12

/**
 * Legacy hashes created before the cost increase stay verifiable. The bounds
 * below keep a tampered or hostile stored hash from forcing the server to
 * allocate an unreasonable amount of memory.
 */
const MIN_ACCEPTED_N = 16384
const MAX_ACCEPTED_N = 262144
const MIN_ACCEPTED_R = 8
const MAX_ACCEPTED_R = 16
const MIN_ACCEPTED_P = 1
const MAX_ACCEPTED_P = 4
const MAX_MEMORY_BYTES = 256 * 1024 * 1024

let dummyHashPromise: Promise<string> | null = null

function isAcceptedParameters(n: number, r: number, p: number): boolean {
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false
  if (n < MIN_ACCEPTED_N || n > MAX_ACCEPTED_N) return false
  if (r < MIN_ACCEPTED_R || r > MAX_ACCEPTED_R) return false
  if (p < MIN_ACCEPTED_P || p > MAX_ACCEPTED_P) return false
  // scrypt requires N to be a power of two greater than one.
  if ((n & (n - 1)) !== 0) return false
  if (r * p >= 2 ** 30) return false
  if (128 * n * r > MAX_MEMORY_BYTES) return false
  return true
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password must be at most ${MAX_PASSWORD_LENGTH} characters`)
  }

  const salt = randomBytes(SALT_LENGTH)
  const derived = (await scrypt(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: MAX_MEMORY_BYTES,
  })) as Buffer

  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$')
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!password || password.length > MAX_PASSWORD_LENGTH) return false
  if (!storedHash || storedHash.length > 512) return false

  const parts = storedHash.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false

  const n = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  if (!isAcceptedParameters(n, r, p)) return false

  let salt: Buffer
  let expected: Buffer
  try {
    salt = Buffer.from(parts[4], 'base64url')
    expected = Buffer.from(parts[5], 'base64url')
  } catch {
    return false
  }
  if (salt.length !== SALT_LENGTH || expected.length !== KEY_LENGTH) return false

  try {
    const derived = (await scrypt(password, salt, KEY_LENGTH, {
      N: n,
      r,
      p,
      maxmem: MAX_MEMORY_BYTES,
    })) as Buffer
    return timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}

/**
 * Reports whether a stored hash was produced with cost parameters other than
 * the current ones.
 *
 * A hash created by an earlier version of this application still verifies, but
 * it is protected by weaker work factors. Sign-in uses this to transparently
 * re-hash the password with the current parameters, so an administrator never
 * has to reset a password to benefit from the stronger cost.
 */
export function needsPasswordRehash(storedHash: string): boolean {
  if (!storedHash) return true
  const parts = storedHash.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return true
  return (
    Number(parts[1]) !== SCRYPT_N ||
    Number(parts[2]) !== SCRYPT_R ||
    Number(parts[3]) !== SCRYPT_P
  )
}

export async function verifyAgainstDummyHash(password: string): Promise<void> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(randomBytes(32).toString('base64url'))
  }
  await verifyPassword(password, await dummyHashPromise)
}

export { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH }
