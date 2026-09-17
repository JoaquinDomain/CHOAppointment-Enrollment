// Shared appointment DTO — client-safe (no server imports).
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
