// Application service — validates input then delegates to the repository.

import type { Appointment, AppointmentInput } from '@/types/appointment'
import type { AppointmentRepository } from './appointment.repository'
import { validateAppointmentInput } from './appointment.validation'

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class AppointmentService {
  constructor(private readonly repository: AppointmentRepository) {}

  listAll(): Promise<Appointment[]> {
    return this.repository.getAllAppointments()
  }

  async create(body: AppointmentInput): Promise<Appointment> {
    const error = validateAppointmentInput(body)
    if (error) throw new ValidationError(error)
    return this.repository.createAppointment(body)
  }
}
