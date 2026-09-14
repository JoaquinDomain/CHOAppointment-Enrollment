'use client'

import { useState } from 'react'
import { Calendar, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { isHoliday, holidayName, isWeekend } from '@/constants/phHolidays'

interface DatePickerProps {
  selectedDate: string | null
  onDateSelect: (date: string) => void
  minDate?: Date
  maxDate?: Date
}

const MAX_DATE = new Date('2027-12-31')

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

function parseISO(s: string): Date {
  return new Date(s + 'T00:00:00')
}

export default function DatePicker({
  selectedDate,
  onDateSelect,
  minDate = new Date(),
  maxDate = MAX_DATE,
}: DatePickerProps) {
  const [error, setError] = useState<string | null>(null)
  const [viewMonth, setViewMonth] = useState(() => {
    if (selectedDate) {
      const d = parseISO(selectedDate)
      return new Date(d.getFullYear(), d.getMonth(), 1)
    }
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return new Date(t.getFullYear(), t.getMonth(), 1)
  })

  const minISO = (() => { const d = new Date(minDate); d.setHours(0,0,0,0); return toISO(d) })()
  const maxISO = toISO(maxDate)
  const todayISO = toISO(new Date())

  const isPastISO = (iso: string) => iso < minISO
  const isBeyondMax = (iso: string) => iso > maxISO
  const isUnavailableISO = (iso: string) => {
    if (isHoliday(iso)) return true
    return isWeekend(parseISO(iso))
  }
  const isDisabledISO = (iso: string) => isPastISO(iso) || isBeyondMax(iso) || isUnavailableISO(iso)

  const formatDisplay = (s: string) =>
    parseISO(s).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const getMinMax = () => ({ min: minISO, max: maxISO })

  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setError(null)
    if (!v) return
    if (isHoliday(v)) {
      setError(`Philippine holiday "${holidayName(v)}" — no appointments on this date.`)
      return
    }
    if (isWeekend(parseISO(v))) {
      setError('Saturdays and Sundays are not available for appointments.')
      return
    }
    const past = parseISO(v) < parseISO(minISO)
    if (past) { setError('Please select a future date.'); return }
    if (v > maxISO) { setError('Please select a date within the allowed range.'); return }
    onDateSelect(v)
  }

  const handleGridPick = (iso: string) => {
    setError(null)
    if (isDisabledISO(iso)) {
      if (isHoliday(iso)) setError(`Philippine holiday "${holidayName(iso)}" — no appointments on this date.`)
      else if (isWeekend(parseISO(iso))) setError('Saturdays and Sundays are not available for appointments.')
      else if (iso < minISO) setError('Please select a future date.')
      else setError('Date not available.')
      return
    }
    onDateSelect(iso)
  }

  // Build calendar grid for viewMonth
  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const firstDow = new Date(year, month, 1).getDay() // 0 Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const canPrev = toISO(new Date(year, month - 1, 1)) >= minISO.slice(0, 7) + '-01' ? true : new Date(year, month - 1, 1) >= new Date(parseISO(minISO).getFullYear(), parseISO(minISO).getMonth(), 1)
  const canNext = toISO(new Date(year, month + 1, 1)) <= maxISO

  const weekLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="cho-section-icon"><Calendar className="h-4 w-4" /></span>
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Appointment date</h2>
          <p className="text-xs font-medium text-slate-500">Weekdays only · 8:00 AM onwards · PH holidays excluded.</p>
        </div>
      </div>

      <div className="space-y-3">
        {/* Native date input — keeps keyboard entry + mobile picker */}
        <div>
          <label htmlFor="appointment-date" className="cho-label">Choose your preferred date</label>
          <input
            id="appointment-date"
            type="date"
            value={selectedDate || ''}
            onChange={handleNativeChange}
            min={minISO}
            max={maxISO}
            className={`cho-input text-base font-semibold ${error ? '!border-red-300 !shadow-[0_0_0_4px_rgba(239,68,68,0.12)]' : ''}`}
            style={{ color: '#0f172a' }}
          />
        </div>

        {/* Visual mini calendar — weekends + holidays are visibly disabled */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setViewMonth(new Date(year, month - 1, 1))} disabled={!canPrev} aria-label="Previous month" className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-30">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold tracking-tight text-slate-900">{monthLabel}</span>
            <button type="button" onClick={() => setViewMonth(new Date(year, month + 1, 1))} disabled={!canNext} aria-label="Next month" className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-30">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekLabels.map(w => <span key={w} className="py-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">{w}</span>)}
            {Array.from({ length: firstDow }).map((_, i) => <span key={`pad-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const isSelected = selectedDate === iso
              const isToday = iso === todayISO
              const disabled = isDisabledISO(iso)
              const holiday = isHoliday(iso)
              const weekend = isWeekend(parseISO(iso))
              const title = holiday ? holidayName(iso) : weekend ? 'Weekend — no appointments' : ''
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => handleGridPick(iso)}
                  disabled={disabled}
                  title={title}
                  aria-label={`${iso}${holiday ? ` ${holidayName(iso)}` : ''}${disabled ? ' unavailable' : ''}`}
                  className={[
                    'relative flex h-9 w-full items-center justify-center rounded-xl text-sm font-semibold transition',
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-md'
                      : disabled
                        ? holiday
                          ? 'bg-amber-100 text-amber-700 line-through decoration-amber-700/60 cursor-not-allowed'
                          : weekend
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                        : 'bg-white text-slate-800 hover:bg-emerald-50 hover:text-emerald-900 border border-slate-200',
                    isToday && !isSelected ? 'ring-2 ring-emerald-500 ring-offset-1' : '',
                  ].join(' ')}
                >
                  {day}
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-100 pt-3 text-[11px] font-medium text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-md bg-slate-100 border border-slate-200" /> Weekend</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-md bg-amber-100 border border-amber-200" /> PH holiday</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-md bg-emerald-600" /> Selected</span>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 shadow-sm">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}

        {selectedDate && !error && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm">
            <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">Selected date</p>
            <p className="text-lg font-bold tracking-tight text-emerald-950">{formatDisplay(selectedDate)}</p>
          </div>
        )}

        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-3.5">
          <p className="text-xs leading-relaxed text-amber-900 sm:text-sm">
            <strong className="font-semibold text-amber-950">Note:</strong> Laboratory appointments are available Monday–Friday only (8:00 AM onwards). Philippine national holidays are excluded. Weekends and holidays appear greyed out in the calendar.
          </p>
        </div>
      </div>
    </div>
  )
}
