import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  Appointment,
  AppointmentInput,
  AppointmentRepository,
} from './types'

// Server-only Supabase implementation of the appointment repository.
// Lazy client creation avoids build-time failures when env is missing.

function getSupabaseClient(): SupabaseClient {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder-key'

  return createClient(supabaseUrl, supabaseKey)
}

export class SupabaseAppointmentRepository implements AppointmentRepository {
  async createAppointment(appointment: AppointmentInput): Promise<Appointment> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('appointments')
      .insert(appointment)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create appointment: ${error.message}`)
    }
    return data as Appointment
  }

  async getAllAppointments(): Promise<Appointment[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch appointments: ${error.message}`)
    }
    return (data ?? []) as Appointment[]
  }

  async getAppointmentById(id: string): Promise<Appointment | null> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Failed to fetch appointment: ${error.message}`)
    }
    return data as Appointment
  }

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
    return (data ?? []) as Appointment[]
  }

  async getAppointmentsByFacility(facility: string): Promise<Appointment[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('consulting_facility', facility)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(
        `Failed to fetch appointments by facility: ${error.message}`
      )
    }
    return (data ?? []) as Appointment[]
  }

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
    return (data ?? []) as Appointment[]
  }

  async updateAppointment(
    id: string,
    updates: Partial<AppointmentInput>
  ): Promise<Appointment> {
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
    return data as Appointment
  }

  async deleteAppointment(id: string): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('appointments').delete().eq('id', id)

    if (error) {
      throw new Error(`Failed to delete appointment: ${error.message}`)
    }
  }

  async getAppointmentsCount(
    date: string,
    serviceType: string
  ): Promise<number> {
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
