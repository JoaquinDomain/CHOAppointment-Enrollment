import {
  createPool,
  type ExecuteValues,
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from 'mysql2/promise'
import { getDatabaseConfig } from '@/server/config/env'
import { DatabaseUnavailableError } from '@/server/errors'
import { describeError, logError, logInfo } from '@/server/logging/logger'

type DatabaseGlobal = typeof globalThis & {
  __choMysqlPool?: Pool
}

const globalForDatabase = globalThis as DatabaseGlobal

const RETRYABLE_TRANSACTION_ERRORS = new Set(['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'])
const DEFAULT_ACQUIRE_TIMEOUT_MS = 15000

let configuredAcquireTimeoutMs = DEFAULT_ACQUIRE_TIMEOUT_MS

function createDatabasePool(): Pool {
  const config = getDatabaseConfig()
  configuredAcquireTimeoutMs = config.acquireTimeoutMs
  const pool = createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: config.connectionLimit,
    maxIdle: config.connectionLimit,
    idleTimeout: 60000,
    queueLimit: 0,
    connectTimeout: config.connectTimeoutMs,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    ssl: config.ssl || undefined,
  })

  pool.on('connection', connection => {
    const callbackConnection = connection as unknown as {
      query: (sql: string, callback: (error: Error | null) => void) => unknown
    }

    callbackConnection.query("SET SESSION time_zone = '+00:00'", error => {
      if (error) logError('mysql.session_timezone_failed', error)
    })
  })

  ;(
    pool as unknown as {
      on(event: 'error', listener: (error: Error) => void): void
    }
  ).on('error', error => {
    logError('mysql.pool_error', error)
  })

  logInfo('mysql.pool_created', {
    host: config.host,
    database: config.database,
    connectionLimit: config.connectionLimit,
    ssl: Boolean(config.ssl),
  })

  return pool
}

export function getPool(): Pool {
  if (!globalForDatabase.__choMysqlPool) {
    globalForDatabase.__choMysqlPool = createDatabasePool()
  }
  return globalForDatabase.__choMysqlPool
}

/**
 * Acquires a pooled connection with a bounded wait.
 *
 * mysql2 queues connection requests when every pooled connection is busy. A
 * bounded wait keeps a saturated pool from turning into an unbounded request
 * hang. If the timeout wins the race, the pending acquisition is released as
 * soon as it resolves so the pool does not leak a connection.
 */
async function acquireConnection(timeoutMs: number): Promise<PoolConnection> {
  const pool = getPool()
  const acquisition = pool.getConnection()
  let timer: NodeJS.Timeout | undefined

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      acquisition.then(connection => connection.release()).catch(() => {
        // The acquisition failed after the timeout; nothing to release.
      })
      logError(
        'mysql.acquire_timeout',
        new Error('Database connection acquisition timed out'),
        { timeoutMs }
      )
      reject(new DatabaseUnavailableError())
    }, timeoutMs)
    timer.unref()
  })

  try {
    return await Promise.race([acquisition, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function withConnection<T>(operation: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await acquireConnection(configuredAcquireTimeoutMs)
  try {
    return await operation(connection)
  } finally {
    connection.release()
  }
}

export async function dbQuery<T extends RowDataPacket[]>(
  sql: string,
  params: unknown[] = []
): Promise<T> {
  return withConnection(async connection => {
    const [rows] = await connection.execute<T>(sql, params as unknown as ExecuteValues)
    return rows
  })
}

export async function dbExecute(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  return withConnection(async connection => {
    const [result] = await connection.execute<ResultSetHeader>(
      sql,
      params as unknown as ExecuteValues
    )
    return result
  })
}

export async function executeOn<T extends RowDataPacket[] | ResultSetHeader>(
  connection: PoolConnection,
  sql: string,
  params: unknown[] = []
): Promise<T> {
  const [result] = await connection.execute<T>(sql, params as unknown as ExecuteValues)
  return result as T
}

function isRetryableTransactionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: string }).code
  return typeof code === 'string' && RETRYABLE_TRANSACTION_ERRORS.has(code)
}

export async function withTransaction<T>(
  operation: (connection: PoolConnection) => Promise<T>,
  options: { retries?: number } = {}
): Promise<T> {
  const retries = options.retries ?? 2
  let attempt = 0

  while (true) {
    let connection: PoolConnection | null = null
    try {
      connection = await acquireConnection(configuredAcquireTimeoutMs)
      await connection.beginTransaction()
      const result = await operation(connection)
      await connection.commit()
      return result
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback()
        } catch {
          // A connection that cannot roll back is no longer safe to reuse.
          connection.destroy()
          connection = null
        }
      }
      if (attempt < retries && isRetryableTransactionError(error)) {
        attempt += 1
        continue
      }
      throw error
    } finally {
      connection?.release()
    }
  }
}

export function isUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: string; errno?: number }
  return candidate.code === 'ER_DUP_ENTRY' || candidate.errno === 1062
}

const DATABASE_CONNECTIVITY_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_SEQUENCE_TIMEOUT',
  'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
  'ER_ACCESS_DENIED_ERROR',
  'ER_CON_COUNT_ERROR',
  'ER_BAD_DB_ERROR',
  'ER_SERVER_SHUTDOWN',
  'ER_QUERY_INTERRUPTED',
  'ER_CONNECTION_KILLED',
])

export function isDatabaseConnectivityError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: string; fatal?: boolean }
  return (
    candidate.fatal === true ||
    (typeof candidate.code === 'string' && DATABASE_CONNECTIVITY_CODES.has(candidate.code))
  )
}

export function toPublicDatabaseError(error: unknown): Error {
  if (isDatabaseConnectivityError(error) || (error as { code?: string })?.code === 'ER_NO_SUCH_TABLE') {
    return new DatabaseUnavailableError()
  }
  return error instanceof Error ? error : new Error('Database operation failed')
}

export async function checkDatabaseConnection(): Promise<void> {
  try {
    await dbQuery<RowDataPacket[]>('SELECT 1 AS ok')
  } catch (error) {
    logError('mysql.health_check_failed', error, describeError(error))
    throw new DatabaseUnavailableError()
  }
}

export async function checkRequiredTables(): Promise<string[]> {
  const rows = await dbQuery<Array<RowDataPacket & { table_name: string }>>(
    `SELECT TABLE_NAME AS table_name
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name IN (
          'administrators', 'admin_sessions', 'patients', 'appointments',
          'laboratory_services', 'service_daily_capacity', 'consent_records',
          'audit_logs', 'appointment_status_history', 'rate_limit_buckets',
          'schema_migrations'
        )`
  )
  const present = new Set(rows.map(row => row.table_name))
  const required = [
    'administrators',
    'admin_sessions',
    'patients',
    'appointments',
    'laboratory_services',
    'service_daily_capacity',
    'consent_records',
    'audit_logs',
    'appointment_status_history',
    'rate_limit_buckets',
    'schema_migrations',
  ]
  return required.filter(table => !present.has(table))
}

export async function closeDatabasePool(): Promise<void> {
  if (globalForDatabase.__choMysqlPool) {
    const pool = globalForDatabase.__choMysqlPool
    globalForDatabase.__choMysqlPool = undefined
    try {
      await pool.end()
      logInfo('mysql.pool_closed')
    } catch (error) {
      logError('mysql.pool_close_failed', error)
    }
  }
}

