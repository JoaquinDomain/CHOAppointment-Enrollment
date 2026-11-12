export const APPOINTMENT_STATUSES = [
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
] as const

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

export function isAppointmentStatus(value: unknown): value is AppointmentStatus {
  return typeof value === 'string' && (APPOINTMENT_STATUSES as readonly string[]).includes(value)
}

export interface PatientNameParts {
  first_name: string
  middle_name?: string
  last_name: string
  suffix?: string
}

export interface AppointmentInput extends PatientNameParts {
  full_name?: string
  age?: number
  birthdate: string
  gender: string
  civil_status?: string
  residential_address: string
  contact_number: string
  spouse_name?: string
  mothers_maiden_name?: string
  employment_status?: string
  primary_care_benefit_member?: boolean
  consulting_facility: string
  yakap_registered: boolean
  yakap_facility?: string
  service_type: string
  appointment_date: string
  appointment_time?: string | null
  philhealth_member?: boolean
  philhealth_number?: string
  philhealth_status?: string
  facility_household_number?: string
  pwd?: boolean
  data_privacy_consent: boolean
  notes?: string
}

export interface AppointmentSummary {
  public_id: string
  full_name: string
  appointment_date: string
  appointment_time?: string | null
  service_type: string
  service_name: string
  consulting_facility: string
  status: AppointmentStatus
  created_at?: string
}

export interface AdminAppointment extends AppointmentSummary {
  id: string
  age: number
  contact_number?: string
  residential_address?: string
  yakap_registered: boolean
}

export interface AdminAppointmentDetail extends AdminAppointment {
  first_name: string
  middle_name?: string
  last_name: string
  suffix?: string
  birthdate?: string
  gender?: string
  civil_status?: string
  spouse_name?: string
  mothers_maiden_name?: string
  employment_status?: string
  primary_care_benefit_member: boolean
  yakap_facility?: string
  philhealth_member: boolean
  philhealth_number?: string
  philhealth_status?: string
  facility_household_number?: string
  pwd: boolean
  notes?: string
  updated_at?: string
}

export interface AppointmentAvailability {
  date: string
  available: boolean
  reason?: string
  services: Array<{
    id: string
    name: string
    capacity: number
    booked: number
    remaining: number
  }>
}

export interface BookingResult {
  public_id: string
  qr_url: string
  appointment: AppointmentSummary
}

export interface PublicAppointmentStatus {
  public_id: string
  patient_display_name: string
  appointment_date: string
  appointment_time?: string | null
  service_name: string
  consulting_facility: string
  status: AppointmentStatus
}
