'use client'

import {
  Activity,
  Baby,
  Calendar,
  Check,
  FileText,
  Heart,
  MoreHorizontal,
  Stethoscope,
  Syringe,
} from 'lucide-react'
import { LABORATORY_SERVICES } from '@/constants/services'

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  'animal-bite': <Activity className="w-6 h-6" />,
  consultation: <Stethoscope className="w-6 h-6" />,
  'surgical-minor': <MoreHorizontal className="w-6 h-6" />,
  immunization: <Syringe className="w-6 h-6" />,
  prenatal: <Baby className="w-6 h-6" />,
  'health-certificate': <FileText className="w-6 h-6" />,
  'tb-consultation': <Stethoscope className="w-6 h-6" />,
  dental: <MoreHorizontal className="w-6 h-6" />,
  'family-planning': <Heart className="w-6 h-6" />,
  'social-hygiene': <Activity className="w-6 h-6" />,
  'drug-testing': <FileText className="w-6 h-6" />,
  'medical-certificate': <FileText className="w-6 h-6" />,
}

interface ServiceOption {
  id: string
  name: string
  icon: React.ReactNode
  dailySlots: number
  requiresTimeSlot?: boolean
  description?: string
  externalLink?: string
}

const serviceOptions: ServiceOption[] = LABORATORY_SERVICES.map(service => ({
  id: service.id,
  name: service.name,
  icon: SERVICE_ICONS[service.id] ?? <MoreHorizontal className="w-6 h-6" />,
  dailySlots: service.dailySlots,
  requiresTimeSlot: service.requiresTimeSlot,
  description: service.description,
  externalLink: service.externalUrl,
}))

type AppointmentTimeSlot = 'AM' | 'PM'

interface ServiceSelectorProps {
  selectedService: string | null
  onServiceSelect: (serviceId: string) => void
  selectedDate?: string | null
  currentBookings?: { [key: string]: number }
  selectedTime?: AppointmentTimeSlot | null
  onTimeSelect?: (timeSlot: AppointmentTimeSlot) => void
  availabilityLoading?: boolean
}

export default function ServiceSelector({
  selectedService,
  onServiceSelect,
  selectedDate,
  currentBookings = {},
  selectedTime = null,
  onTimeSelect,
  availabilityLoading = false,
}: ServiceSelectorProps) {
  const isSlotAvailable = (service: ServiceOption) => {
    if (service.externalLink) return true
    if (!selectedDate) return true
    
    const currentBookingsCount = currentBookings[service.id] || 0
    return currentBookingsCount < service.dailySlots
  }

  const getRemainingSlots = (service: ServiceOption) => {
    if (service.externalLink) return null
    const currentBookingsCount = currentBookings[service.id] || 0
    return Math.max(0, service.dailySlots - currentBookingsCount)
  }

  const handleServiceClick = (service: ServiceOption) => {
    if (service.externalLink) {
      window.open(service.externalLink, '_blank')
      return
    }
    onServiceSelect(service.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="cho-section-icon">
            <Calendar className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Select service</h2>
            <p className="text-xs font-medium text-slate-500">Availability updates with your chosen date.</p>
          </div>
        </div>
        {selectedDate && (
          <span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200 sm:inline-block">
            {availabilityLoading
              ? 'Checking availability…'
              : `${Object.values(currentBookings).reduce((a, b) => a + b, 0)} booked`}
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {serviceOptions.map((service) => {
          const isSelected = selectedService === service.id
          const isAvailable = isSlotAvailable(service)
          const remainingSlots = getRemainingSlots(service)
          
          return (
            <button
              type="button"
              key={service.id}
              onClick={() => isAvailable && handleServiceClick(service)}
              disabled={!isAvailable}
              aria-pressed={isSelected}
              aria-label={`${service.name}${remainingSlots !== null ? `, ${remainingSlots} slots left` : ''}`}
              className={`
                group relative rounded-2xl border p-4 transition-all duration-200 text-left
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2
                disabled:cursor-not-allowed
                ${isSelected
                  ? 'border-emerald-500 bg-emerald-50/70 shadow-lg shadow-emerald-600/10 ring-2 ring-emerald-500/25'
                  : isAvailable
                    ? 'cursor-pointer border-slate-200/90 bg-white shadow-sm hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-900/5'
                    : 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
                }
              `}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`
                    p-2.5 rounded-lg transition-colors
                    ${isSelected ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-100/80 text-emerald-700'}
                  `}>
                    {service.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base">{service.name}</h3>
                    {service.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{service.description}</p>
                    )}
                  </div>
                </div>
                
                {isSelected && (
                  <div className="bg-emerald-600 text-white p-1 rounded-full shadow-xs flex-shrink-0">
                    <Check className="w-4 h-4" />
                  </div>
                )}
              </div>

              {/* Slot Information */}
              {remainingSlots !== null && (
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    Daily Limit: <span className="font-semibold text-slate-800">{service.dailySlots}</span>
                  </div>
                  <div className={`
                    px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-tight
                    ${remainingSlots > 10 
                      ? 'bg-green-100 text-green-800' 
                      : remainingSlots > 5
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }
                  `}>
                    {remainingSlots} slots
                  </div>
                </div>
              )}

              {/* External Link Indicator */}
              {service.externalLink && (
                <div className="mt-3 text-sm text-emerald-600 font-medium">
                  Opens in new tab →
                </div>
              )}

              {/* Unavailable Overlay */}
              {!isAvailable && (
                <div aria-hidden className="absolute inset-0 flex items-center justify-center rounded-2xl bg-slate-100/80">
                  <span className="px-3 text-center text-sm font-medium text-slate-600">
                    {service.dailySlots === 0 ? 'Not available online' : 'Fully booked'}
                  </span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Time Slot Selection for Pre-Natal */}
      {selectedService === 'prenatal' && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <h3 className="mb-2 font-semibold text-emerald-900">Select time slot *</h3>
          <div className="flex gap-3">
            {(['AM', 'PM'] as const).map(slot => (
              <button
                key={slot}
                type="button"
                onClick={() => onTimeSelect?.(slot)}
                aria-pressed={selectedTime === slot}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  selectedTime === slot
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                {slot === 'AM' ? 'Morning (AM)' : 'Afternoon (PM)'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}