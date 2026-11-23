import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { insertAuditLog } from '@/server/auth/audit'
import { dbQuery, executeOn, withTransaction } from '@/server/db/mysql'
import { NotFoundError } from '@/server/errors'
import type { AdminService } from '@/types/service'
import type {
  ServiceRepository,
  ServiceUpdateAudit,
  ServiceUpdateInput,
} from './service.repository'
import { isValidServiceId } from './service.validation'

interface ServiceRow extends RowDataPacket {
  id: string
  name: string
  description: string | null
  daily_capacity: number
  requires_time_slot: number
  is_active: number
  external_url: string | null
}

const SERVICE_SELECT = `
  SELECT id, name, description, daily_capacity, requires_time_slot, is_active, external_url
    FROM laboratory_services
`

function mapService(row: ServiceRow): AdminService {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    daily_capacity: Number(row.daily_capacity),
    requires_time_slot: row.requires_time_slot === 1,
    is_active: row.is_active === 1,
    external_url: row.external_url,
  }
}

export class MySqlServiceRepository implements ServiceRepository {
  async listForAdmin(): Promise<AdminService[]> {
    const rows = await dbQuery<ServiceRow[]>(
      `${SERVICE_SELECT} ORDER BY name ASC, id ASC`
    )
    return rows.map(mapService)
  }

  async update(
    id: string,
    input: ServiceUpdateInput,
    audit: ServiceUpdateAudit
  ): Promise<AdminService> {
    if (!isValidServiceId(id)) {
      throw new NotFoundError('Service not found')
    }

    return withTransaction(async connection => {
      const currentRows = await executeOn<ServiceRow[]>(
        connection,
        `${SERVICE_SELECT} WHERE id = ? LIMIT 1 FOR UPDATE`,
        [id]
      )
      const current = currentRows[0]
      if (!current) throw new NotFoundError('Service not found')

      const previousCapacity = Number(current.daily_capacity)
      const previousActive = current.is_active === 1
      const nextCapacity = input.dailyCapacity ?? previousCapacity
      const nextActive = input.isActive ?? previousActive

      await executeOn<ResultSetHeader>(
        connection,
        `UPDATE laboratory_services
            SET daily_capacity = ?, is_active = ?
          WHERE id = ?`,
        [nextCapacity, nextActive ? 1 : 0, id]
      )

      await insertAuditLog(connection, {
        actorType: 'admin',
        actorId: audit.adminId,
        action: 'service.updated',
        entityType: 'laboratory_service',
        entityId: id,
        ip: audit.ip,
        userAgent: audit.userAgent,
        requestId: audit.requestId,
        metadata: {
          daily_capacity: nextCapacity,
          is_active: nextActive,
          previous_daily_capacity: previousCapacity,
          previous_is_active: previousActive,
        },
      })

      const updatedRows = await executeOn<ServiceRow[]>(
        connection,
        `${SERVICE_SELECT} WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!updatedRows[0]) throw new NotFoundError('Service not found')
      return mapService(updatedRows[0])
    })
  }
}
