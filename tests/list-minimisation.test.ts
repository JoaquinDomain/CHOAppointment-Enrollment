import { beforeEach, describe, expect, it, vi } from 'vitest'

const { dbQuery, dbExecute } = vi.hoisted(() => ({
  dbQuery: vi.fn(),
  dbExecute: vi.fn(),
}))

vi.mock('@/server/db/mysql', () => ({
  dbQuery,
  dbExecute,
  isDatabaseConnectivityError: () => false,
  isUniqueConstraintError: () => false,
  withTransaction: vi.fn(),
  executeOn: vi.fn(),
}))

import { MySqlAppointmentRepository } from '@/server/appointments/mysql-appointments'

const LIST_ROW = {
  id: 99,
  public_id: '5a9f7c2e-6b6a-4c5d-9f24-3d2b1a0c9e88',
  appointment_date: '2026-11-12',
  appointment_time: null,
  service_id: 'consultation',
  service_name: 'Medical Consultation',
  consulting_facility: 'Main Health Center',
  status: 'scheduled',
  created_at: '2026-11-01 08:00:00',
  full_name: 'Maria Cruz Santos Jr.',
  birthdate: '1990-01-15',
  yakap_registered: 0,
}

beforeEach(() => {
  dbQuery.mockReset().mockResolvedValue([LIST_ROW])
  dbExecute.mockReset()
})

describe('administrator list response minimisation', () => {
  it('does not return the address or the contact number in the list', async () => {
    const rows = await new MySqlAppointmentRepository().listForAdmin({
      search: null,
      facility: null,
      status: null,
      date: null,
      limit: 100,
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]).not.toHaveProperty('residential_address')
    expect(rows[0]).not.toHaveProperty('contact_number')
    expect(rows[0]).not.toHaveProperty('philhealth_number')
    expect(rows[0]).not.toHaveProperty('facility_household_number')
    expect(rows[0]).not.toHaveProperty('mothers_maiden_name')

    const serialised = JSON.stringify(rows)
    expect(serialised).not.toContain('residential_address')
    expect(serialised).not.toContain('contact_number')
  })

  it('does not select the sensitive patient columns from the database', async () => {
    await new MySqlAppointmentRepository().listForAdmin({
      search: null,
      facility: null,
      status: null,
      date: null,
      limit: 100,
    })

    const [sql] = dbQuery.mock.calls[0] as [string]
    expect(sql).not.toContain('residential_address')
    expect(sql).not.toContain('contact_number')
    expect(sql).not.toContain('philhealth_number')
    expect(sql).not.toContain('facility_household_number')
    expect(sql).not.toContain('mothers_maiden_name')
    expect(sql).not.toContain('spouse_name')
  })

  it('still returns the fields the list view needs', async () => {
    const rows = await new MySqlAppointmentRepository().listForAdmin({
      search: null,
      facility: null,
      status: null,
      date: null,
      limit: 100,
    })

    expect(rows[0].public_id).toBe(LIST_ROW.public_id)
    expect(rows[0].full_name).toBe(LIST_ROW.full_name)
    expect(rows[0].service_name).toBe(LIST_ROW.service_name)
    expect(rows[0].age).toBeGreaterThan(0)
    expect(rows[0].yakap_registered).toBe(false)
  })
})
