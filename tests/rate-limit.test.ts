import type { RowDataPacket } from 'mysql2/promise'
import { describe, expect, it } from 'vitest'
import { RateLimitError } from '@/server/errors'
import { consumeRateLimit, type RateLimitDeps } from '@/server/security/rate-limit'

function createMemoryDeps(): RateLimitDeps {
  const buckets = new Map<string, number>()

  return {
    async execute(sql, params = []) {
      if (sql.includes('INSERT INTO rate_limit_buckets')) {
        const key = String(params[0])
        buckets.set(key, (buckets.get(key) ?? 0) + 1)
      }
      return { affectedRows: 1 }
    },
    async query<T extends RowDataPacket[]>(_sql: string, params: unknown[] = []) {
      const key = String(params[0])
      const rows = [{ hit_count: buckets.get(key) ?? 0 }] as unknown as T
      return rows
    },
  }
}

describe('database-backed rate limiting', () => {
  it('allows requests up to the limit and then rejects', async () => {
    const deps = createMemoryDeps()
    const scope = `test.${Date.now()}`

    const first = await consumeRateLimit(scope, 'client-a', 3, 60, deps)
    const second = await consumeRateLimit(scope, 'client-a', 3, 60, deps)
    const third = await consumeRateLimit(scope, 'client-a', 3, 60, deps)

    expect(first.allowed).toBe(true)
    expect(second.remaining).toBe(1)
    expect(third.remaining).toBe(0)
    await expect(consumeRateLimit(scope, 'client-a', 3, 60, deps)).rejects.toBeInstanceOf(
      RateLimitError
    )
  })

  it('tracks identifiers independently', async () => {
    const deps = createMemoryDeps()
    const scope = `test.${Date.now()}.independent`

    await consumeRateLimit(scope, 'client-a', 1, 60, deps)
    await expect(consumeRateLimit(scope, 'client-a', 1, 60, deps)).rejects.toBeInstanceOf(
      RateLimitError
    )

    const otherClient = await consumeRateLimit(scope, 'client-b', 1, 60, deps)
    expect(otherClient.allowed).toBe(true)
  })
})
