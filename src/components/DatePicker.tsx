'use client'

import { useState, useMemo } from 'react'
import { Calendar, AlertCircle } from 'lucide-react'

interface DatePickerProps {
  selectedDate: string | null
  onDateSelect: (date: string) => void
  minDate?: Date
  maxDate?: Date
}

/** Philippine national holidays from Proclamation 1006 (2026) and Proclamation 1427 (2027). */
const PH_HOLIDAYS: Record<string, boolean> = {
  // 2026
  '2026-01-01': true, '2026-02-17': true, '2026-04-02': true,
  '2026-04-03': true, '2026-04-04': true, '2026-04-09': true,
  '2026-05-01': true, '2026-06-12': true, '2026-08-21': true,
  '2026-08-31': true, '2026-11-02': true, '2026-11-30': true,
  '2026-12-08': true, '2026-12-24': true, '2026-12-25': true,
  '2026-12-30': true, '2026-12-31': true,
  // 2027
  '2027-01-01': true, '2027-02-06': true, '2027-03-25': true,
  '2027-03-26': true, '2027-03-27': true, '2027-04-09': true,
  '2027-05-01': true, '2027-06-12': true, '2027-08-21': true,
  '2027-08-30': true, '2027-11-01': true, '2027-11-02': true,
  '2027-11-30': true, '2027-12-08': true, '2027-12-24': true,
  '2027-12-25': true, '2027-12-30': true,
}

const HOLIDAY_NAMES: Record<string, string> = {
  '2026-01-01': "New Year's Day",
  '2026-02-17': 'Chinese New Year',
  '2026-04-02': 'Maundy Thursday',
  '2026-04-03': 'Good Friday',
  '2026-04-04': 'Black Saturday',
  '2026-04-09': 'Araw ng Kagitingan',
  '2026-05-01': 'Labor Day',
  '2026-06-12': 'Independence Day',
  '2026-08-21': "Ninoy Aquino Day",
  '2026-08-31': 'National Heroes Day',
  '2026-11-02': "All Souls' Day",
  '2026-11-30': 'Bonifacio Day',
  '2026-12-08': 'Immaculate Conception',
  '2026-12-24': 'Christmas Eve',
  '2026-12-25': 'Christmas Day',
  '2026-12-30': 'Rizal Day',
  '2026-12-31': "Last Day of the Year",
  '2027-01-01': "New Year's Day",
  '2027-02-06': 'Chinese New Year',
  '2027-03-25': 'Maundy Thursday',
  '2027-03-26': 'Good Friday',
  '2027-03-27': 'Black Saturday',
  '2027-04-09': 'Araw ng Kagitingan',
  '2027-05-01': 'Labor Day',
  '2027-06-12': 'Independence Day',
  '2027-08-21': "Ninoy Aquino Day",
  '2027-08-30': 'National Heroes Day',
  '2027-11-01': "All Saints' Day",
  '2027-11-02': "All Souls' Day",
  '2027-11-30': 'Bonifacio Day',
  '2027-12-08': 'Immaculate Conception',
  '2027-12-24': 'Christmas Eve',
  '2027-12-25': 'Christmas Day',
  '2027-12-30': 'Rizal Day',
}

const MAX_DATE = new Date('2027-12-31')

export default function DatePicker({
  selectedDate,
  onDateSelect,
  minDate = new Date(),
  maxDate = MAX_DATE,
}: DatePickerProps) {
  const [error, setError] = useState<string | null>(null)

  const isWeekend = (date: Date): boolean => {
    const day = date.getDay()
    return day === 0 || day === 6
  }

  const isHoliday = (dateString: string): boolean => {
    return dateString in PH_HOLIDAYS
  }

  const isUnavailable = (dateString: string): boolean => {
    if (isHoliday(dateString)) return true
    const d = new Date(dateString + 'T00:00:00')
    return isWeekend(d)
  }

  const isPastDate = (date: Date): boolean => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  }

  const formatDateDisplay = (dateString: string): string => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  }

  const formatHolidayName = (dateString: string): string => {
    return HOLIDAY_NAMES[dateString] || ''
  }

  const getMinDateString = (): string => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today.toISOString().split('T')[0]
  }

  const getMaxDateString = (): string => {
    if (!maxDate) return ''
    return maxDate.toISOString().split('T')[0]
  }

  // Build disabled-days hint text for the native <input>
  const disabledHint = useMemo(() => {
    const parts: string[] = []
    for (const [d] of Object.entries(PH_HOLIDAYS)) {
      const dt = new Date(d + 'T00:00:00')
      const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
      parts.push(`${d} (${days[dt.getDay()]})`)
    }
    return parts.join(', ')
  }, [])

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value
    setError(null)

    if (isWeekend(new Date(newDate + 'T00:00:00'))) {
      setError("Saturdays and Sundays are not available for appointments.")
      return
    }
    if (isHoliday(newDate)) {
      setError(`Philippine holiday "${formatHolidayName(newDate)}" — no appointments on this date.`)
      return
    }
    if (isPastDate(new Date(newDate + 'T00:00:00'))) {
      setError('Please select a future date.')
      return
    }
    if (maxDate && new Date(newDate) > maxDate) {
      setError('Please select a date within the allowed range.')
      return
    }
    onDateSelect(newDate)
  }

  // Pre-compute which dates in the range are unavailable for the <select>
  const getDayDisableMap = (): Record<string, boolean> => {
    const map: Record<string, boolean> = {}
    const start = new Date(getMinDateString() + 'T00:00:00')
    const end = new Date(getMaxDateString() + 'T00:00:00')
    const cur = new Date(start)
    while (cur <= end) {
      const key = cur.toISOString().split('T')[0]
      map[key] = isWeekend(cur) || isHoliday(key)
      cur.setDate(cur.getDate() + 1)
    }
    return map
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="cho-section-icon">
          <Calendar className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Appointment date</h2>
          <p className="text-xs font-medium text-slate-500">Weekdays only · from 8:00 AM · PH holidays excluded.</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="appointment-date" className="cho-label">
            Choose your preferred date
          </label>
          <input
            id="appointment-date"
            type="date"
            value={selectedDate || ''}
            onChange={handleDateChange}
            min={getMinDateString()}
            max={getMaxDateString()}
            className={`
              cho-input text-base font-semibold
              ${error ? '!border-red-300 !shadow-[0_0_0_4px_rgba(239,68,68,0.12)]' : ''}
            `}
            style={{ color: '#0f172a' }}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 shadow-sm">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}

        {/* Selected Date Display */}
        {selectedDate && !error && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm">
            <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">Selected date</p>
            <p className="text-lg font-bold tracking-tight text-emerald-950">{formatDateDisplay(selectedDate)}</p>
            {isHoliday(selectedDate) && (
              <p className="mt-1 text-xs font-medium text-amber-800">⚠ This is a Philippine holiday.</p>
            )}
          </div>
        )}

        {/* Info Notice */}
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-3.5">
          <p className="text-xs leading-relaxed text-amber-900 sm:text-sm">
            <strong className="font-semibold text-amber-950">Note:</strong> Laboratory appointments are available Monday through Friday only (8:00 AM onwards). Philippine national holidays are also excluded.
          </p>
        </div>
      </div>
    </div>
  )
}