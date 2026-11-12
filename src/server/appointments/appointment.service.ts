import type {
  AdminAppointment,
  AdminAppointmentDetail,
  AppointmentAvailability,
  AppointmentStatus,
  BookingResult,
  PublicAppointmentStatus,
} from '@/types/appointment'
import { NotFoundError } from '@/server/errors'
import {
  createAppointmentStatusUrl,
  verifyAppointmentToken,
} from '@/server/security/qr-token'
import { isWeekendISODate, isValidISODate, todayInManila } from '@/server/utils/date'
import type {
  AdminListFilters,
  AppointmentRepository,
  BookingContext,
} from './appointment.repository'
import {
  getAppointmentDateError,
  parseAndValidateAppointmentInput,
} from './appointment.validation'

export class AppointmentService {
  constructor(private readonly repository: AppointmentRepository) {}

  async create(body: Record<string, unknown>, context: BookingContext): Promise<BookingResult> {
    const input = parseAndValidateAppointmentInput(body)
    const appointment = await this.repository.createAppointment(input, context)
    const qr = createAppointmentStatusUrl(appointment.public_id, appointment.appointment_date)
    return {
      public_id: appointment.public_id,
      qr_url: qr.url,
      appointment,
    }
  }

  listForAdmin(filters: AdminListFilters): Promise<AdminAppointment[]> {
    return this.repository.listForAdmin(filters)
  }

  async getAdminDetail(id: string): Promise<AdminAppointmentDetail> {
    const detail = await this.repository.getAdminDetail(id)
    if (!detail) throw new NotFoundError('Appointment not found')
    return detail
  }

  async getAvailability(date: string): Promise<AppointmentAvailability> {
    if (!isValidISODate(date)) {
      return {
        date,
        available: false,
        reason: 'Date must be a valid date in YYYY-MM-DD format',
        services: [],
      }
    }
    if (isWeekendISODate(date)) {
      return {
        date,
        available: false,
        reason: 'Weekend appointments are not available',
        services: [],
      }
    }
    const dateError = getAppointmentDateError(date)
    if (dateError) {
      return { date, available: false, reason: dateError, services: [] }
    }
    return this.repository.getAvailability(date)
  }

  async getPublicStatus(token: string): Promise<PublicAppointmentStatus> {
    const verified = verifyAppointmentToken(token)
    if (!verified) {
      throw new NotFoundError('This appointment link is invalid or has expired')
    }
    const status = await this.repository.getByPublicId(verified.publicId)
    if (!status) {
      throw new NotFoundError('Appointment not found')
    }
    return status
  }

  async scanQr(token: string): Promise<AdminAppointmentDetail> {
    const verified = verifyAppointmentToken(token)
    if (!verified) {
      throw new NotFoundError('Invalid or expired QR code')
    }
    const detail = await this.repository.getAdminDetailByPublicId(verified.publicId)
    if (!detail) {
      throw new NotFoundError('Appointment not found for this QR code')
    }
    return detail
  }

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
  ): Promise<AdminAppointmentDetail> {
    return this.repository.updateStatus(id, status, audit)
  }

  today(): string {
    return todayInManila()
  }
}
