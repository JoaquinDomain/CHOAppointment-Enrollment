// Booking business rules (weekday-only, no holidays, no past dates).

import { isHoliday, holidayName } from '@/constants/phHolidays'
import type { AppointmentInput } from '@/types/appointment'

export function isWeekend(dateString: string): boolean {
  const d = new Date(dateString + 'T00:00:00')
  return d.getDay() === 0 || d.getDay() === 6
}

export function isPastDate(dateString: string): boolean {
  const date = new Date(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

/** Returns an error message when the payload is invalid, otherwise null. */
export function validateAppointmentInput(body: Partial<AppointmentInput>): string | null {
  if (!body.appointment_date) return 'Appointment date is required'
  if (isWeekend(body.appointment_date))
    return 'Weekend appointments are not allowed. Please select a weekday (Monday-Friday).'
  if (isHoliday(body.appointment_date))
    return `No appointments on Philippine holiday "${holidayName(body.appointment_date)}".`
  if (isPastDate(body.appointment_date))
    return 'Cannot book appointments in the past. Please select a future date.'
  if (!body.full_name || !body.age || !body.consulting_facility || !body.service_type)
    return 'Missing required fields: full_name, age, consulting_facility, service_type'
  return null
}
