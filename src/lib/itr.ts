import type { EnrollmentData } from '@/components/EnrollmentModal'
import type { AdminAppointmentDetail } from '@/types/appointment'

export function buildITREnrollmentData(
  detail: AdminAppointmentDetail
): EnrollmentData {
  return {
    lastName: detail.last_name,
    firstName: detail.first_name,
    middleName: detail.middle_name ?? '',
    suffix: detail.suffix ?? '',
    birthdate: detail.birthdate ?? '',
    age: detail.age,
    gender: detail.gender ?? '',
    civilStatus: detail.civil_status ?? '',
    residentialAddress: detail.residential_address ?? '',
    contactNumber: detail.contact_number ?? '',
    spouseName: detail.spouse_name ?? '',
    mothersMaidenName: detail.mothers_maiden_name ?? '',
    employmentStatus: detail.employment_status ?? '',
    primaryCareBenefitMember: detail.primary_care_benefit_member,
    philhealthMember: detail.philhealth_member,
    philhealthNumber: detail.philhealth_number ?? '',
    philhealthStatus: detail.philhealth_status ?? '',
    facilityHouseholdNumber: detail.facility_household_number ?? '',
    pwd: detail.pwd,
    yakapRegistered: detail.yakap_registered,
    yakapFacility: detail.yakap_facility ?? '',
    consultingFacility: detail.consulting_facility,
    selectedService: detail.service_type,
    dataPrivacyConsent: true,
  }
}
