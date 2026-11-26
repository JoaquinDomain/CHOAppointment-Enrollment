/**
 * Client-side enrollment validation for the patient form.
 *
 * This exists only to show field-level messages and move focus to the first
 * problem. The server validates the submitted appointment independently and
 * remains authoritative. The contact and PhilHealth rules below intentionally
 * mirror `src/server/appointments/appointment.validation.ts` so the client does
 * not accept something the server will reject.
 */

export interface EnrollmentValidationValues {
  lastName: string
  firstName: string
  birthdate: string
  gender: string
  residentialAddress: string
  contactNumber: string
  consultingFacility: string
  philhealthMember: boolean
  philhealthNumber: string
  philhealthStatus: string
  yakapRegistered: boolean
  yakapFacility: string
  dataPrivacyConsent: boolean
}

export interface EnrollmentFieldError {
  field: string
  message: string
}

const PHONE_PATTERN = /^0(?:9\d{9}|[2-8]\d{7,8})$/

/** Keep in sync with the server normalizer. */
export function normalizeContactNumber(raw: string): string | null {
  let digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('+63')) digits = `0${digits.slice(3)}`
  else if (digits.startsWith('63') && digits.length === 12) digits = `0${digits.slice(2)}`
  else if (digits.startsWith('9') && digits.length === 10) digits = `0${digits}`

  return PHONE_PATTERN.test(digits) ? digits : null
}

/** Keep in sync with the server normalizer. */
export function normalizePhilHealthNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  return /^\d{12}$/.test(digits) ? digits : null
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return false
  return parsed.toISOString().slice(0, 10) === value
}

/**
 * Returns errors in visual order so the first entry is the control the patient
 * should correct first.
 */
export function validateEnrollment(
  values: EnrollmentValidationValues
): EnrollmentFieldError[] {
  const errors: EnrollmentFieldError[] = []

  const requireText = (field: string, value: string, label: string) => {
    if (!value.trim()) errors.push({ field, message: `${label} is required.` })
  }

  requireText('lastName', values.lastName, 'Last name')
  requireText('firstName', values.firstName, 'First name')

  if (!values.birthdate.trim()) {
    errors.push({ field: 'birthdate', message: 'Birthdate is required.' })
  } else if (!isValidIsoDate(values.birthdate)) {
    errors.push({ field: 'birthdate', message: 'Please enter a valid birthdate.' })
  }

  if (!values.gender) {
    errors.push({ field: 'gender', message: 'Please select a gender.' })
  }

  if (!values.residentialAddress.trim()) {
    errors.push({ field: 'residentialAddress', message: 'Residential address is required.' })
  } else if (values.residentialAddress.trim().length < 5) {
    errors.push({
      field: 'residentialAddress',
      message: 'Residential address must be at least 5 characters.',
    })
  }

  if (!values.contactNumber.trim()) {
    errors.push({ field: 'contactNumber', message: 'Contact number is required.' })
  } else if (!normalizeContactNumber(values.contactNumber)) {
    errors.push({
      field: 'contactNumber',
      message: 'Please enter a valid Philippine mobile or landline number.',
    })
  }

  if (values.philhealthMember) {
    if (!values.philhealthNumber.trim()) {
      errors.push({ field: 'philhealthNumber', message: 'PhilHealth number is required.' })
    } else if (!normalizePhilHealthNumber(values.philhealthNumber)) {
      errors.push({
        field: 'philhealthNumber',
        message: 'PhilHealth number must contain 12 digits.',
      })
    }

    if (!values.philhealthStatus) {
      errors.push({
        field: 'philhealthStatus',
        message: 'Please select a PhilHealth category.',
      })
    }
  }

  if (values.yakapRegistered && !values.yakapFacility) {
    errors.push({ field: 'yakapFacility', message: 'Please select a YAKAP facility.' })
  }

  if (!values.consultingFacility) {
    errors.push({ field: 'consultingFacility', message: 'Please select a health facility.' })
  }

  if (!values.dataPrivacyConsent) {
    errors.push({
      field: 'dataPrivacyConsent',
      message: 'Please accept the required consent.',
    })
  }

  return errors
}
