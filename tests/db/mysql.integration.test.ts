import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Pool, RowDataPacket } from 'mysql2/promise'
import { BACOLOD_HEALTH_FACILITIES } from '@/constants/facilities'
import { isHoliday } from '@/constants/phHolidays'
import {
  assertTestDatabaseSafety,
  createTestPool,
  dropTestSchema,
  hasTestDatabase,
  migrateTestDatabase,
  pointApplicationAtTestDatabase,
  resetTestDatabase,
} from './helpers'

type DbModule = typeof import('@/server/db/mysql')
type AuthModule = typeof import('@/server/auth/session')
type PasswordModule = typeof import('@/server/auth/password')
type QrModule = typeof import('@/server/security/qr-token')
type ErrorsModule = typeof import('@/server/errors')
type DateModule = typeof import('@/server/utils/date')
type ValidationModule = typeof import('@/server/appointments/appointment.validation')
type RepositoryModule = typeof import('@/server/appointments/mysql-appointments')
type ServiceModule = typeof import('@/server/appointments/appointment.service')
type MySqlRepository = InstanceType<RepositoryModule['MySqlAppointmentRepository']>
type AppointmentService = InstanceType<ServiceModule['AppointmentService']>
type NormalizedInput = ReturnType<ValidationModule['parseAndValidateAppointmentInput']>

const describeDb = hasTestDatabase ? describe : describe.skip

const CONTEXT = {
  ip: '203.0.113.5',
  userAgent: 'vitest-mysql-integration',
  requestId: 'integration-request',
}

let testPool: Pool
let db: DbModule
let auth: AuthModule
let passwordModule: PasswordModule
let qr: QrModule
let errors: ErrorsModule
let dateUtils: DateModule
let validation: ValidationModule
let repository: MySqlRepository
let appointmentService: AppointmentService

let patientSequence = 0

function nextBookableDate(): string {
  const today = dateUtils.todayInManila()
  for (let offset = 1; offset <= 60; offset += 1) {
    const candidate = dateUtils.addDaysISO(today, offset)
    if (!dateUtils.isWeekendISODate(candidate) && !isHoliday(candidate)) {
      return candidate
    }
  }
  throw new Error('No bookable date found in the test window')
}

function bookingInput(
  sequence: number,
  overrides: Partial<Parameters<ValidationModule['parseAndValidateAppointmentInput']>[0]> = {}
): NormalizedInput {
  patientSequence += 1
  const contactSuffix = String(1_000_000 + patientSequence).slice(-7)
  return validation.parseAndValidateAppointmentInput({
    first_name: 'Integration',
    middle_name: 'Test',
    last_name: `Patient${sequence}`,
    birthdate: '1990-01-15',
    gender: 'Female',
    civil_status: 'Single',
    residential_address: '123 Integration Street, Bacolod City',
    contact_number: `0917${contactSuffix}`,
    primary_care_benefit_member: false,
    consulting_facility: BACOLOD_HEALTH_FACILITIES[0],
    yakap_registered: false,
    service_type: 'consultation',
    appointment_date: nextBookableDate(),
    philhealth_member: false,
    pwd: false,
    data_privacy_consent: true,
    ...overrides,
  })
}

async function setServiceCapacity(serviceId: string, capacity: number): Promise<void> {
  await testPool.execute(
    'UPDATE laboratory_services SET daily_capacity = ? WHERE id = ?',
    [capacity, serviceId]
  )
}

async function createAdmin(
  username = 'integration-admin',
  plainPassword = 'integration-password-123'
): Promise<number> {
  const hash = await passwordModule.hashPassword(plainPassword)
  const result = await db.dbExecute(
    `INSERT INTO administrators (username, password_hash, role, is_active)
     VALUES (?, ?, 'superadmin', 1)`,
    [username, hash]
  )
  return Number(result.insertId)
}

async function scalar(sql: string, params: unknown[] = []): Promise<number> {
  const [rows] = await testPool.query<RowDataPacket[]>(sql, params)
  return Number(rows[0]?.value ?? 0)
}

describeDb('MySQL 8.0 integration', () => {
  beforeAll(async () => {
    assertTestDatabaseSafety()
    pointApplicationAtTestDatabase()

    testPool = createTestPool()
    await dropTestSchema(testPool)
    await migrateTestDatabase()

    db = await import('@/server/db/mysql')
    auth = await import('@/server/auth/session')
    passwordModule = await import('@/server/auth/password')
    qr = await import('@/server/security/qr-token')
    errors = await import('@/server/errors')
    dateUtils = await import('@/server/utils/date')
    validation = await import('@/server/appointments/appointment.validation')
    const repositoryModule = await import('@/server/appointments/mysql-appointments')
    const serviceModule = await import('@/server/appointments/appointment.service')

    repository = new repositoryModule.MySqlAppointmentRepository()
    appointmentService = new serviceModule.AppointmentService(repository)
  })

  beforeEach(async () => {
    await resetTestDatabase(testPool)
    await setServiceCapacity('consultation', 50)
    await setServiceCapacity('prenatal', 30)
  })

  afterAll(async () => {
    if (db) await db.closeDatabasePool()
    if (testPool) await testPool.end()
  })

  it('connects, reuses one pool, and passes startup verification', async () => {
    expect(db.getPool()).toBe(db.getPool())

    const rows = await db.dbQuery<RowDataPacket[]>('SELECT 1 AS ok')
    expect(Number(rows[0]?.ok)).toBe(1)

    await expect(db.checkDatabaseConnection()).resolves.toBeUndefined()
    await expect(db.checkRequiredTables()).resolves.toEqual([])
  })

  it('serves concurrent queries through the pool', async () => {
    const results = await Promise.all(
      Array.from({ length: 24 }, () =>
        db.dbQuery<RowDataPacket[]>('SELECT 1 AS ok')
      )
    )
    expect(results).toHaveLength(24)
  })

  it('persists patient enrollment, appointment, consent, and status history', async () => {
    const input = bookingInput(1)
    const summary = await repository.createAppointment(input, CONTEXT)

    const [patients] = await testPool.query<RowDataPacket[]>(
      'SELECT id, full_name, contact_number FROM patients'
    )
    expect(patients).toHaveLength(1)
    expect(patients[0].full_name).toBe(input.fullName)
    expect(patients[0].contact_number).toBe(input.contactNumber)

    const [appointments] = await testPool.query<RowDataPacket[]>(
      'SELECT id, patient_id, public_id, status FROM appointments WHERE public_id = ?',
      [summary.public_id]
    )
    expect(appointments).toHaveLength(1)
    expect(appointments[0].status).toBe('scheduled')
    expect(Number(appointments[0].patient_id)).toBe(Number(patients[0].id))

    expect(
      await scalar('SELECT COUNT(*) AS value FROM consent_records')
    ).toBe(1)
    expect(
      await scalar('SELECT COUNT(*) AS value FROM appointment_status_history')
    ).toBe(1)
  })

  it('updates appointment status and writes history plus audit records atomically', async () => {
    const adminId = await createAdmin()
    const summary = await repository.createAppointment(bookingInput(2), CONTEXT)
    const [appointments] = await testPool.query<RowDataPacket[]>(
      'SELECT id FROM appointments WHERE public_id = ?',
      [summary.public_id]
    )
    const appointmentId = String(appointments[0].id)

    const detail = await repository.updateStatus(appointmentId, 'confirmed', {
      adminId,
      adminUsername: 'integration-admin',
      ip: CONTEXT.ip,
      userAgent: CONTEXT.userAgent,
      requestId: CONTEXT.requestId,
    })

    expect(detail.status).toBe('confirmed')
    const [history] = await testPool.query<RowDataPacket[]>(
      `SELECT from_status, to_status
         FROM appointment_status_history
        WHERE appointment_id = ?
        ORDER BY id ASC`,
      [appointmentId]
    )
    expect(history.some(row => row.from_status === 'scheduled' && row.to_status === 'confirmed')).toBe(
      true
    )
    expect(
      await scalar(
        `SELECT COUNT(*) AS value FROM audit_logs
          WHERE action = 'appointment.status_updated' AND entity_id = ?`,
        [appointmentId]
      )
    ).toBe(1)
  })

  it('resolves QR verification and public status through the database', async () => {
    const summary = await repository.createAppointment(bookingInput(3), CONTEXT)

    const publicStatus = await repository.getByPublicId(summary.public_id)
    expect(publicStatus?.public_id).toBe(summary.public_id)
    expect(publicStatus?.patient_display_name).toContain('Integration')

    const detail = await repository.getAdminDetailByPublicId(summary.public_id)
    expect(detail?.public_id).toBe(summary.public_id)

    const { token } = qr.createAppointmentStatusUrl(
      summary.public_id,
      summary.appointment_date
    )
    const scanned = await appointmentService.scanQr(token)
    expect(scanned.public_id).toBe(summary.public_id)

    await expect(appointmentService.scanQr('v1.invalid.invalid.invalid')).rejects.toBeInstanceOf(
      errors.NotFoundError
    )
  })

  it('authenticates an administrator and persists a hashed session token', async () => {
    const adminId = await createAdmin('session-admin', 'integration-password-123')

    const created = await auth.authenticateAdmin(
      'session-admin',
      'integration-password-123',
      CONTEXT
    )
    expect(created.token.length).toBeGreaterThan(32)
    expect(created.csrfToken.length).toBeGreaterThan(32)

    const [sessions] = await testPool.query<RowDataPacket[]>(
      'SELECT token_hash, expires_at FROM admin_sessions WHERE admin_id = ?',
      [adminId]
    )
    expect(sessions).toHaveLength(1)
    expect(sessions[0].token_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(sessions[0].token_hash).not.toBe(created.token)

    const validated = await auth.validateAdminSession(created.token)
    expect(validated?.adminId).toBe(adminId)

    await auth.revokeAdminSession(created.token)
    await expect(auth.validateAdminSession(created.token)).resolves.toBeNull()
  })

  it('rolls back the patient insert when capacity is exhausted', async () => {
    await setServiceCapacity('consultation', 1)

    await repository.createAppointment(bookingInput(10), CONTEXT)
    const patientsBefore = await scalar('SELECT COUNT(*) AS value FROM patients')

    await expect(
      repository.createAppointment(bookingInput(11), CONTEXT)
    ).rejects.toBeInstanceOf(errors.CapacityExceededError)

    const patientsAfter = await scalar('SELECT COUNT(*) AS value FROM patients')
    expect(patientsAfter).toBe(patientsBefore)
    expect(
      await scalar(
        `SELECT booked_count AS value
           FROM service_daily_capacity
          WHERE service_id = 'consultation'`
      )
    ).toBe(1)
  })

  it('handles duplicate submissions without double-counting capacity', async () => {
    const input = bookingInput(20)

    await repository.createAppointment(input, CONTEXT)
    await expect(repository.createAppointment(input, CONTEXT)).rejects.toBeInstanceOf(
      errors.DuplicateBookingError
    )

    expect(
      await scalar(
        `SELECT booked_count AS value
           FROM service_daily_capacity
          WHERE service_id = 'consultation'`
      )
    ).toBe(1)
    expect(await scalar('SELECT COUNT(*) AS value FROM appointments')).toBe(1)
  })

  it('never exceeds daily capacity under concurrent bookings', async () => {
    const capacity = 3
    await setServiceCapacity('consultation', capacity)
    const date = nextBookableDate()
    const inputs = Array.from({ length: 12 }, (_, index) =>
      bookingInput(100 + index, { appointment_date: date })
    )

    const results = await Promise.allSettled(
      inputs.map(input => repository.createAppointment(input, CONTEXT))
    )

    const fulfilled = results.filter(result => result.status === 'fulfilled')
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    )

    expect(fulfilled).toHaveLength(capacity)
    expect(rejected).toHaveLength(inputs.length - capacity)
    for (const result of rejected) {
      expect(result.reason).toBeInstanceOf(errors.CapacityExceededError)
    }

    expect(
      await scalar(
        `SELECT booked_count AS value
           FROM service_daily_capacity
          WHERE service_id = 'consultation' AND appointment_date = ?`,
        [date]
      )
    ).toBe(capacity)
    expect(
      await scalar(
        'SELECT COUNT(*) AS value FROM appointments WHERE appointment_date = ?',
        [date]
      )
    ).toBe(capacity)
    expect(await scalar('SELECT COUNT(*) AS value FROM patients')).toBe(capacity)
  })

  it('recovers after the application pool is closed', async () => {
    await db.closeDatabasePool()
    await expect(db.checkDatabaseConnection()).resolves.toBeUndefined()
  })

  it('reports an unreachable database as a database unavailable error', async () => {
    await db.closeDatabasePool()
    const originalPort = process.env.DB_PORT
    process.env.DB_PORT = '1'
    try {
      await expect(db.checkDatabaseConnection()).rejects.toBeInstanceOf(
        errors.DatabaseUnavailableError
      )
    } finally {
      process.env.DB_PORT = originalPort
      await db.closeDatabasePool()
    }
    await expect(db.checkDatabaseConnection()).resolves.toBeUndefined()
  })

  it('binds injected search terms instead of executing them', async () => {
    await repository.createAppointment(bookingInput(200), CONTEXT)
    const rows = await repository.listForAdmin({
      search: "' OR '1'='1' -- ",
      facility: null,
      status: null,
      date: null,
      limit: 10,
    })
    expect(rows).toEqual([])
  })

  it.skipIf(process.env.DB_TEST_STRICT_PRIVILEGES !== 'yes')(
    'rejects server-level DDL for the application account',
    async () => {
      await expect(
        db.dbExecute(`CREATE DATABASE cho_integration_should_not_exist_${Date.now()}`)
      ).rejects.toMatchObject({
        code: expect.stringMatching(/DENIED|ACCESS|PRIVILEGE/),
      })
    }
  )
})
