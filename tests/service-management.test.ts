import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotFoundError, ValidationError } from '@/server/errors'
import { parseServiceUpdateInput } from '@/server/services/service.validation'

const { executeOn, withTransaction, dbQuery, insertAuditLog } = vi.hoisted(() => {
  const executeOn = vi.fn()
  const withTransaction = vi.fn(
    async (operation: (connection: unknown) => Promise<unknown>) => operation({})
  )
  return {
    executeOn,
    withTransaction,
    dbQuery: vi.fn(),
    insertAuditLog: vi.fn(async () => undefined),
  }
})

vi.mock('@/server/db/mysql', () => ({
  dbQuery,
  dbExecute: vi.fn(),
  executeOn,
  withTransaction,
  isDatabaseConnectivityError: () => false,
  isUniqueConstraintError: () => false,
}))

vi.mock('@/server/auth/audit', () => ({
  insertAuditLog,
}))

import { MySqlServiceRepository } from '@/server/services/mysql-services'

const AUDIT = {
  adminId: 7,
  adminUsername: 'cho.admin',
  ip: '203.0.113.9',
  userAgent: 'vitest',
  requestId: 'req-service',
}

interface ServiceRowFixture {
  id: string
  name: string
  description: string | null
  daily_capacity: number
  requires_time_slot: number
  is_active: number
  external_url: string | null
}

function serviceRow(overrides: Partial<ServiceRowFixture> = {}): ServiceRowFixture {
  return {
    id: 'consultation',
    name: 'Medical Consultation',
    description: 'General medical and pediatric consultation',
    daily_capacity: 50,
    requires_time_slot: 0,
    is_active: 1,
    external_url: null,
    ...overrides,
  }
}

function arrangeUpdate(current: ServiceRowFixture, updated: ServiceRowFixture) {
  executeOn.mockImplementation(async (_connection: unknown, sql: string) => {
    const statement = String(sql)
    if (statement.includes('FOR UPDATE')) return [current]
    if (statement.includes('UPDATE laboratory_services')) return { affectedRows: 1 }
    if (statement.includes('FROM laboratory_services')) return [updated]
    return { affectedRows: 1 }
  })
}

beforeEach(() => {
  executeOn.mockReset()
  withTransaction.mockClear()
  dbQuery.mockReset()
  insertAuditLog.mockClear()
})

describe('service update validation', () => {
  it('accepts a daily capacity and an availability flag', () => {
    expect(parseServiceUpdateInput({ daily_capacity: 75, is_active: true })).toEqual({
      dailyCapacity: 75,
      isActive: true,
    })
  })

  it('accepts only the field that was provided', () => {
    expect(parseServiceUpdateInput({ is_active: false })).toEqual({ isActive: false })
    expect(parseServiceUpdateInput({ daily_capacity: 0 })).toEqual({ dailyCapacity: 0 })
  })

  it('rejects an empty update', () => {
    expect(() => parseServiceUpdateInput({})).toThrow(ValidationError)
  })

  it.each([-1, 1.5, 100_001, Number.NaN])(
    'rejects an invalid daily capacity of %s',
    capacity => {
      expect(() => parseServiceUpdateInput({ daily_capacity: capacity })).toThrow(
        ValidationError
      )
    }
  )

  it('rejects a non-numeric daily capacity', () => {
    expect(() => parseServiceUpdateInput({ daily_capacity: '50' })).toThrow(ValidationError)
  })

  it('rejects a non-boolean availability flag', () => {
    expect(() => parseServiceUpdateInput({ is_active: 'yes' })).toThrow(ValidationError)
  })
})

describe('service repository', () => {
  it('lists services with boolean flags mapped from the database', async () => {
    dbQuery.mockResolvedValue([
      serviceRow({ id: 'prenatal', requires_time_slot: 1, is_active: 0 }),
    ])

    const services = await new MySqlServiceRepository().listForAdmin()

    expect(services).toEqual([
      {
        id: 'prenatal',
        name: 'Medical Consultation',
        description: 'General medical and pediatric consultation',
        daily_capacity: 50,
        requires_time_slot: true,
        is_active: false,
        external_url: null,
      },
    ])
  })

  it('updates the daily limit and availability and writes an audit record', async () => {
    arrangeUpdate(
      serviceRow({ daily_capacity: 50, is_active: 1 }),
      serviceRow({ daily_capacity: 75, is_active: 0 })
    )

    const updated = await new MySqlServiceRepository().update(
      'consultation',
      { dailyCapacity: 75, isActive: false },
      AUDIT
    )

    expect(withTransaction).toHaveBeenCalledTimes(1)
    expect(updated).toMatchObject({ daily_capacity: 75, is_active: false })

    const updateCall = executeOn.mock.calls.find(call =>
      String(call[1]).includes('UPDATE laboratory_services')
    )
    expect(updateCall).toBeDefined()
    expect((updateCall as [unknown, string, unknown[]])[2]).toEqual([
      75,
      0,
      'consultation',
    ])

    expect(insertAuditLog).toHaveBeenCalledTimes(1)
    expect(insertAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'service.updated',
        entityType: 'laboratory_service',
        entityId: 'consultation',
        actorId: 7,
        metadata: expect.objectContaining({
          daily_capacity: 75,
          is_active: false,
          previous_daily_capacity: 50,
          previous_is_active: true,
        }),
      })
    )
  })

  it('keeps the existing values for fields that are not provided', async () => {
    arrangeUpdate(
      serviceRow({ daily_capacity: 50, is_active: 1 }),
      serviceRow({ daily_capacity: 50, is_active: 0 })
    )

    await new MySqlServiceRepository().update('consultation', { isActive: false }, AUDIT)

    const updateCall = executeOn.mock.calls.find(call =>
      String(call[1]).includes('UPDATE laboratory_services')
    )
    expect((updateCall as [unknown, string, unknown[]])[2]).toEqual([
      50,
      0,
      'consultation',
    ])
  })

  it('rejects a malformed service id without opening a transaction', async () => {
    await expect(
      new MySqlServiceRepository().update('../etc/passwd', { isActive: false }, AUDIT)
    ).rejects.toBeInstanceOf(NotFoundError)

    expect(withTransaction).not.toHaveBeenCalled()
  })

  it('rejects a service that no longer exists', async () => {
    executeOn.mockResolvedValue([])

    await expect(
      new MySqlServiceRepository().update('unknown-service', { isActive: false }, AUDIT)
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})
