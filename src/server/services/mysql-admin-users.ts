import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { insertAuditLog } from '@/server/auth/audit'
import {
  dbQuery,
  executeOn,
  isUniqueConstraintError,
  withTransaction,
} from '@/server/db/mysql'
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/server/errors'
import type {
  AdminAuditEntry,
  AdminUser,
  AdminUserRole,
} from '@/types/admin'
import type {
  AdminUserAuditContext,
  AdminUserCreateInput,
  AdminUserRepository,
  AdminUserUpdateInput,
} from './admin-user.repository'

interface AdminUserRow extends RowDataPacket {
  id: number | string
  username: string
  display_name: string | null
  role: AdminUserRole
  is_active: number
  created_at: string
  updated_at: string
  last_login_at: string | null
}

interface CountRow extends RowDataPacket {
  count: number | string
}

interface AuditRow extends RowDataPacket {
  id: number | string
  actor_type: 'admin' | 'patient' | 'system'
  actor_id: number | string | null
  actor_username: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  metadata: unknown
  created_at: string
}

interface ActiveAdminRow extends RowDataPacket {
  id: number | string
}

const ADMIN_SELECT = `
  SELECT id, username, display_name, role, is_active, created_at, updated_at, last_login_at
    FROM administrators
`

function mapUser(row: AdminUserRow): AdminUser {
  return {
    id: Number(row.id),
    username: row.username,
    display_name: row.display_name,
    role: row.role,
    is_active: row.is_active === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_login_at: row.last_login_at,
  }
}

function parseMetadata(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null
    } catch {
      return null
    }
  }
  return typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function mapAudit(row: AuditRow): AdminAuditEntry {
  return {
    id: Number(row.id),
    actor_type: row.actor_type,
    actor_id: row.actor_id === null ? null : Number(row.actor_id),
    actor_username: row.actor_username,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    metadata: parseMetadata(row.metadata),
    created_at: row.created_at,
  }
}

function auditMetadata(
  target: AdminUserRow,
  values: Record<string, string | number | boolean | null>
): Record<string, string | number | boolean | null> {
  return { target_username: target.username, ...values }
}

export type AdminUserTransactionRunner = <T>(
  operation: (connection: PoolConnection) => Promise<T>
) => Promise<T>

export class MySqlAdminUserRepository implements AdminUserRepository {
  constructor(
    private readonly runTransaction: AdminUserTransactionRunner = withTransaction
  ) {}

  async list(): Promise<AdminUser[]> {
    const rows = await dbQuery<AdminUserRow[]>(
      `${ADMIN_SELECT} ORDER BY username ASC, id ASC`
    )
    return rows.map(mapUser)
  }

  async countActiveSuperAdmins(): Promise<number> {
    const rows = await dbQuery<CountRow[]>(
      `SELECT COUNT(*) AS count
         FROM administrators
        WHERE role = 'superadmin'
          AND is_active = 1`
    )
    return Number(rows[0]?.count ?? 0)
  }

  async create(
    input: AdminUserCreateInput,
    audit: AdminUserAuditContext
  ): Promise<AdminUser> {
    try {
      return await this.runTransaction(async connection => {
        const result = await executeOn<ResultSetHeader>(
          connection,
          `INSERT INTO administrators (username, display_name, password_hash, role, is_active)
           VALUES (?, ?, ?, ?, 1)`,
          [input.username, input.displayName, input.passwordHash, input.role]
        )

        const rows = await executeOn<AdminUserRow[]>(
          connection,
          `${ADMIN_SELECT} WHERE id = ? LIMIT 1`,
          [String(result.insertId)]
        )
        const created = rows[0]
        if (!created) throw new NotFoundError('Administrator not found')

        await insertAuditLog(connection, {
          actorType: 'admin',
          actorId: audit.adminId,
          action: 'admin.user.created',
          entityType: 'administrator',
          entityId: String(created.id),
          ip: audit.ip,
          userAgent: audit.userAgent,
          requestId: audit.requestId,
          metadata: {
            target_username: input.username,
            role: input.role,
            display_name: input.displayName,
          },
        })

        return mapUser(created)
      })
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError('Username already exists', 'USERNAME_TAKEN')
      }
      throw error
    }
  }

  async update(
    id: string,
    input: AdminUserUpdateInput,
    audit: AdminUserAuditContext
  ): Promise<AdminUser> {
    return this.runTransaction(async connection => {
      const currentRows = await executeOn<AdminUserRow[]>(
        connection,
        `${ADMIN_SELECT} WHERE id = ? LIMIT 1 FOR UPDATE`,
        [id]
      )
      const current = currentRows[0]
      if (!current) throw new NotFoundError('Administrator not found')

      const currentId = Number(current.id)
      const currentActive = current.is_active === 1
      const nextRole = input.role ?? current.role
      const nextActive = input.isActive ?? currentActive

      if (input.isActive === false && currentId === audit.adminId) {
        throw new ConflictError(
          'You cannot deactivate your own account',
          'SELF_DEACTIVATION'
        )
      }

      const removesActiveSuperAdmin =
        current.role === 'superadmin' &&
        currentActive &&
        (nextRole !== 'superadmin' || !nextActive)

      if (removesActiveSuperAdmin) {
        const activeSuperAdmins = await executeOn<ActiveAdminRow[]>(
          connection,
          `SELECT id
             FROM administrators
            WHERE role = 'superadmin'
              AND is_active = 1
            FOR UPDATE`
        )
        if (activeSuperAdmins.length <= 1) {
          throw new ConflictError(
            'The last active super administrator cannot be demoted or deactivated',
            'LAST_SUPER_ADMIN'
          )
        }
      }

      const assignments: string[] = []
      const params: unknown[] = []

      if (input.displayName !== undefined) {
        assignments.push('display_name = ?')
        params.push(input.displayName)
      }
      if (input.role !== undefined) {
        assignments.push('role = ?')
        params.push(input.role)
      }
      if (input.isActive !== undefined) {
        assignments.push('is_active = ?')
        params.push(input.isActive ? 1 : 0)
      }
      if (input.passwordHash) {
        assignments.push('password_hash = ?', 'failed_login_count = 0', 'locked_until = NULL')
        params.push(input.passwordHash)
      }

      if (assignments.length === 0) {
        throw new ValidationError('No changes provided')
      }

      params.push(String(currentId))
      await executeOn<ResultSetHeader>(
        connection,
        `UPDATE administrators SET ${assignments.join(', ')} WHERE id = ?`,
        params
      )

      if (nextActive === false || input.passwordHash) {
        await executeOn<ResultSetHeader>(
          connection,
          `UPDATE admin_sessions
              SET revoked_at = UTC_TIMESTAMP()
            WHERE admin_id = ?
              AND revoked_at IS NULL`,
          [String(currentId)]
        )
      }

      if (input.passwordHash) {
        await insertAuditLog(connection, {
          actorType: 'admin',
          actorId: audit.adminId,
          action: 'admin.user.password_reset',
          entityType: 'administrator',
          entityId: String(currentId),
          ip: audit.ip,
          userAgent: audit.userAgent,
          requestId: audit.requestId,
          metadata: auditMetadata(current, {}),
        })
      }

      if (input.role !== undefined && input.role !== current.role) {
        await insertAuditLog(connection, {
          actorType: 'admin',
          actorId: audit.adminId,
          action: 'admin.user.role_changed',
          entityType: 'administrator',
          entityId: String(currentId),
          ip: audit.ip,
          userAgent: audit.userAgent,
          requestId: audit.requestId,
          metadata: auditMetadata(current, {
            previous_role: current.role,
            new_role: input.role,
          }),
        })
      }

      if (input.isActive !== undefined && nextActive !== currentActive) {
        await insertAuditLog(connection, {
          actorType: 'admin',
          actorId: audit.adminId,
          action: nextActive ? 'admin.user.activated' : 'admin.user.deactivated',
          entityType: 'administrator',
          entityId: String(currentId),
          ip: audit.ip,
          userAgent: audit.userAgent,
          requestId: audit.requestId,
          metadata: auditMetadata(current, {
            previous_is_active: currentActive,
            is_active: nextActive,
          }),
        })
      }

      if (
        input.displayName !== undefined &&
        input.displayName !== current.display_name
      ) {
        await insertAuditLog(connection, {
          actorType: 'admin',
          actorId: audit.adminId,
          action: 'admin.user.updated',
          entityType: 'administrator',
          entityId: String(currentId),
          ip: audit.ip,
          userAgent: audit.userAgent,
          requestId: audit.requestId,
          metadata: auditMetadata(current, {
            previous_display_name: current.display_name,
            display_name: input.displayName,
          }),
        })
      }

      const updatedRows = await executeOn<AdminUserRow[]>(
        connection,
        `${ADMIN_SELECT} WHERE id = ? LIMIT 1`,
        [String(currentId)]
      )
      const updated = updatedRows[0]
      if (!updated) throw new NotFoundError('Administrator not found')
      return mapUser(updated)
    })
  }

  async listAudit(limit: number): Promise<AdminAuditEntry[]> {
    const rows = await dbQuery<AuditRow[]>(
      `SELECT l.id,
              l.actor_type,
              l.actor_id,
              a.username AS actor_username,
              l.action,
              l.entity_type,
              l.entity_id,
              l.metadata,
              l.created_at
         FROM audit_logs l
         LEFT JOIN administrators a ON a.id = l.actor_id
        WHERE l.entity_type = 'administrator'
           OR l.action LIKE 'admin.user.%'
        ORDER BY l.created_at DESC, l.id DESC
        LIMIT ?`,
      [limit]
    )
    return rows.map(mapAudit)
  }
}
