// Provider-agnostic persistence contract for appointments.

import type { Appointment, AppointmentInput } from '@/types/appointment'

export interface AppointmentRepository {
  createAppointment(appointment: AppointmentInput): Promise<Appointment>
  getAllAppointments(): Promise<Appointment[]>
  getAppointmentById(id: string): Promise<Appointment | null>
  getAppointmentsByDate(date: string): Promise<Appointment[]>
  getAppointmentsByFacility(facility: string): Promise<Appointment[]>
  searchAppointmentsByName(name: string): Promise<Appointment[]>
  updateAppointment(id: string, updates: Partial<AppointmentInput>): Promise<Appointment>
  deleteAppointment(id: string): Promise<void>
  getAppointmentsCount(date: string, serviceType: string): Promise<number>
}
