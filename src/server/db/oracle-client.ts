// Server-only Oracle pool + helpers (thin mode by default).

import oracledb from 'oracledb'
import { getOracleEnv } from '@/server/config/env'

let poolPromise: Promise<oracledb.Pool> | null = null

export function isOracleConfigured(): boolean {
  return getOracleEnv() !== null
}

/** Lazily create (and cache) a single Oracle connection pool. */
export async function getOraclePool(): Promise<oracledb.Pool | null> {
  const config = getOracleEnv()
  if (!config) return null

  if (!poolPromise) {
    if (config.clientLibDir) {
      try {
        oracledb.initOracleClient({ libDir: config.clientLibDir })
      } catch (err) {
        console.error('Failed to initialize Oracle thick-mode client:', err)
        throw err
      }
    }

    poolPromise = oracledb
      .createPool({
        user: config.user,
        password: config.password,
        connectString: config.connectString,
        poolMin: config.poolMin,
        poolMax: config.poolMax,
      })
      .catch(err => {
        poolPromise = null
        throw err
      })
  }

  return poolPromise
}

/** Oracle has no native boolean column type; flags are stored as NUMBER(1). */
export function toNumber01(value: boolean | undefined | null): number {
  return value ? 1 : 0
}

export function fromNumber01(value: number | null | undefined): boolean {
  return value === 1
}

/** Normalize an Oracle DATE/TIMESTAMP select value to an ISO string. */
export function toISOString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

/** Out-bind values returned by DML ... RETURNING ... INTO. */
export type OracleOutBinds = Record<string, unknown>

/** Run a statement against the pool with automatic connection handling. */
export async function executeOracle<T = Record<string, unknown>>(
  sql: string,
  binds: oracledb.BindParameters = {},
  options: oracledb.ExecuteOptions = {}
): Promise<{ rows: T[]; outBinds?: OracleOutBinds }> {
  const pool = await getOraclePool()
  if (!pool) {
    throw new Error(
      'Oracle is not configured. Set ORACLE_USER, ORACLE_PASSWORD and ORACLE_CONNECT_STRING.'
    )
  }

  const connection = await pool.getConnection()
  try {
    const result = await connection.execute<T>(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      autoCommit: true,
      ...options,
    })
    return {
      rows: (result.rows ?? []) as T[],
      outBinds: result.outBinds as OracleOutBinds | undefined,
    }
  } finally {
    try {
      await connection.close()
    } catch {
      // Reclaimed by the pool.
    }
  }
}

/** Gracefully drain the pool (tests / shutdown hooks). */
export async function closeOraclePool(): Promise<void> {
  if (poolPromise) {
    try {
      const pool = await poolPromise
      await pool.close(10)
    } catch {
      // Already closed or never created.
    } finally {
      poolPromise = null
    }
  }
}
