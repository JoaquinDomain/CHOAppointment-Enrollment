import { createHash, randomUUID } from 'node:crypto'
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import { getAppConfig } from '@/server/config/env'
import {
  dbQuery,
  executeOn,
  isUniqueConstraintError,
  withTransaction,
} from '@/server/db/mysql'
import {
  CapacityExceededError,
  DuplicateBookingError,
  NotFoundError,
  ValidationError,
} from '@/server/errors'
import { insertAuditLog } from '@/server/auth/audit'
import { calculateAge, todayInManila } from '@/server/utils/date'
import type {
  AdminAppointment,
  AdminAppointmentDetail,
  AppointmentAvailability,
  AppointmentStatus,
  AppointmentSummary,
  PublicAppointmentStatus,
} from '@/types/appointment'
import type {
  AdminListFilters,
  AppointmentRepository,
  BookingContext,
} from './appointment.repository'
import type { NormalizedAppointmentInput } from './appointment.validation'

interface AppointmentRow extends RowDataPacket {
  id: string | number
  public_id: string
  appointment_date: string
  appointment_time: string | null
  service_id: string
  service_name: string
  consulting_facility: string
  status: AppointmentStatus
  notes: string | null
  created_at: string
  updated_at: string
  full_name: string
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
  birthdate: string
  gender: string
  civil_status: string | null
  residential_address: string
  contact_number: string
  spouse_name: string | null
  mothers_maiden_name: string | null
  employment_status: string | null
  primary_care_benefit_member: number
  yakap_registered: number
  yakap_facility: string | null
  philhealth_member: number
  philhealth_number: string | null
  philhealth_status: string | null
  facility_household_number: string | null
  pwd: number
}

/**
 * Columns returned by the administrator list endpoint.
 *
 * The list view does not display the home address, the contact number, the
 * PhilHealth number, or the household number, so those columns are neither
 * selected nor returned. The individual record endpoint still provides them
 * to an authenticated administrator who opens a patient record.
 */
interface AppointmentListRow extends RowDataPacket {
  id: string | number
  public_id: string
  appointment_date: string
  appointment_time: string | null
  service_id: string
  service_name: string
  consulting_facility: string
  status: AppointmentStatus
  created_at: string
  full_name: string
  birthdate: string
  yakap_registered: number
}

interface CapacityRow extends RowDataPacket {
  daily_capacity: number
}

interface ExistingAppointmentRow extends RowDataPacket {
  id: string | number
}

interface StatusRow extends RowDataPacket {
  id: string | number
  service_id: string
  appointment_date: string
  status: AppointmentStatus
}

interface AvailabilityRow extends RowDataPacket {
  id: string
  name: string
  daily_capacity: number
  booked_count: number | null
}

const DETAIL_SELECT = `
  SELECT a.id, a.public_id, a.appointment_date, a.appointment_time, a.service_id,
         s.name AS service_name, a.consulting_facility, a.status, a.notes,
         a.created_at, a.updated_at,
         p.full_name, p.first_name, p.middle_name, p.last_name, p.suffix,
         p.birthdate, p.gender, p.civil_status, p.residential_address,
         p.contact_number, p.spouse_name, p.mothers_maiden_name, p.employment_status,
         p.primary_care_benefit_member, p.yakap_registered, p.yakap_facility,
         p.philhealth_member, p.philhealth_number, p.philhealth_status,
         p.facility_household_number, p.pwd
    FROM appointments a
    INNER JOIN patients p ON p.id = a.patient_id
    INNER JOIN laboratory_services s ON s.id = a.service_id
`

const LIST_SELECT = `
  SELECT a.id, a.public_id, a.appointment_date, a.appointment_time, a.service_id,
         s.name AS service_name, a.consulting_facility, a.status, a.created_at,
         p.full_name, p.birthdate, p.yakap_registered
    FROM appointments a
    INNER JOIN patients p ON p.id = a.patient_id
    INNER JOIN laboratory_services s ON s.id = a.service_id
`

function hashIp(ip: string): string | null {
  if (!ip || ip === 'unknown') return null
  return createHash('sha256').update(ip).digest('hex')
}

function mapSummary(row: AppointmentRow | AppointmentListRow): AppointmentSummary {
  return {
    public_id: row.public_id,
    full_name: row.full_name,
    appointment_date: row.appointment_date,
    appointment_time: row.appointment_time,
    service_type: row.service_id,
    service_name: row.service_name,
    consulting_facility: row.consulting_facility,
    status: row.status,
    created_at: row.created_at,
  }
}

function mapAdminAppointment(row: AppointmentRow | AppointmentListRow): AdminAppointment {
  return {
    ...mapSummary(row),
    id: String(row.id),
    age: calculateAge(row.birthdate, todayInManila()),
    yakap_registered: row.yakap_registered === 1,
  }
}

function mapDetail(row: AppointmentRow): AdminAppointmentDetail {
  return {
    ...mapAdminAppointment(row),
    first_name: row.first_name,
    middle_name: row.middle_name ?? undefined,
    last_name: row.last_name,
    suffix: row.suffix ?? undefined,
    contact_number: row.contact_number,
    residential_address: row.residential_address,
    birthdate: row.birthdate,
    gender: row.gender,
    civil_status: row.civil_status ?? undefined,
    spouse_name: row.spouse_name ?? undefined,
    mothers_maiden_name: row.mothers_maiden_name ?? undefined,
    employment_status: row.employment_status ?? undefined,
    primary_care_benefit_member: row.primary_care_benefit_member === 1,
    yakap_facility: row.yakap_facility ?? undefined,
    philhealth_member: row.philhealth_member === 1,
    philhealth_number: row.philhealth_number ?? undefined,
    philhealth_status: row.philhealth_status ?? undefined,
    facility_household_number: row.facility_household_number ?? undefined,
    pwd: row.pwd === 1,
    notes: row.notes ?? undefined,
    updated_at: row.updated_at,
  }
}

function maskFullName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 1) return `${parts[0].slice(0, 1)}***`
  const first = parts[0]
  const lastInitial = parts[parts.length - 1].slice(0, 1)
  return `${first} ${lastInitial}.`
}

function isNumericId(value: string): boolean {
  return /^\d{1,20}$/.test(value)
}

export class MySqlAppointmentRepository implements AppointmentRepository {
  async createAppointment(
    input: NormalizedAppointmentInput,
    context: BookingContext
  ): Promise<AppointmentSummary> {
    const config = getAppConfig()

    return withTransaction(async connection => {
      const capacityRows = await executeOn<CapacityRow[]>(
        connection,
        `SELECT daily_capacity
           FROM laboratory_services
          WHERE id = ? AND is_active = 1
          LIMIT 1`,
        [input.service.id]
      )
      if (!capacityRows[0]) {
        throw new ValidationError('Selected service is not available')
      }
      const capacity = Number(capacityRows[0].daily_capacity)

      const patientResult = await executeOn<ResultSetHeader>(
        connection,
        `INSERT INTO patients (
           full_name, first_name, middle_name, last_name, suffix, birthdate, gender,
           civil_status, residential_address, contact_number, spouse_name,
           mothers_maiden_name, employment_status, primary_care_benefit_member,
           yakap_registered, yakap_facility, philhealth_member, philhealth_number,
           philhealth_status, facility_household_number, pwd
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
        [
          input.fullName,
          input.firstName,
          input.middleName,
          input.lastName,
          input.suffix,
          input.birthdate,
          input.gender,
          input.civilStatus,
          input.residentialAddress,
          input.contactNumber,
          input.spouseName,
          input.mothersMaidenName,
          input.employmentStatus,
          input.primaryCareBenefitMember ? 1 : 0,
          input.yakapRegistered ? 1 : 0,
          input.yakapFacility,
          input.philhealthMember ? 1 : 0,
          input.philhealthNumber,
          input.philhealthStatus,
          input.facilityHouseholdNumber,
          input.pwd ? 1 : 0,
        ]
      )
      const patientId = Number(patientResult.insertId)
      if (!patientId) {
        throw new Error('Failed to persist patient record')
      }

      const existingRows = await executeOn<ExistingAppointmentRow[]>(
        connection,
        `SELECT id
           FROM appointments
          WHERE patient_id = ?
            AND service_id = ?
            AND appointment_date = ?
            AND status IN ('scheduled', 'confirmed', 'completed', 'no_show')
          LIMIT 1
          FOR UPDATE`,
        [patientId, input.service.id, input.appointmentDate]
      )
      if (existingRows.length > 0) {
        throw new DuplicateBookingError()
      }

      await executeOn<ResultSetHeader>(
        connection,
        `INSERT INTO service_daily_capacity
           (service_id, appointment_date, booked_count, capacity)
         VALUES (?, ?, 0, ?)
         ON DUPLICATE KEY UPDATE service_id = service_id`,
        [input.service.id, input.appointmentDate, capacity]
      )

      const reservation = await executeOn<ResultSetHeader>(
        connection,
        `UPDATE service_daily_capacity
            SET capacity = GREATEST(capacity, ?),
                booked_count = booked_count + 1
          WHERE service_id = ?
            AND appointment_date = ?
            AND booked_count < ?`,
        [capacity, input.service.id, input.appointmentDate, capacity]
      )
      if (reservation.affectedRows !== 1) {
        throw new CapacityExceededError()
      }

      const publicId = randomUUID()
      let appointmentId: number
      try {
        const appointmentResult = await executeOn<ResultSetHeader>(
          connection,
          `INSERT INTO appointments
             (public_id, patient_id, service_id, appointment_date, appointment_time,
              consulting_facility, status, notes)
           VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
          [
            publicId,
            patientId,
            input.service.id,
            input.appointmentDate,
            input.appointmentTime,
            input.consultingFacility,
            input.notes,
          ]
        )
        appointmentId = Number(appointmentResult.insertId)
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new DuplicateBookingError()
        }
        throw error
      }

      await executeOn<ResultSetHeader>(
        connection,
        `INSERT INTO consent_records
           (patient_id, appointment_id, consent_version, ip_hash, user_agent)
         VALUES (?, ?, ?, ?, ?)`,
        [
          patientId,
          appointmentId,
          config.consentVersion,
          hashIp(context.ip),
          context.userAgent.slice(0, 255),
        ]
      )

      await executeOn<ResultSetHeader>(
        connection,
        `INSERT INTO appointment_status_history
           (appointment_id, from_status, to_status, changed_by_admin_id, reason)
         VALUES (?, NULL, 'scheduled', NULL, 'Booking created')`,
        [appointmentId]
      )

      const rows = await executeOn<AppointmentRow[]>(
        connection,
        `${DETAIL_SELECT} WHERE a.id = ? LIMIT 1`,
        [appointmentId]
      )
      if (!rows[0]) {
        throw new Error('Failed to read back the created appointment')
      }
      return mapSummary(rows[0])
    })
  }

  async listForAdmin(filters: AdminListFilters): Promise<AdminAppointment[]> {
    const conditions: string[] = []
    const params: unknown[] = []

    if (filters.search) {
      const like = `%${filters.search}%`
      if (isNumericId(filters.search)) {
        conditions.push('(a.id = ? OR a.public_id LIKE ? OR p.full_name LIKE ?)')
        params.push(Number(filters.search), like, like)
      } else {
        conditions.push('(a.public_id LIKE ? OR p.full_name LIKE ?)')
        params.push(like, like)
      }
    }
    if (filters.facility) {
      conditions.push('a.consulting_facility = ?')
      params.push(filters.facility)
    }
    if (filters.status) {
      conditions.push('a.status = ?')
      params.push(filters.status)
    }
    if (filters.date) {
      conditions.push('a.appointment_date = ?')
      params.push(filters.date)
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    params.push(filters.limit)

    const rows = await dbQuery<AppointmentListRow[]>(
      `${LIST_SELECT} ${whereClause} ORDER BY a.created_at DESC, a.id DESC LIMIT ?`,
      params
    )
    return rows.map(mapAdminAppointment)
  }

  async getAdminDetail(id: string): Promise<AdminAppointmentDetail | null> {
    if (!isNumericId(id)) return null
    const rows = await dbQuery<AppointmentRow[]>(
      `${DETAIL_SELECT} WHERE a.id = ? LIMIT 1`,
      [Number(id)]
    )
    return rows[0] ? mapDetail(rows[0]) : null
  }

  async getAdminDetailByPublicId(publicId: string): Promise<AdminAppointmentDetail | null> {
    if (!/^[A-Za-z0-9-]{8,64}$/.test(publicId)) return null
    const rows = await dbQuery<AppointmentRow[]>(
      `${DETAIL_SELECT} WHERE a.public_id = ? LIMIT 1`,
      [publicId]
    )
    return rows[0] ? mapDetail(rows[0]) : null
  }

  async getByPublicId(publicId: string): Promise<PublicAppointmentStatus | null> {
    if (!/^[A-Za-z0-9-]{8,64}$/.test(publicId)) return null
    const rows = await dbQuery<AppointmentRow[]>(
      `${DETAIL_SELECT} WHERE a.public_id = ? LIMIT 1`,
      [publicId]
    )
    const row = rows[0]
    if (!row) return null
    return {
      public_id: row.public_id,
      patient_display_name: maskFullName(row.full_name),
      appointment_date: row.appointment_date,
      appointment_time: row.appointment_time,
      service_name: row.service_name,
      consulting_facility: row.consulting_facility,
      status: row.status,
    }
  }

  async getAvailability(date: string): Promise<AppointmentAvailability> {
    const rows = await dbQuery<AvailabilityRow[]>(
      `SELECT s.id, s.name, s.daily_capacity, c.booked_count
         FROM laboratory_services s
         LEFT JOIN service_daily_capacity c
           ON c.service_id = s.id AND c.appointment_date = ?
        WHERE s.is_active = 1
          AND s.external_url IS NULL
        ORDER BY s.id ASC`,
      [date]
    )

    return {
      date,
      available: true,
      services: rows.map(row => {
        const capacity = Number(row.daily_capacity)
        const booked = Number(row.booked_count ?? 0)
        return {
          id: row.id,
          name: row.name,
          capacity,
          booked,
          remaining: Math.max(0, capacity - booked),
        }
      }),
    }
  }

  async updateStatus(
    id: string,
    status: AppointmentStatus,
    audit: {
      adminId: number
      adminUsername: string
      ip: string
      userAgent: string
      requestId: string
    }
  ): Promise<AdminAppointmentDetail> {
    if (!isNumericId(id)) throw new NotFoundError('Appointment not found')
    const appointmentId = Number(id)

    try {
      await withTransaction(async connection => {
        const rows = await executeOn<StatusRow[]>(
          connection,
          `SELECT id, service_id, appointment_date, status
             FROM appointments
            WHERE id = ?
            LIMIT 1
            FOR UPDATE`,
          [appointmentId]
        )
        const current = rows[0]
        if (!current) throw new NotFoundError('Appointment not found')
        if (current.status === status) return

        if (current.status === 'cancelled' && status !== 'cancelled') {
          const capRows = await executeOn<CapacityRow[]>(
            connection,
            'SELECT daily_capacity FROM laboratory_services WHERE id = ? LIMIT 1',
            [current.service_id]
          )
          const capacity = Number(capRows[0]?.daily_capacity ?? 0)
          const reservation = await executeOn<ResultSetHeader>(
            connection,
            `UPDATE service_daily_capacity
                SET capacity = GREATEST(capacity, ?),
                    booked_count = booked_count + 1
              WHERE service_id = ?
                AND appointment_date = ?
                AND booked_count < ?`,
            [capacity, current.service_id, current.appointment_date, capacity]
          )
          if (reservation.affectedRows !== 1) throw new CapacityExceededError()
        } else if (current.status !== 'cancelled' && status === 'cancelled') {
          await executeOn<ResultSetHeader>(
            connection,
            `UPDATE service_daily_capacity
                SET booked_count = IF(booked_count > 0, booked_count - 1, 0)
              WHERE service_id = ?
                AND appointment_date = ?`,
            [current.service_id, current.appointment_date]
          )
        }

        await executeOn<ResultSetHeader>(
          connection,
          'UPDATE appointments SET status = ? WHERE id = ?',
          [status, appointmentId]
        )
        await executeOn<ResultSetHeader>(
          connection,
          `INSERT INTO appointment_status_history
             (appointment_id, from_status, to_status, changed_by_admin_id, reason)
           VALUES (?, ?, ?, ?, ?)`,
          [appointmentId, current.status, status, audit.adminId, 'Status updated in admin dashboard']
        )
        await insertAuditLog(connection, {
          actorType: 'admin',
          actorId: audit.adminId,
          action: 'appointment.status_updated',
          entityType: 'appointment',
          entityId: String(appointmentId),
          ip: audit.ip,
          userAgent: audit.userAgent,
          requestId: audit.requestId,
          metadata: { from: current.status, to: status },
        })
      })
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new DuplicateBookingError()
      throw error
    }

    const detail = await this.getAdminDetail(id)
    if (!detail) throw new NotFoundError('Appointment not found')
    return detail
  }
}
