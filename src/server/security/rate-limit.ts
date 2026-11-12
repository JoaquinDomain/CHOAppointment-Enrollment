import { createHash } from 'node:crypto'
import type { RowDataPacket } from 'mysql2/promise'
import { dbExecute, dbQuery, isDatabaseConnectivityError } from '@/server/db/mysql'
import { DatabaseUnavailableError, RateLimitError } from '@/server/errors'
import { logError } from '@/server/logging/logger'

export interface RateLimitDeps {
  execute: (sql: string, params?: unknown[]) => Promise<{ affectedRows: number }>
  query: <T extends RowDataPacket[]>(sql: string, params?: unknown[]) => Promise<T>
}

interface RateLimitRow extends RowDataPacket {
  hit_count: number
}

const defaultDeps: RateLimitDeps = {
  execute: (sql, params) => dbExecute(sql, params),
  query: (sql, params) => dbQuery(sql, params),
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  retryAfterSeconds: number
}

export function hashRateLimitIdentifier(identifier: string): string {
  return createHash('sha256').update(identifier).digest('hex')
}

export function buildBucketKey(
  scope: string,
  identifier: string,
  windowStartSeconds: number
): string {
  return createHash('sha256')
    .update(`${scope}:${hashRateLimitIdentifier(identifier)}:${windowStartSeconds}`)
    .digest('hex')
}

async function cleanupExpiredBuckets(deps: RateLimitDeps): Promise<void> {
  try {
    await deps.execute(
      'DELETE FROM rate_limit_buckets WHERE expires_at < UTC_TIMESTAMP() LIMIT 500'
    )
  } catch (error) {
    logError('rate_limit.cleanup_failed', error)
  }
}

export async function consumeRateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
  deps: RateLimitDeps = defaultDeps
): Promise<RateLimitResult> {
  if (!Number.isInteger(limit) || limit <= 0 || !Number.isInteger(windowSeconds) || windowSeconds <= 0) {
    throw new Error('Invalid rate limit configuration')
  }

  const nowMs = Date.now()
  const windowStartSeconds = Math.floor(nowMs / 1000 / windowSeconds) * windowSeconds
  const retryAfterSeconds = Math.max(
    1,
    windowStartSeconds + windowSeconds - Math.floor(nowMs / 1000)
  )
  const bucketKey = buildBucketKey(scope, identifier, windowStartSeconds)
  const expiresAt = new Date((windowStartSeconds + windowSeconds) * 1000)

  try {
    await deps.execute(
      `INSERT INTO rate_limit_buckets (bucket_key, hit_count, expires_at)
       VALUES (?, 1, ?)
       ON DUPLICATE KEY UPDATE hit_count = hit_count + 1`,
      [bucketKey, expiresAt]
    )

    const rows = await deps.query<RateLimitRow[]>(
      'SELECT hit_count FROM rate_limit_buckets WHERE bucket_key = ? LIMIT 1',
      [bucketKey]
    )
    const hitCount = Number(rows[0]?.hit_count ?? limit + 1)

    if (Math.random() < 0.01) {
      void cleanupExpiredBuckets(deps)
    }

    if (hitCount > limit) {
      throw new RateLimitError(retryAfterSeconds)
    }

    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - hitCount),
      retryAfterSeconds,
    }
  } catch (error) {
    if (error instanceof RateLimitError) throw error
    if (isDatabaseConnectivityError(error)) throw new DatabaseUnavailableError()
    throw error
  }
}
