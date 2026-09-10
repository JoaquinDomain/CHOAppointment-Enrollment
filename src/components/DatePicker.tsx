'use client'

import { useState } from 'react'
import { Calendar, AlertCircle } from 'lucide-react'

interface DatePickerProps {
  selectedDate: string | null
  onDateSelect: (date: string) => void
  minDate?: Date
  maxDate?: Date
}

export default function DatePicker({ 
  selectedDate, 
  onDateSelect,
  minDate = new Date(),
  maxDate 
}: DatePickerProps) {
  const [error, setError] = useState<string | null>(null)

  // Validate if a date is a weekend
  const isWeekend = (date: Date): boolean => {
    const day = date.getDay()
    return day === 0 || day === 6 // Sunday (0) or Saturday (6)
  }

  // Check if date is in the past
  const isPastDate = (date: Date): boolean => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  }

  // Format date for display
  const formatDateDisplay = (dateString: string): string => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Get minimum date string for input
  const getMinDateString = (): string => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today.toISOString().split('T')[0]
  }

  // Get maximum date string for input (optional)
  const getMaxDateString = (): string => {
    if (!maxDate) return ''
    return maxDate.toISOString().split('T')[0]
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value)
    
    // Reset error
    setError(null)

    // Check if it's a weekend
    if (isWeekend(newDate)) {
      setError('Weekend appointments are not available. Please select a weekday.')
      return
    }

    // Check if it's in the past
    if (isPastDate(newDate)) {
      setError('Please select a future date.')
      return
    }

    // Check if it's beyond max date
    if (maxDate && newDate > maxDate) {
      setError('Please select a date within the allowed range.')
      return
    }

    onDateSelect(e.target.value)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="cho-section-icon">
          <Calendar className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Appointment date</h2>
          <p className="text-xs font-medium text-slate-500">Weekdays only · from 8:00 AM.</p>
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
          </div>
        )}

        {/* Info Notice */}
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-3.5">
          <p className="text-xs leading-relaxed text-amber-900 sm:text-sm">
            <strong className="font-semibold text-amber-950">Note:</strong> Laboratory appointments are available Monday through Friday only (8:00 AM onwards).
          </p>
        </div>
      </div>
    </div>
  )
}