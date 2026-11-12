import { BACOLOD_HEALTH_FACILITIES, BACOLOD_YAKAP_FACILITIES } from '@/constants/facilities'
import { holidayName, isHoliday } from '@/constants/phHolidays'
import {
  getServiceDefinition,
  isAppointmentTimeSlot,
  isBookableService,
  type LaboratoryServiceDefinition,
} from '@/constants/services'
import {
  APPOINTMENT_STATUSES,
  type AppointmentStatus,
} from '@/types/appointment'
import { getAppConfig } from '@/server/config/env'
import { ValidationError } from '@/server/errors'
import {
  calculateAge,
  differenceInDaysISO,
  isWeekendISODate,
  isValidISODate,
  todayInManila,
} from '@/server/utils/date'

const NAME_PATTERN = /^[\p{L}\p{M} .'-]+$/u
const ADDRESS_PATTERN = /^[\p{L}\p{M}\p{N} .,'()\-\/#&]+$/u
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/
const GENDERS = ['Male', 'Female'] as const
const CIVIL_STATUSES = ['Single', 'Married', 'Widowed', 'Separated'] as const
const EMPLOYMENT_STATUSES = [
  'Employed',
  'Unemployed',
  'Self-Employed',
  'Student',
  'Retired',
] as const
const SUFFIXES = ['', 'Jr.', 'Sr.', 'II', 'III', 'IV'] as const
const PHILHEALTH_STATUSES = ['MEMBER', 'DEPENDENT'] as const
const MAX_NOTES_LENGTH = 1000
const MAX_ADDRESS_LENGTH = 255

export interface NormalizedAppointmentInput {
  firstName: string
  middleName: string | null
  lastName: string
  suffix: string | null
  fullName: string
  birthdate: string
  age: number
  gender: string
  civilStatus: string | null
  residentialAddress: string
  contactNumber: string
  spouseName: string | null
  mothersMaidenName: string | null
  employmentStatus: string | null
  primaryCareBenefitMember: boolean
  consultingFacility: string
  yakapRegistered: boolean
  yakapFacility: string | null
  service: LaboratoryServiceDefinition
  appointmentDate: string
  appointmentTime: 'AM' | 'PM' | null
  philhealthMember: boolean
  philhealthNumber: string | null
  philhealthStatus: string | null
  facilityHouseholdNumber: string | null
  pwd: boolean
  dataPrivacyConsent: true
  notes: string | null
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function rejectControlCharacters(value: string, label: string): void {
  if (CONTROL_CHARACTER_PATTERN.test(value)) {
    throw new ValidationError(`${label} contains invalid characters`)
  }
}

function readString(
  body: Record<string, unknown>,
  key: string,
  options: {
    label: string
    required?: boolean
    min?: number
    max?: number
    pattern?: RegExp
    patternMessage?: string
  }
): string {
  const raw = body[key]
  if (raw === undefined || raw === null) {
    if (options.required) throw new ValidationError(`${options.label} is required`)
    return ''
  }
  if (typeof raw !== 'string') {
    throw new ValidationError(`${options.label} must be text`)
  }
  const value = normalizeWhitespace(raw)
  if (!value) {
    if (options.required) throw new ValidationError(`${options.label} is required`)
    return ''
  }
  rejectControlCharacters(value, options.label)
  if (options.min !== undefined && value.length < options.min) {
    throw new ValidationError(`${options.label} must be at least ${options.min} characters`)
  }
  if (options.max !== undefined && value.length > options.max) {
    throw new ValidationError(`${options.label} must be at most ${options.max} characters`)
  }
  if (options.pattern && !options.pattern.test(value)) {
    throw new ValidationError(options.patternMessage ?? `${options.label} is invalid`)
  }
  return value
}

function readName(
  body: Record<string, unknown>,
  key: string,
  label: string,
  required: boolean,
  max = 100
): string {
  return readString(body, key, {
    label,
    required,
    max,
    pattern: NAME_PATTERN,
    patternMessage: `${label} contains characters that are not allowed`,
  })
}

function readOptionalEnum<T extends readonly string[]>(
  body: Record<string, unknown>,
  key: string,
  label: string,
  allowed: T
): T[number] | null {
  const value = readString(body, key, { label, max: 50 })
  if (!value) return null
  if (!(allowed as readonly string[]).includes(value)) {
    throw new ValidationError(`${label} has an invalid value`)
  }
  return value as T[number]
}

function readBoolean(
  body: Record<string, unknown>,
  key: string,
  label: string,
  fallback = false
): boolean {
  const value = body[key]
  if (value === undefined || value === null) return fallback
  if (typeof value !== 'boolean') {
    throw new ValidationError(`${label} must be true or false`)
  }
  return value
}

function readRequiredBoolean(
  body: Record<string, unknown>,
  key: string,
  label: string
): boolean {
  if (typeof body[key] !== 'boolean') {
    throw new ValidationError(`${label} must be true or false`)
  }
  return body[key] as boolean
}

export function normalizePhoneNumber(raw: string): string | null {
  let digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('+63')) digits = `0${digits.slice(3)}`
  else if (digits.startsWith('63') && digits.length === 12) digits = `0${digits.slice(2)}`
  else if (digits.startsWith('9') && digits.length === 10) digits = `0${digits}`
  if (!/^0(?:9\d{9}|[2-8]\d{7,8})$/.test(digits)) return null
  return digits
}

function normalizePhilHealthNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  return /^\d{12}$/.test(digits) ? digits : null
}

export function getAppointmentDateError(date: string): string | null {
  if (!isValidISODate(date)) {
    return 'Appointment date must be a valid date in YYYY-MM-DD format'
  }
  const today = todayInManila()
  if (date < today) {
    return 'Cannot book appointments in the past'
  }
  if (isWeekendISODate(date)) {
    return 'Weekend appointments are not allowed. Please select a weekday (Monday-Friday).'
  }
  if (isHoliday(date)) {
    return `No appointments on Philippine holiday "${holidayName(date)}".`
  }
  const daysAhead = differenceInDaysISO(today, date)
  const maxDays = getAppConfig().bookingWindowDays
  if (daysAhead > maxDays) {
    return `Appointments may only be booked up to ${maxDays} days ahead`
  }
  return null
}

function validateAppointmentDate(date: string): void {
  const error = getAppointmentDateError(date)
  if (error) throw new ValidationError(error)
}

function validateBirthdate(birthdate: string): number {
  if (!isValidISODate(birthdate)) {
    throw new ValidationError('Birthdate must be a valid date in YYYY-MM-DD format')
  }
  const today = todayInManila()
  if (birthdate > today) {
    throw new ValidationError('Birthdate cannot be in the future')
  }
  if (birthdate < '1900-01-01') {
    throw new ValidationError('Birthdate is outside the supported range')
  }
  const age = calculateAge(birthdate, today)
  if (age < 0 || age > 150) {
    throw new ValidationError('Age is outside the supported range')
  }
  return age
}

export function parseAndValidateAppointmentInput(
  body: Record<string, unknown>
): NormalizedAppointmentInput {
  const firstName = readName(body, 'first_name', 'First name', true)
  const middleName = readName(body, 'middle_name', 'Middle name', false)
  const lastName = readName(body, 'last_name', 'Last name', true)
  const suffix = readOptionalEnum(body, 'suffix', 'Suffix', SUFFIXES)

  const fullName = normalizeWhitespace(
    [firstName, middleName, lastName, suffix].filter(Boolean).join(' ')
  )
  if (fullName.length > 255) {
    throw new ValidationError('Full name is too long')
  }

  const birthdate = readString(body, 'birthdate', {
    label: 'Birthdate',
    required: true,
    max: 10,
  })
  const age = validateBirthdate(birthdate)

  const gender = readString(body, 'gender', {
    label: 'Gender',
    required: true,
    max: 20,
  })
  if (!(GENDERS as readonly string[]).includes(gender)) {
    throw new ValidationError('Gender must be Male or Female')
  }

  const civilStatus = readOptionalEnum(body, 'civil_status', 'Civil status', CIVIL_STATUSES)
  const employmentStatus = readOptionalEnum(
    body,
    'employment_status',
    'Employment status',
    EMPLOYMENT_STATUSES
  )

  const residentialAddress = readString(body, 'residential_address', {
    label: 'Residential address',
    required: true,
    min: 5,
    max: MAX_ADDRESS_LENGTH,
    pattern: ADDRESS_PATTERN,
    patternMessage: 'Residential address contains characters that are not allowed',
  })

  const contactRaw = readString(body, 'contact_number', {
    label: 'Contact number',
    required: true,
    max: 30,
  })
  const contactNumber = normalizePhoneNumber(contactRaw)
  if (!contactNumber) {
    throw new ValidationError('Contact number must be a valid Philippine mobile or landline number')
  }

  const spouseName = readName(body, 'spouse_name', 'Spouse name', false, 150)
  const mothersMaidenName = readName(
    body,
    'mothers_maiden_name',
    "Mother's maiden name",
    false,
    150
  )

  const primaryCareBenefitMember = readBoolean(
    body,
    'primary_care_benefit_member',
    'Primary care benefit membership'
  )

  const consultingFacility = readString(body, 'consulting_facility', {
    label: 'Health facility',
    required: true,
    max: 150,
  })
  if (!BACOLOD_HEALTH_FACILITIES.includes(consultingFacility)) {
    throw new ValidationError('Selected health facility is not valid')
  }

  const yakapRegistered = readBoolean(body, 'yakap_registered', 'YAKAP registration')
  let yakapFacility = readString(body, 'yakap_facility', {
    label: 'YAKAP facility',
    max: 150,
  })
  if (yakapRegistered) {
    if (!yakapFacility) {
      throw new ValidationError('YAKAP facility is required for YAKAP-registered patients')
    }
    if (!BACOLOD_YAKAP_FACILITIES.includes(yakapFacility)) {
      throw new ValidationError('Selected YAKAP facility is not valid')
    }
  } else {
    yakapFacility = ''
  }

  const serviceType = readString(body, 'service_type', {
    label: 'Service',
    required: true,
    max: 64,
  })
  const service = getServiceDefinition(serviceType)
  if (!service || !isBookableService(serviceType)) {
    throw new ValidationError('Selected service is not available for online booking')
  }

  const appointmentDate = readString(body, 'appointment_date', {
    label: 'Appointment date',
    required: true,
    max: 10,
  })
  validateAppointmentDate(appointmentDate)

  const rawTime = body.appointment_time
  let appointmentTime: 'AM' | 'PM' | null = null
  if (rawTime !== undefined && rawTime !== null && rawTime !== '') {
    if (typeof rawTime !== 'string' || !isAppointmentTimeSlot(rawTime)) {
      throw new ValidationError('Appointment time must be AM or PM')
    }
    appointmentTime = rawTime
  }
  if (service.requiresTimeSlot && !appointmentTime) {
    throw new ValidationError('Please select an AM or PM time slot for this service')
  }
  if (!service.requiresTimeSlot) {
    appointmentTime = null
  }

  const philhealthMember = readBoolean(body, 'philhealth_member', 'PhilHealth membership')
  let philhealthNumber: string | null = null
  let philhealthStatus: string | null = null
  let facilityHouseholdNumber: string | null = null

  if (philhealthMember) {
    const rawPhilHealth = readString(body, 'philhealth_number', {
      label: 'PhilHealth number',
      required: true,
      max: 30,
    })
    philhealthNumber = normalizePhilHealthNumber(rawPhilHealth)
    if (!philhealthNumber) {
      throw new ValidationError('PhilHealth number must contain 12 digits')
    }
    philhealthStatus = readOptionalEnum(
      body,
      'philhealth_status',
      'PhilHealth status',
      PHILHEALTH_STATUSES
    )
    if (!philhealthStatus) {
      throw new ValidationError('PhilHealth status is required for PhilHealth members')
    }
    const household = readString(body, 'facility_household_number', {
      label: 'Facility household number',
      max: 50,
      pattern: /^[A-Za-z0-9-]+$/,
      patternMessage: 'Facility household number may only contain letters, numbers, and dashes',
    })
    facilityHouseholdNumber = household || null
  }

  const pwd = readBoolean(body, 'pwd', 'PWD status')
  const dataPrivacyConsent = readRequiredBoolean(
    body,
    'data_privacy_consent',
    'Data privacy consent'
  )
  if (!dataPrivacyConsent) {
    throw new ValidationError('Data privacy consent is required to submit an appointment')
  }

  const notes = readString(body, 'notes', {
    label: 'Notes',
    max: MAX_NOTES_LENGTH,
  })

  return {
    firstName,
    middleName: middleName || null,
    lastName,
    suffix: suffix || null,
    fullName,
    birthdate,
    age,
    gender,
    civilStatus,
    residentialAddress,
    contactNumber,
    spouseName: spouseName || null,
    mothersMaidenName: mothersMaidenName || null,
    employmentStatus,
    primaryCareBenefitMember,
    consultingFacility,
    yakapRegistered,
    yakapFacility: yakapFacility || null,
    service,
    appointmentDate,
    appointmentTime,
    philhealthMember,
    philhealthNumber,
    philhealthStatus,
    facilityHouseholdNumber,
    pwd,
    dataPrivacyConsent: true,
    notes: notes || null,
  }
}

export function parseAppointmentStatus(body: Record<string, unknown>): AppointmentStatus {
  if (typeof body.status !== 'string' || !(APPOINTMENT_STATUSES as readonly string[]).includes(body.status)) {
    throw new ValidationError('Status must be one of: scheduled, confirmed, completed, cancelled, no_show')
  }
  return body.status as AppointmentStatus
}

export function parseAdminSearch(value: string | null): string | null {
  if (!value) return null
  const trimmed = normalizeWhitespace(value)
  if (!trimmed) return null
  if (trimmed.length > 100) {
    throw new ValidationError('Search query is too long')
  }
  if (CONTROL_CHARACTER_PATTERN.test(trimmed)) {
    throw new ValidationError('Search query contains invalid characters')
  }
  return trimmed
}

export function parseFacilityFilter(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!BACOLOD_HEALTH_FACILITIES.includes(trimmed)) {
    throw new ValidationError('Facility filter is not valid')
  }
  return trimmed
}

export function parseStatusFilter(value: string | null): AppointmentStatus | null {
  if (!value) return null
  if (!(APPOINTMENT_STATUSES as readonly string[]).includes(value)) {
    throw new ValidationError('Status filter is not valid')
  }
  return value as AppointmentStatus
}

export function parseDateFilter(value: string | null): string | null {
  if (!value) return null
  if (!isValidISODate(value)) {
    throw new ValidationError('Date filter must be a valid date in YYYY-MM-DD format')
  }
  return value
}

export function parseLimit(value: string | null, fallback = 500): number {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
    throw new ValidationError('Limit must be an integer between 1 and 1000')
  }
  return parsed
}
