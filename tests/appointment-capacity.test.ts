import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BACOLOD_HEALTH_FACILITIES } from '@/constants/facilities'
import { isHoliday } from '@/constants/phHolidays'
import { parseAndValidateAppointmentInput } from '@/server/appointments/appointment.validation'
import { CapacityExceededError, DuplicateBookingError } from '@/server/errors'
import { addDaysISO, isWeekendISODate, todayInManila } from '@/server/utils/date'

const { executeOn, withTransaction, dbQuery, dbExecute } = vi.hoisted(() => {
  const executeOn = vi.fn()
  const withTransaction = vi.fn(
    async (operation: (connection: unknown) => Promise<unknown>) => operation({})
  )
  return { executeOn, withTransaction, dbQuery: vi.fn(), dbExecute: vi.fn() }
})

vi.mock('@/server/db/mysql', () => ({
  dbQuery,
  dbExecute,
  executeOn,
  withTransaction,
  isDatabaseConnectivityError: () => false,
  isUniqueConstraintError: (error: { code?: string }) => error?.code === 'ER_DUP_ENTRY',
}))

import { MySqlAppointmentRepository } from '@/server/appointments/mysql-appointments'

function nextBookableDate(): string {
  const today = todayInManila()
  for (let offset = 1; offset <= 30; offset += 1) {
    const candidate = addDaysISO(today, offset)
    if (!isWeekendISODate(candidate) && !isHoliday(candidate)) return candidate
  }
  throw new Error('No bookable date found in test window')
}

function bookingInput() {
  return parseAndValidateAppointmentInput({
    first_name: 'Maria',
    middle_name: 'Cruz',
    last_name: 'Santos',
    suffix: 'Jr.',
    birthdate: '1990-01-15',
    gender: 'Female',
    civil_status: 'Single',
    residential_address: '123 Lacson Street, Bacolod City',
    contact_number: '+63 917 123 4567',
    primary_care_benefit_member: false,
    consulting_facility: BACOLOD_HEALTH_FACILITIES[0],
    yakap_registered: false,
    service_type: 'consultation',
    appointment_date: nextBookableDate(),
    philhealth_member: false,
    pwd: false,
    data_privacy_consent: true,
  })
}

const CONTEXT = { ip: '203.0.113.5', userAgent: 'vitest', requestId: 'req-1' }

interface DbBehaviour {
  dailyCapacity?: number
  capacityAffectedRows?: number
  existingAppointment?: boolean
  appointmentInsertError?: Error
}

function arrangeDatabase(behaviour: DbBehaviour) {
  const capacity = behaviour.dailyCapacity ?? 2
  const capacityAffectedRows = behaviour.capacityAffectedRows ?? 1

  executeOn.mockImplementation(async (_connection: unknown, sql: string, params: unknown[]) => {
    if (sql.includes('FROM laboratory_services') && sql.includes('daily_capacity')) {
      return [{ daily_capacity: capacity }]
    }
    if (sql.includes('INSERT INTO patients')) {
      return { insertId: 42, affectedRows: 1 }
    }
    if (sql.includes('FROM appointments') && sql.includes('FOR UPDATE')) {
      return behaviour.existingAppointment ? [{ id: 5 }] : []
    }
    if (sql.includes('INSERT INTO service_daily_capacity')) {
      return { affectedRows: 1 }
    }
    if (sql.includes('UPDATE service_daily_capacity')) {
      expect(params).toContain(capacity)
      return { affectedRows: capacityAffectedRows }
    }
    if (sql.includes('INSERT INTO appointments')) {
      if (behaviour.appointmentInsertError) throw behaviour.appointmentInsertError
      return { insertId: 99, affectedRows: 1 }
    }
    if (sql.includes('INSERT INTO consent_records')) {
      return { affectedRows: 1 }
    }
    if (sql.includes('INSERT INTO appointment_status_history')) {
      return { affectedRows: 1 }
    }
    if (sql.includes('FROM appointments a')) {
      return [
        {
          id: 99,
          public_id: '5a9f7c2e-6b6a-4c5d-9f24-3d2b1a0c9e88',
          appointment_date: '2026-11-12',
          appointment_time: null,
          service_id: 'consultation',
          service_name: 'Medical Consultation',
          consulting_facility: BACOLOD_HEALTH_FACILITIES[0],
          status: 'scheduled',
          notes: null,
          created_at: '2026-11-01 08:00:00',
          updated_at: '2026-11-01 08:00:00',
          full_name: 'Maria Cruz Santos Jr.',
          birthdate: '1990-01-15',
          gender: 'Female',
          civil_status: 'Single',
          residential_address: '123 Lacson Street, Bacolod City',
          contact_number: '09171234567',
          spouse_name: null,
          mothers_maiden_name: null,
          employment_status: null,
          primary_care_benefit_member: 0,
          yakap_registered: 0,
          yakap_facility: null,
          philhealth_member: 0,
          philhealth_number: null,
          philhealth_status: null,
          facility_household_number: null,
          pwd: 0,
        },
      ]
    }
    return { affectedRows: 1 }
  })
}

beforeEach(() => {
  executeOn.mockReset()
  withTransaction.mockClear()
  dbQuery.mockReset()
  dbExecute.mockReset()
  process.env.APP_URL = 'https://example.test'
  process.env.APP_SECRET = 'test-secret-that-is-longer-than-thirty-two-characters'
})

describe('appointment capacity control', () => {
  it('reserves capacity with a conditional update inside a transaction', async () => {
    arrangeDatabase({ dailyCapacity: 3 })

    const summary = await new MySqlAppointmentRepository().createAppointment(
      bookingInput(),
      CONTEXT
    )

    expect(summary.public_id).toBe('5a9f7c2e-6b6a-4c5d-9f24-3d2b1a0c9e88')
    expect(withTransaction).toHaveBeenCalledTimes(1)

    const reservation = executeOn.mock.calls.find(call =>
      String(call[1]).includes('UPDATE service_daily_capacity')
    )
    expect(reservation).toBeDefined()
    const [, sql, params] = reservation as [unknown, string, unknown[]]
    expect(sql).toContain('booked_count = booked_count + 1')
    expect(sql).toContain('booked_count < ?')
    expect(params).toContain(3)
  })

  it('rejects the booking when the daily capacity is already taken', async () => {
    arrangeDatabase({ dailyCapacity: 1, capacityAffectedRows: 0 })

    await expect(
      new MySqlAppointmentRepository().createAppointment(bookingInput(), CONTEXT)
    ).rejects.toBeInstanceOf(CapacityExceededError)

    const insertedAppointment = executeOn.mock.calls.some(call =>
      String(call[1]).includes('INSERT INTO appointments')
    )
    expect(insertedAppointment).toBe(false)
  })
})

describe('duplicate booking prevention', () => {
  it('rejects a second booking for the same patient, service, and date', async () => {
    arrangeDatabase({ existingAppointment: true })

    await expect(
      new MySqlAppointmentRepository().createAppointment(bookingInput(), CONTEXT)
    ).rejects.toBeInstanceOf(DuplicateBookingError)

    const reservedCapacity = executeOn.mock.calls.some(call =>
      String(call[1]).includes('UPDATE service_daily_capacity')
    )
    expect(reservedCapacity).toBe(false)
  })

  it('maps a unique-constraint violation to a duplicate booking error', async () => {
    arrangeDatabase({
      appointmentInsertError: Object.assign(new Error('Duplicate entry'), {
        code: 'ER_DUP_ENTRY',
      }),
    })

    await expect(
      new MySqlAppointmentRepository().createAppointment(bookingInput(), CONTEXT)
    ).rejects.toBeInstanceOf(DuplicateBookingError)
  })
})
