import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildITREnrollmentData } from '@/lib/itr'
import type { AdminAppointmentDetail } from '@/types/appointment'

const DETAIL: AdminAppointmentDetail = {
  id: '42',
  public_id: '5a9f7c2e-6b6a-4c5d-9f24-3d2b1a0c9e88',
  full_name: 'Maria Cruz Santos Jr.',
  first_name: 'Maria',
  middle_name: 'Cruz',
  last_name: 'Santos',
  suffix: 'Jr.',
  appointment_date: '2026-11-12',
  appointment_time: 'AM',
  service_type: 'consultation',
  service_name: 'Medical Consultation',
  consulting_facility: 'Main Health Center',
  status: 'scheduled',
  age: 36,
  birthdate: '1990-01-15',
  gender: 'Female',
  civil_status: 'Married',
  residential_address: 'Bacolod City',
  contact_number: '09171234567',
  spouse_name: 'Juan Santos',
  mothers_maiden_name: 'Ana Cruz',
  employment_status: 'Employed',
  primary_care_benefit_member: true,
  yakap_registered: true,
  yakap_facility: 'Main Health Center',
  philhealth_member: true,
  philhealth_number: '1234567890',
  philhealth_status: 'Member',
  facility_household_number: 'HH-001',
  pwd: false,
}

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

describe('administrator ITR print data', () => {
  it('maps the protected appointment detail to the existing ITR fields', () => {
    const data = buildITREnrollmentData(DETAIL)

    expect(data).toMatchObject({
      firstName: 'Maria',
      middleName: 'Cruz',
      lastName: 'Santos',
      suffix: 'Jr.',
      birthdate: '1990-01-15',
      age: 36,
      gender: 'Female',
      civilStatus: 'Married',
      residentialAddress: 'Bacolod City',
      contactNumber: '09171234567',
      spouseName: 'Juan Santos',
      mothersMaidenName: 'Ana Cruz',
      employmentStatus: 'Employed',
      primaryCareBenefitMember: true,
      philhealthMember: true,
      philhealthNumber: '1234567890',
      philhealthStatus: 'Member',
      facilityHouseholdNumber: 'HH-001',
      pwd: false,
      yakapRegistered: true,
      yakapFacility: 'Main Health Center',
      consultingFacility: 'Main Health Center',
      selectedService: 'consultation',
      dataPrivacyConsent: true,
    })
  })
})

describe('administrator-only ITR print access', () => {
  it('checks the administrator session on the print page before loading a record', () => {
    const source = readSource('src/app/admin/appointments/[id]/print/page.tsx')

    expect(source).toContain('getAdminSession')
    expect(source).toContain("redirect('/admin/login')")
    expect(source).toContain('buildITREnrollmentData')
    expect(source.indexOf('await getAdminSession()')).toBeLessThan(
      source.indexOf('await getAppointmentService()')
    )
  })

  it('exposes the print page only from the administrator dashboard', () => {
    const source = readSource('src/components/AdminDashboard.tsx')

    expect(source).toContain('admin/appointments/${selectedAppointment.id}/print')
    expect(source).toContain('Print ITR')
  })

  it('keeps the patient enrollment flow from printing the ITR layout', () => {
    const modal = readSource('src/components/EnrollmentModal.tsx')
    const patientForm = readSource('src/components/AppointmentForm.tsx')

    expect(modal).toContain('printOnly = false')
    expect(modal).toContain('print:hidden')
    expect(modal).toContain('printOnly && (')
    expect(patientForm).not.toContain('printOnly')
  })
})
