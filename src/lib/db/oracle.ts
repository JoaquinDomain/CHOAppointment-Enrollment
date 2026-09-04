import oracledb from 'oracledb'

// Server-only module: manages a pooled Oracle connection using thin mode
// by default. Thick mode is only enabled when ORACLE_CLIENT_LIB_DIR is set.

export interface OraclePoolConfig {
  user: string
  password: string
  connectString: string
  poolMin?: number
  poolMax?: number
}

export function getOracleConfig(): OraclePoolConfig | null {
  const user = process.env.ORACLE_USER
  const password = process.env.ORACLE_PASSWORD
  const connectString = process.env.ORACLE_CONNECT_STRING

  if (!user || !password || !connectString) {
    return null
  }

  return {
    user,
    password,
    connectString,
    poolMin: Number(process.env.ORACLE_POOL_MIN || 1),
    poolMax: Number(process.env.ORACLE_POOL_MAX || 4),
  }
}

export function isOracleConfigured(): boolean {
  return getOracleConfig() !== null
}

let poolPromise: Promise<oracledb.Pool> | null = null

/**
 * Lazily create (and cache) a single Oracle connection pool.
 * Safe to call from Next.js server code; returns null when unconfigured.
 */
export async function getOraclePool(): Promise<oracledb.Pool | null> {
  const config = getOracleConfig()
  if (!config) {
    return null
  }

  if (!poolPromise) {
    // Thick mode requires Oracle Client libraries; only opt in when a
    // lib directory is explicitly provided. Otherwise thin mode is used.
    if (process.env.ORACLE_CLIENT_LIB_DIR) {
      try {
        oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_LIB_DIR })
      } catch (err) {
        console.error('Failed to initialize Oracle thick-mode client:', err)
        throw err
      }
    }

    poolPromise = oracledb.createPool({
      user: config.user,
      password: config.password,
      connectString: config.connectString,
      poolMin: config.poolMin,
      poolMax: config.poolMax,
    }).catch(err => {
      // Allow a later retry instead of caching a rejected pool forever.
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
  if (value === null || value === undefined) {
    return undefined
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  return String(value)
}

/** Out-bind values returned by DML ... RETURNING ... INTO. */
export type OracleOutBinds = Record<string, unknown>

/**
 * Run a statement against the pool with automatic connection handling.
 * SELECT-style calls resolve with rows; DML auto-commits by default.
 */
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
      // Connection will be reclaimed by the pool; nothing to do.
    }
  }
}

/** Gracefully drain the pool (used in tests / shutdown hooks). */
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
