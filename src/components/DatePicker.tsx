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
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-emerald-600" />
        <h2 className="text-xl font-semibold text-slate-800">Appointment Date</h2>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="appointment-date" className="block text-sm font-medium text-slate-700 mb-2">
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
              w-full px-4 py-3 rounded border transition-colors
              ${error 
                ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-200'
              }
              focus:outline-none focus:ring-2
              text-slate-800
            `}
            style={{ color: '#1e293b' }}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Selected Date Display */}
        {selectedDate && !error && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded">
            <p className="text-sm text-emerald-600 font-medium">Selected Date:</p>
            <p className="text-lg font-semibold text-emerald-900">{formatDateDisplay(selectedDate)}</p>
          </div>
        )}

        {/* Info Notice */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> Appointments are available Monday to Friday only. 
            Weekend dates are disabled.
          </p>
        </div>
      </div>
    </div>
  )
}