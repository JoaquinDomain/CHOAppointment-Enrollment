import { createHash } from 'node:crypto'
import type { PoolConnection } from 'mysql2/promise'
import { dbExecute, executeOn } from '@/server/db/mysql'
import { logError } from '@/server/logging/logger'

export interface AuditContext {
  actorType: 'admin' | 'patient' | 'system'
  actorId?: number | null
  action: string
  entityType?: string | null
  entityId?: string | null
  ip?: string | null
  userAgent?: string | null
  requestId?: string | null
  metadata?: Record<string, string | number | boolean | null> | null
}

function hashIp(ip?: string | null): string | null {
  if (!ip || ip === 'unknown') return null
  return createHash('sha256').update(ip).digest('hex')
}

function auditParams(entry: AuditContext): unknown[] {
  return [
    entry.actorType,
    entry.actorId ?? null,
    entry.action,
    entry.entityType ?? null,
    entry.entityId ?? null,
    hashIp(entry.ip),
    entry.userAgent?.slice(0, 255) ?? null,
    entry.requestId?.slice(0, 100) ?? null,
    entry.metadata ? JSON.stringify(entry.metadata) : null,
  ]
}

const INSERT_AUDIT_SQL = `INSERT INTO audit_logs
  (actor_type, actor_id, action, entity_type, entity_id, ip_hash, user_agent, request_id, metadata)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`

export async function insertAuditLog(
  connection: PoolConnection,
  entry: AuditContext
): Promise<void> {
  await executeOn(connection, INSERT_AUDIT_SQL, auditParams(entry))
}

export async function writeAuditLog(entry: AuditContext): Promise<void> {
  try {
    await dbExecute(INSERT_AUDIT_SQL, auditParams(entry))
  } catch (error) {
    logError('audit.write_failed', error, {
      action: entry.action,
      requestId: entry.requestId ?? undefined,
    })
  }
}
