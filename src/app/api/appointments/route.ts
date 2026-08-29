import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Lazy initialization to avoid build-time errors
const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials are required')
  }
  
  return createClient(supabaseUrl, supabaseKey)
}

/**
 * Validate if a date is a weekend (Saturday = 6, Sunday = 0)
 */
function isWeekend(dateString: string): boolean {
  const date = new Date(dateString)
  const day = date.getDay()
  return day === 0 || day === 6
}

/**
 * Validate if a date is in the past
 */
function isPastDate(dateString: string): boolean {
  const date = new Date(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

/**
 * GET /api/appointments - Fetch all appointments (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Check for authentication header (in production, verify with Supabase auth)
    const authHeader = request.headers.get('authorization')
    
    // For now, we'll allow public access for development
    // In production, verify the user is authenticated admin
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch appointments' },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/appointments - Create a new appointment
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    if (!body.appointment_date) {
      return NextResponse.json(
        { error: 'Appointment date is required' },
        { status: 400 }
      )
    }

    // Validate weekend restriction
    if (isWeekend(body.appointment_date)) {
      return NextResponse.json(
        { error: 'Weekend appointments are not allowed. Please select a weekday (Monday-Friday).' },
        { status: 400 }
      )
    }

    // Validate past date restriction
    if (isPastDate(body.appointment_date)) {
      return NextResponse.json(
        { error: 'Cannot book appointments in the past. Please select a future date.' },
        { status: 400 }
      )
    }

    // Validate other required fields
    if (!body.full_name || !body.age || !body.consulting_facility || !body.service_type) {
      return NextResponse.json(
        { error: 'Missing required fields: full_name, age, consulting_facility, service_type' },
        { status: 400 }
      )
    }

    // Insert appointment into database
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('appointments')
      .insert({
        full_name: body.full_name,
        age: body.age,
        birthdate: body.birthdate,
        gender: body.gender,
        civil_status: body.civil_status,
        residential_address: body.residential_address,
        contact_number: body.contact_number,
        spouse_name: body.spouse_name,
        mothers_maiden_name: body.mothers_maiden_name,
        employment_status: body.employment_status,
        primary_care_benefit_member: body.primary_care_benefit_member,
        consulting_facility: body.consulting_facility,
        yakap_registered: body.yakap_registered,
        yakap_facility: body.yakap_facility,
        service_type: body.service_type,
        appointment_date: body.appointment_date,
        appointment_time: body.appointment_time,
        philhealth_member: body.philhealth_member,
        philhealth_number: body.philhealth_number,
        philhealth_status: body.philhealth_status,
        facility_household_number: body.facility_household_number,
        pwd: body.pwd,
        data_privacy_consent: body.data_privacy_consent,
        notes: body.notes
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to create appointment' },
        { status: 500 }
      )
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}