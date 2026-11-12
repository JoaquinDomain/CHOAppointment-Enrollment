import type {
  AdminAppointment,
  AdminAppointmentDetail,
  AppointmentAvailability,
  AppointmentStatus,
  AppointmentSummary,
  PublicAppointmentStatus,
} from '@/types/appointment'
import type { NormalizedAppointmentInput } from './appointment.validation'

export interface AdminListFilters {
  search: string | null
  facility: string | null
  status: AppointmentStatus | null
  date: string | null
  limit: number
}

export interface BookingContext {
  ip: string
  userAgent: string
  requestId: string
}

export interface AppointmentRepository {
  createAppointment(
    input: NormalizedAppointmentInput,
    context: BookingContext
  ): Promise<AppointmentSummary>
  listForAdmin(filters: AdminListFilters): Promise<AdminAppointment[]>
  getAdminDetail(id: string): Promise<AdminAppointmentDetail | null>
  getAdminDetailByPublicId(publicId: string): Promise<AdminAppointmentDetail | null>
  getByPublicId(publicId: string): Promise<PublicAppointmentStatus | null>
  getAvailability(date: string): Promise<AppointmentAvailability>
  updateStatus(
    id: string,
    status: AppointmentStatus,
    audit: {
      adminId: number
      adminUsername: string
      ip: string
      userAgent: string
      requestId: string
    }
  ): Promise<AdminAppointmentDetail>
}
