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
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-emerald-600" />
        <h2 className="text-xl font-semibold text-slate-800">Select Service</h2>
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
                relative p-4 rounded border cursor-pointer transition-all duration-200
                ${isSelected 
                  ? 'border-emerald-600 bg-emerald-50 shadow' 
                  : isAvailable
                    ? 'border-slate-200 bg-white hover:border-emerald-400 hover:shadow'
                    : 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                }
              `}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`
                    p-2 rounded
                    ${isSelected ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700'}
                  `}>
                    {service.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{service.name}</h3>
                    {service.description && (
                      <p className="text-sm text-slate-600">{service.description}</p>
                    )}
                  </div>
                </div>
                
                {isSelected && (
                  <div className="bg-emerald-600 text-white p-1 rounded-full">
                    <Check className="w-4 h-4" />
                  </div>
                )}
              </div>

              {/* Slot Information */}
              {remainingSlots !== null && (
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-sm">
                    <span className="text-slate-600">Daily Limit: </span>
                    <span className="font-medium text-slate-800">{service.dailySlots}</span>
                  </div>
                  <div className={`
                    px-2 py-1 rounded text-xs font-medium
                    ${remainingSlots > 10 
                      ? 'bg-green-100 text-green-800' 
                      : remainingSlots > 5
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }
                  `}>
                    {remainingSlots} slots left
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