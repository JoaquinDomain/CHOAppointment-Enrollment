// Shared appointment record shape used by every database provider.
// `id` is a UUID string on Supabase and a numeric identity (as string) on Oracle.

export interface Appointment {
  id?: string
  full_name: string
  age: number
  birthdate?: string
  gender?: string
  civil_status?: string
  residential_address?: string
  contact_number?: string
  spouse_name?: string
  mothers_maiden_name?: string
  employment_status?: string
  primary_care_benefit_member?: boolean
  consulting_facility: string
  yakap_registered: boolean
  yakap_facility?: string
  service_type: string
  appointment_date: string
  appointment_time?: string
  philhealth_member?: boolean
  philhealth_number?: string
  philhealth_status?: string
  facility_household_number?: string
  pwd?: boolean
  data_privacy_consent?: boolean
  notes?: string
  created_at?: string
  updated_at?: string
}

export type AppointmentInput = Omit<Appointment, 'id' | 'created_at' | 'updated_at'>

/** Provider-agnostic persistence contract for appointments. */
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
