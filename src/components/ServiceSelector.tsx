'use client'

import { useState } from 'react'
import { Check, Calendar, Stethoscope, Baby, Syringe, FileText, Heart, Activity, MoreHorizontal } from 'lucide-react'

interface ServiceOption {
  id: string
  name: string
  icon: React.ReactNode
  dailySlots: number
  requiresTimeSlot?: boolean
  description?: string
  externalLink?: string
}

const serviceOptions: ServiceOption[] = [
  {
    id: 'animal-bite',
    name: 'Animal Bite Treatment',
    icon: <Activity className="w-6 h-6" />,
    dailySlots: 150,
    description: 'Post-exposure prophylaxis for animal bites'
  },
  {
    id: 'consultation',
    name: 'Medical Consultation',
    icon: <Stethoscope className="w-6 h-6" />,
    dailySlots: 50,
    description: 'General medical and pediatric consultation'
  },
  {
    id: 'surgical-minor',
    name: 'Minor Surgery',
    icon: <MoreHorizontal className="w-6 h-6" />,
    dailySlots: 10,
    description: 'Minor surgical procedures'
  },
  {
    id: 'immunization',
    name: 'Immunization',
    icon: <Syringe className="w-6 h-6" />,
    dailySlots: 30,
    description: 'Vaccination services'
  },
  {
    id: 'prenatal',
    name: 'Pre-Natal Checkup',
    icon: <Baby className="w-6 h-6" />,
    dailySlots: 30,
    requiresTimeSlot: true,
    description: '30 slots AM / 30 slots PM'
  },
  {
    id: 'health-certificate',
    name: 'Health Certificate',
    icon: <FileText className="w-6 h-6" />,
    dailySlots: 0,
    externalLink: 'https://envi.system.com',
    description: 'Redirect to ENVI System'
  },
  {
    id: 'tb-consultation',
    name: 'TB Consultation',
    icon: <Stethoscope className="w-6 h-6" />,
    dailySlots: 20,
    description: 'Tuberculosis screening and consultation'
  },
  {
    id: 'dental',
    name: 'Dental Services',
    icon: <MoreHorizontal className="w-6 h-6" />,
    dailySlots: 25,
    description: 'Dental checkup and procedures'
  },
  {
    id: 'family-planning',
    name: 'Family Planning',
    icon: <Heart className="w-6 h-6" />,
    dailySlots: 15,
    description: 'Reproductive health services'
  },
  {
    id: 'social-hygiene',
    name: 'Social Hygiene Clinic',
    icon: <Activity className="w-6 h-6" />,
    dailySlots: 20,
    description: 'STD/HIV screening and treatment'
  },
  {
    id: 'drug-testing',
    name: 'Drug Testing',
    icon: <FileText className="w-6 h-6" />,
    dailySlots: 15,
    description: 'Drug screening services'
  },
  {
    id: 'medical-certificate',
    name: 'Medical Certificate',
    icon: <FileText className="w-6 h-6" />,
    dailySlots: 30,
    description: 'Medical certificate issuance'
  }
]

interface ServiceSelectorProps {
  selectedService: string | null
  onServiceSelect: (serviceId: string) => void
  selectedDate?: string | null
  currentBookings?: { [key: string]: number }
}

export default function ServiceSelector({ 
  selectedService, 
  onServiceSelect,
  selectedDate,
  currentBookings = {}
}: ServiceSelectorProps) {
  const [hoveredService, setHoveredService] = useState<string | null>(null)

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
            {Object.values(currentBookings).reduce((a, b) => a + b, 0)} booked
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {serviceOptions.map((service) => {
          const isSelected = selectedService === service.id
          const isAvailable = isSlotAvailable(service)
          const remainingSlots = getRemainingSlots(service)
          
          return (
            <div
              key={service.id}
              onClick={() => isAvailable && handleServiceClick(service)}
              onMouseEnter={() => setHoveredService(service.id)}
              onMouseLeave={() => setHoveredService(null)}
              className={`
                group relative rounded-2xl border p-4 transition-all duration-200
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
                <div className="absolute inset-0 bg-slate-100/80 rounded flex items-center justify-center">
                  <span className="text-slate-600 font-medium">Fully Booked</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Time Slot Selection for Pre-Natal */}
      {selectedService === 'prenatal' && (
        <div className="mt-4 p-4 bg-emerald-50 rounded border border-emerald-200">
          <h3 className="font-semibold text-emerald-900 mb-2">Select Time Slot</h3>
          <div className="flex gap-4">
            <button
              className={`px-4 py-2 rounded border transition-colors ${
                'border-emerald-300 bg-white hover:bg-emerald-100'
              }`}
            >
              Morning (AM)
            </button>
            <button
              className={`px-4 py-2 rounded border transition-colors ${
                'border-emerald-300 bg-white hover:bg-emerald-100'
              }`}
            >
              Afternoon (PM)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}