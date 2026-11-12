import { describe, expect, it } from 'vitest'
import {
  addDaysISO,
  calculateAge,
  differenceInDaysISO,
  isValidISODate,
  isWeekendISODate,
  todayInManila,
} from '@/server/utils/date'

describe('date utilities', () => {
  it('validates real ISO dates only', () => {
    expect(isValidISODate('2026-11-09')).toBe(true)
    expect(isValidISODate('2024-02-29')).toBe(true)
    expect(isValidISODate('2026-02-29')).toBe(false)
    expect(isValidISODate('2026-13-01')).toBe(false)
    expect(isValidISODate('2026-1-01')).toBe(false)
    expect(isValidISODate('')).toBe(false)
  })

  it('identifies weekends in UTC-safe ISO dates', () => {
    expect(isWeekendISODate('2026-11-09')).toBe(false)
    expect(isWeekendISODate('2026-11-14')).toBe(true)
    expect(isWeekendISODate('2026-11-15')).toBe(true)
  })

  it('adds and compares dates without timezone drift', () => {
    expect(addDaysISO('2026-11-09', 1)).toBe('2026-11-10')
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01')
    expect(differenceInDaysISO('2026-11-09', '2026-11-19')).toBe(10)
  })

  it('calculates age on the reference date', () => {
    expect(calculateAge('2000-11-09', '2026-11-09')).toBe(26)
    expect(calculateAge('2000-11-10', '2026-11-09')).toBe(25)
    expect(calculateAge('2026-11-09', '2026-11-09')).toBe(0)
  })

  it('returns the Manila date in YYYY-MM-DD format', () => {
    expect(todayInManila()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
