import { createClient } from '@supabase/supabase-js'

// Lazy initialization to avoid build-time errors
const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder-key'
  
  return createClient(supabaseUrl, supabaseKey)
}

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

/**
 * Service for managing appointment data access
 */
export class AppointmentService {
  /**
   * Create a new appointment
   */
  async createAppointment(appointment: Appointment): Promise<Appointment> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('appointments')
      .insert(appointment)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create appointment: ${error.message}`)
    }

    return data
  }

  /**
   * Get all appointments (admin only)
   */
  async getAllAppointments(): Promise<Appointment[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch appointments: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get appointment by ID
   */
  async getAppointmentById(id: string): Promise<Appointment | null> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      throw new Error(`Failed to fetch appointment: ${error.message}`)
    }

    return data
  }

  /**
   * Get appointments by date
   */
  async getAppointmentsByDate(date: string): Promise<Appointment[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('appointment_date', date)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch appointments by date: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get appointments by facility
   */
  async getAppointmentsByFacility(facility: string): Promise<Appointment[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('consulting_facility', facility)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch appointments by facility: ${error.message}`)
    }

    return data || []
  }

  /**
   * Search appointments by patient name
   */
  async searchAppointmentsByName(name: string): Promise<Appointment[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .ilike('full_name', `%${name}%`)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to search appointments: ${error.message}`)
    }

    return data || []
  }

  /**
   * Update appointment
   */
  async updateAppointment(id: string, updates: Partial<Appointment>): Promise<Appointment> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update appointment: ${error.message}`)
    }

    return data
  }

  /**
   * Delete appointment
   */
  async deleteAppointment(id: string): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to delete appointment: ${error.message}`)
    }
  }

  /**
   * Get count of appointments for a specific date and service
   */
  async getAppointmentsCount(date: string, serviceType: string): Promise<number> {
    const supabase = getSupabaseClient()
    const { count, error } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('appointment_date', date)
      .eq('service_type', serviceType)

    if (error) {
      throw new Error(`Failed to count appointments: ${error.message}`)
    }

    return count || 0
  }
}

// Singleton instance
export const appointmentService = new AppointmentService()