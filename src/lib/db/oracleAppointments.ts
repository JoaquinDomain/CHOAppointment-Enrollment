import oracledb from 'oracledb'
import {
  executeOracle,
  fromNumber01,
  toISOString,
  toNumber01,
} from './oracle'
import type {
  Appointment,
  AppointmentInput,
  AppointmentRepository,
} from './types'

// Server-only Oracle implementation of the appointment repository.
// Expects the APPOINTMENTS table from docs/oracle-schema.sql.

interface OracleAppointmentRow {
  ID: number
  FULL_NAME: string
  AGE: number
  APPOINTMENT_DATE?: string | null
  BIRTHDATE?: string | null
  GENDER?: string | null
  CIVIL_STATUS?: string | null
  RESIDENTIAL_ADDRESS?: string | null
  CONTACT_NUMBER?: string | null
  SPOUSE_NAME?: string | null
  MOTHERS_MAIDEN_NAME?: string | null
  EMPLOYMENT_STATUS?: string | null
  PRIMARY_CARE_BENEFIT_MEMBER?: number | null
  CONSULTING_FACILITY: string
  YAKAP_REGISTERED?: number | null
  YAKAP_FACILITY?: string | null
  SERVICE_TYPE: string
  APPOINTMENT_TIME?: string | null
  PHILHEALTH_MEMBER?: number | null
  PHILHEALTH_NUMBER?: string | null
  PHILHEALTH_STATUS?: string | null
  FACILITY_HOUSEHOLD_NUMBER?: string | null
  PWD?: number | null
  DATA_PRIVACY_CONSENT?: number | null
  NOTES?: string | null
  CREATED_AT?: unknown
  UPDATED_AT?: unknown
}

const BASE_COLUMNS = `
  ID, FULL_NAME, AGE,
  TO_CHAR(APPOINTMENT_DATE, 'YYYY-MM-DD') AS APPOINTMENT_DATE,
  TO_CHAR(BIRTHDATE, 'YYYY-MM-DD') AS BIRTHDATE,
  GENDER, CIVIL_STATUS, RESIDENTIAL_ADDRESS, CONTACT_NUMBER,
  SPOUSE_NAME, MOTHERS_MAIDEN_NAME, EMPLOYMENT_STATUS,
  PRIMARY_CARE_BENEFIT_MEMBER, CONSULTING_FACILITY,
  YAKAP_REGISTERED, YAKAP_FACILITY, SERVICE_TYPE, APPOINTMENT_TIME,
  PHILHEALTH_MEMBER, PHILHEALTH_NUMBER, PHILHEALTH_STATUS,
  FACILITY_HOUSEHOLD_NUMBER, PWD, DATA_PRIVACY_CONSENT, NOTES,
  CREATED_AT, UPDATED_AT
`

function mapRow(row: OracleAppointmentRow): Appointment {
  return {
    id: String(row.ID),
    full_name: row.FULL_NAME,
    age: Number(row.AGE),
    appointment_date: row.APPOINTMENT_DATE ?? '',
    birthdate: row.BIRTHDATE ?? undefined,
    gender: row.GENDER ?? undefined,
    civil_status: row.CIVIL_STATUS ?? undefined,
    residential_address: row.RESIDENTIAL_ADDRESS ?? undefined,
    contact_number: row.CONTACT_NUMBER ?? undefined,
    spouse_name: row.SPOUSE_NAME ?? undefined,
    mothers_maiden_name: row.MOTHERS_MAIDEN_NAME ?? undefined,
    employment_status: row.EMPLOYMENT_STATUS ?? undefined,
    primary_care_benefit_member: fromNumber01(row.PRIMARY_CARE_BENEFIT_MEMBER),
    consulting_facility: row.CONSULTING_FACILITY,
    yakap_registered: fromNumber01(row.YAKAP_REGISTERED),
    yakap_facility: row.YAKAP_FACILITY ?? undefined,
    service_type: row.SERVICE_TYPE,
    appointment_time: row.APPOINTMENT_TIME ?? undefined,
    philhealth_member: fromNumber01(row.PHILHEALTH_MEMBER),
    philhealth_number: row.PHILHEALTH_NUMBER ?? undefined,
    philhealth_status: row.PHILHEALTH_STATUS ?? undefined,
    facility_household_number: row.FACILITY_HOUSEHOLD_NUMBER ?? undefined,
    pwd: fromNumber01(row.PWD),
    data_privacy_consent: fromNumber01(row.DATA_PRIVACY_CONSENT),
    notes: row.NOTES ?? undefined,
    created_at: toISOString(row.CREATED_AT),
    updated_at: toISOString(row.UPDATED_AT),
  }
}

function toBinds(a: AppointmentInput): oracledb.BindParameters {
  return {
    full_name: a.full_name,
    age: a.age,
    appointment_date: a.appointment_date,
    birthdate: a.birthdate ?? null,
    gender: a.gender ?? null,
    civil_status: a.civil_status ?? null,
    residential_address: a.residential_address ?? null,
    contact_number: a.contact_number ?? null,
    spouse_name: a.spouse_name ?? null,
    mothers_maiden_name: a.mothers_maiden_name ?? null,
    employment_status: a.employment_status ?? null,
    primary_care_benefit_member: toNumber01(a.primary_care_benefit_member),
    consulting_facility: a.consulting_facility,
    yakap_registered: toNumber01(a.yakap_registered),
    yakap_facility: a.yakap_facility ?? null,
    service_type: a.service_type,
    appointment_time: a.appointment_time ?? null,
    philhealth_member: toNumber01(a.philhealth_member),
    philhealth_number: a.philhealth_number ?? null,
    philhealth_status: a.philhealth_status ?? null,
    facility_household_number: a.facility_household_number ?? null,
    pwd: toNumber01(a.pwd),
    data_privacy_consent: toNumber01(a.data_privacy_consent),
    notes: a.notes ?? null,
  }
}

const UPDATABLE_COLUMNS = [
  'full_name',
  'age',
  'birthdate',
  'gender',
  'civil_status',
  'residential_address',
  'contact_number',
  'spouse_name',
  'mothers_maiden_name',
  'employment_status',
  'primary_care_benefit_member',
  'consulting_facility',
  'yakap_registered',
  'yakap_facility',
  'service_type',
  'appointment_date',
  'appointment_time',
  'philhealth_member',
  'philhealth_number',
  'philhealth_status',
  'facility_household_number',
  'pwd',
  'data_privacy_consent',
  'notes',
] as const

type UpdatableColumn = (typeof UPDATABLE_COLUMNS)[number]

const FLAG_COLUMNS: ReadonlySet<string> = new Set([
  'primary_care_benefit_member',
  'yakap_registered',
  'philhealth_member',
  'pwd',
  'data_privacy_consent',
])

const DATE_COLUMNS: ReadonlySet<string> = new Set(['appointment_date', 'birthdate'])

function buildSetClause(updates: Partial<AppointmentInput>): {
  clause: string
  binds: oracledb.BindParameters
} {
  const sets: string[] = []
  const binds: oracledb.BindParameters = {}

  for (const column of UPDATABLE_COLUMNS) {
    const value = updates[column as UpdatableColumn]
    if (value === undefined) continue

    if (DATE_COLUMNS.has(column)) {
      sets.push(`${column.toUpperCase()} = TO_DATE(:${column}, 'YYYY-MM-DD')`)
      binds[column] = (value as string | null) ?? null
    } else if (FLAG_COLUMNS.has(column)) {
      sets.push(`${column.toUpperCase()} = :${column}`)
      binds[column] = toNumber01(value as boolean | undefined | null)
    } else {
      sets.push(`${column.toUpperCase()} = :${column}`)
      binds[column] = (value as string | number | null) ?? null
    }
  }

  sets.push('UPDATED_AT = SYSTIMESTAMP')
  return { clause: sets.join(', '), binds }
}

export class OracleAppointmentRepository implements AppointmentRepository {
  async createAppointment(appointment: AppointmentInput): Promise<Appointment> {
    const { rows, outBinds } = await executeOracle<OracleAppointmentRow>(
      `INSERT INTO APPOINTMENTS (
         FULL_NAME, AGE, APPOINTMENT_DATE, BIRTHDATE, GENDER, CIVIL_STATUS,
         RESIDENTIAL_ADDRESS, CONTACT_NUMBER, SPOUSE_NAME, MOTHERS_MAIDEN_NAME,
         EMPLOYMENT_STATUS, PRIMARY_CARE_BENEFIT_MEMBER, CONSULTING_FACILITY,
         YAKAP_REGISTERED, YAKAP_FACILITY, SERVICE_TYPE, APPOINTMENT_TIME,
         PHILHEALTH_MEMBER, PHILHEALTH_NUMBER, PHILHEALTH_STATUS,
         FACILITY_HOUSEHOLD_NUMBER, PWD, DATA_PRIVACY_CONSENT, NOTES
       ) VALUES (
         :full_name, :age, TO_DATE(:appointment_date, 'YYYY-MM-DD'),
         CASE WHEN :birthdate IS NULL THEN NULL ELSE TO_DATE(:birthdate, 'YYYY-MM-DD') END,
         :gender, :civil_status, :residential_address, :contact_number,
         :spouse_name, :mothers_maiden_name, :employment_status,
         :primary_care_benefit_member, :consulting_facility, :yakap_registered,
         :yakap_facility, :service_type, :appointment_time, :philhealth_member,
         :philhealth_number, :philhealth_status, :facility_household_number,
         :pwd, :data_privacy_consent, :notes
       ) RETURNING ID INTO :id`,
      {
        ...toBinds(appointment),
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      }
    )

    void rows
    const outId = outBinds as { id?: number[] } | undefined
    const id = outId?.id?.[0]
    if (id === undefined) {
      throw new Error('Oracle insert did not return an ID.')
    }

    const created = await this.getAppointmentById(String(id))
    if (!created) {
      throw new Error('Failed to read back the created appointment.')
    }
    return created
  }

  async getAllAppointments(): Promise<Appointment[]> {
    const { rows } = await executeOracle<OracleAppointmentRow>(
      `SELECT ${BASE_COLUMNS} FROM APPOINTMENTS ORDER BY CREATED_AT DESC`
    )
    return rows.map(mapRow)
  }

  async getAppointmentById(id: string): Promise<Appointment | null> {
    const numericId = Number(id)
    if (!Number.isInteger(numericId)) {
      return null
    }
    const { rows } = await executeOracle<OracleAppointmentRow>(
      `SELECT ${BASE_COLUMNS} FROM APPOINTMENTS WHERE ID = :id`,
      { id: numericId }
    )
    return rows.length > 0 ? mapRow(rows[0]) : null
  }

  async getAppointmentsByDate(date: string): Promise<Appointment[]> {
    const { rows } = await executeOracle<OracleAppointmentRow>(
      `SELECT ${BASE_COLUMNS} FROM APPOINTMENTS
       WHERE APPOINTMENT_DATE = TO_DATE(:date, 'YYYY-MM-DD')
       ORDER BY CREATED_AT DESC`,
      { date }
    )
    return rows.map(mapRow)
  }

  async getAppointmentsByFacility(facility: string): Promise<Appointment[]> {
    const { rows } = await executeOracle<OracleAppointmentRow>(
      `SELECT ${BASE_COLUMNS} FROM APPOINTMENTS
       WHERE CONSULTING_FACILITY = :facility
       ORDER BY CREATED_AT DESC`,
      { facility }
    )
    return rows.map(mapRow)
  }

  async searchAppointmentsByName(name: string): Promise<Appointment[]> {
    const { rows } = await executeOracle<OracleAppointmentRow>(
      `SELECT ${BASE_COLUMNS} FROM APPOINTMENTS
       WHERE UPPER(FULL_NAME) LIKE UPPER(:name)
       ORDER BY CREATED_AT DESC`,
      { name: `%${name}%` }
    )
    return rows.map(mapRow)
  }

  async updateAppointment(
    id: string,
    updates: Partial<AppointmentInput>
  ): Promise<Appointment> {
    const numericId = Number(id)
    if (!Number.isInteger(numericId)) {
      throw new Error(`Invalid appointment id: ${id}`)
    }
    const { clause, binds } = buildSetClause(updates)
    if (Object.keys(binds).length === 0) {
      const current = await this.getAppointmentById(id)
      if (!current) {
        throw new Error(`Appointment not found: ${id}`)
      }
      return current
    }

    await executeOracle(
      `UPDATE APPOINTMENTS SET ${clause} WHERE ID = :id`,
      { ...binds, id: numericId }
    )

    const updated = await this.getAppointmentById(id)
    if (!updated) {
      throw new Error(`Appointment not found: ${id}`)
    }
    return updated
  }

  async deleteAppointment(id: string): Promise<void> {
    const numericId = Number(id)
    if (!Number.isInteger(numericId)) {
      throw new Error(`Invalid appointment id: ${id}`)
    }
    await executeOracle(`DELETE FROM APPOINTMENTS WHERE ID = :id`, {
      id: numericId,
    })
  }

  async getAppointmentsCount(date: string, serviceType: string): Promise<number> {
    const { rows } = await executeOracle<{ CNT: number }>(
      `SELECT COUNT(*) AS CNT FROM APPOINTMENTS
       WHERE APPOINTMENT_DATE = TO_DATE(:date, 'YYYY-MM-DD')
       AND SERVICE_TYPE = :serviceType`,
      { date, serviceType }
    )
    return Number(rows[0]?.CNT ?? 0)
  }
}
