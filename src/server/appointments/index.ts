import type { AppointmentRepository } from './appointment.repository'
import { MySqlAppointmentRepository } from './mysql-appointments'
import { AppointmentService } from './appointment.service'

export type {
  AdminListFilters,
  AppointmentRepository,
  BookingContext,
} from './appointment.repository'
export { AppointmentService } from './appointment.service'
export {
  getAppointmentDateError,
  parseAndValidateAppointmentInput,
  parseAdminSearch,
  parseDateFilter,
  parseFacilityFilter,
  parseLimit,
  parseStatusFilter,
  parseAppointmentStatus,
} from './appointment.validation'
export type { NormalizedAppointmentInput } from './appointment.validation'
export type {
  AdminAppointment,
  AdminAppointmentDetail,
  AppointmentAvailability,
  AppointmentInput,
  AppointmentStatus,
  AppointmentSummary,
  BookingResult,
  PublicAppointmentStatus,
} from '@/types/appointment'

let cachedRepository: AppointmentRepository | null = null

export function getAppointmentRepository(): AppointmentRepository {
  if (!cachedRepository) {
    cachedRepository = new MySqlAppointmentRepository()
  }
  return cachedRepository
}

export function getAppointmentService(): AppointmentService {
  return new AppointmentService(getAppointmentRepository())
}
