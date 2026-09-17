// Backend entry point — repository factory + public re-exports.
// Select persistence with DB_PROVIDER=supabase (default) | oracle.

import { getDbProvider, type DbProvider } from '@/server/config/env'
import type { AppointmentRepository } from './appointment.repository'
import { OracleAppointmentRepository } from './oracle-appointments'
import { SupabaseAppointmentRepository } from './supabase-appointments'
import { AppointmentService } from './appointment.service'

export type { AppointmentRepository } from './appointment.repository'
export { AppointmentService, ValidationError } from './appointment.service'
export { validateAppointmentInput, isWeekend, isPastDate } from './appointment.validation'
export type { Appointment, AppointmentInput } from '@/types/appointment'
export type { DbProvider }

let cached: { provider: DbProvider; repo: AppointmentRepository } | null = null

export function getAppointmentRepository(): AppointmentRepository {
  const provider = getDbProvider()
  if (!cached || cached.provider !== provider) {
    cached = {
      provider,
      repo:
        provider === 'oracle'
          ? new OracleAppointmentRepository()
          : new SupabaseAppointmentRepository(),
    }
  }
  return cached.repo
}

export function getAppointmentService(): AppointmentService {
  return new AppointmentService(getAppointmentRepository())
}
