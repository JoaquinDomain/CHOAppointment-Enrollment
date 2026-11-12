const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const MANILA_TIME_ZONE = 'Asia/Manila'

export function isValidISODate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = ISO_DATE_PATTERN.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function parseISODateUTC(value: string): Date {
  if (!isValidISODate(value)) throw new Error('Invalid ISO date')
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function formatISODateUTC(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function todayInManila(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(new Date())
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function isWeekendISODate(value: string): boolean {
  const day = parseISODateUTC(value).getUTCDay()
  return day === 0 || day === 6
}

export function addDaysISO(value: string, days: number): string {
  const date = parseISODateUTC(value)
  date.setUTCDate(date.getUTCDate() + days)
  return formatISODateUTC(date)
}

export function differenceInDaysISO(from: string, to: string): number {
  const fromTime = parseISODateUTC(from).getTime()
  const toTime = parseISODateUTC(to).getTime()
  return Math.floor((toTime - fromTime) / 86_400_000)
}

export function calculateAge(birthdate: string, referenceDate: string): number {
  const birth = parseISODateUTC(birthdate)
  const reference = parseISODateUTC(referenceDate)
  let age = reference.getUTCFullYear() - birth.getUTCFullYear()
  const monthDifference = reference.getUTCMonth() - birth.getUTCMonth()
  if (
    monthDifference < 0 ||
    (monthDifference === 0 && reference.getUTCDate() < birth.getUTCDate())
  ) {
    age -= 1
  }
  return age
}
