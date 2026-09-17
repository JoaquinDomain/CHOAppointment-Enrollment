import { NextRequest, NextResponse } from 'next/server'
import {
  ValidationError,
  getAppointmentService,
} from '@/server/appointments'

/**
 * GET /api/appointments - Fetch all appointments (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Check for authentication header (in production, verify with Supabase auth)
    void request.headers.get('authorization')

    // For now, allow public access for development.
    // In production, verify the user is an authenticated admin.
    const data = await getAppointmentService().listAll()

    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to fetch appointments:', error)
    return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 })
  }
}

/**
 * POST /api/appointments - Create a new appointment
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validation + insert run in the service against the configured DB (Supabase or Oracle)
    const data = await getAppointmentService().create({
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
      notes: body.notes,
    })

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('API error:', error)
    return NextResponse.json({ error: 'Failed to create appointment' }, { status: 500 })
  }
}
