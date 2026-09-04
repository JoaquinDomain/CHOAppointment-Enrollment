import { OracleAppointmentRepository } from './oracleAppointments'
import { SupabaseAppointmentRepository } from './supabaseAppointments'
import type { AppointmentRepository } from './types'

// Server-only factory. Select the persistence backend with DB_PROVIDER:
//   DB_PROVIDER=supabase  (default, current behavior)
//   DB_PROVIDER=oracle    (requires ORACLE_* env + docs/oracle-schema.sql)

export type DbProvider = 'supabase' | 'oracle'

export function getDbProvider(): DbProvider {
  return process.env.DB_PROVIDER === 'oracle' ? 'oracle' : 'supabase'
}

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
