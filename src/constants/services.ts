export interface LaboratoryServiceDefinition {
  id: string
  name: string
  dailySlots: number
  requiresTimeSlot: boolean
  description: string
  externalUrl?: string
}

export const LABORATORY_SERVICES: readonly LaboratoryServiceDefinition[] = [
  {
    id: 'animal-bite',
    name: 'Animal Bite Treatment',
    dailySlots: 150,
    requiresTimeSlot: false,
    description: 'Post-exposure prophylaxis for animal bites',
  },
  {
    id: 'consultation',
    name: 'Medical Consultation',
    dailySlots: 50,
    requiresTimeSlot: false,
    description: 'General medical and pediatric consultation',
  },
  {
    id: 'surgical-minor',
    name: 'Minor Surgery',
    dailySlots: 10,
    requiresTimeSlot: false,
    description: 'Minor surgical procedures',
  },
  {
    id: 'immunization',
    name: 'Immunization',
    dailySlots: 30,
    requiresTimeSlot: false,
    description: 'Vaccination services',
  },
  {
    id: 'prenatal',
    name: 'Pre-Natal Checkup',
    dailySlots: 30,
    requiresTimeSlot: true,
    description: '30 slots daily; choose AM or PM',
  },
  {
    id: 'health-certificate',
    name: 'Health Certificate',
    dailySlots: 0,
    requiresTimeSlot: false,
    description: 'Issued through the ENVI System',
    externalUrl: process.env.NEXT_PUBLIC_ENVI_URL?.trim() || undefined,
  },
  {
    id: 'tb-consultation',
    name: 'TB Consultation',
    dailySlots: 20,
    requiresTimeSlot: false,
    description: 'Tuberculosis screening and consultation',
  },
  {
    id: 'dental',
    name: 'Dental Services',
    dailySlots: 25,
    requiresTimeSlot: false,
    description: 'Dental checkup and procedures',
  },
  {
    id: 'family-planning',
    name: 'Family Planning',
    dailySlots: 15,
    requiresTimeSlot: false,
    description: 'Reproductive health services',
  },
  {
    id: 'social-hygiene',
    name: 'Social Hygiene Clinic',
    dailySlots: 20,
    requiresTimeSlot: false,
    description: 'STD/HIV screening and treatment',
  },
  {
    id: 'drug-testing',
    name: 'Drug Testing',
    dailySlots: 15,
    requiresTimeSlot: false,
    description: 'Drug screening services',
  },
  {
    id: 'medical-certificate',
    name: 'Medical Certificate',
    dailySlots: 30,
    requiresTimeSlot: false,
    description: 'Medical certificate issuance',
  },
] as const

export const BOOKABLE_SERVICES = LABORATORY_SERVICES.filter(service => !service.externalUrl)

export function getServiceDefinition(serviceId: string): LaboratoryServiceDefinition | undefined {
  return LABORATORY_SERVICES.find(service => service.id === serviceId)
}

export function getServiceName(serviceId: string): string {
  return getServiceDefinition(serviceId)?.name ?? serviceId
}

export function isBookableService(serviceId: string): boolean {
  const service = getServiceDefinition(serviceId)
  return Boolean(service && !service.externalUrl && service.dailySlots > 0)
}

export const APPOINTMENT_TIME_SLOTS = ['AM', 'PM'] as const
export type AppointmentTimeSlot = (typeof APPOINTMENT_TIME_SLOTS)[number]

export function isAppointmentTimeSlot(value: unknown): value is AppointmentTimeSlot {
  return value === 'AM' || value === 'PM'
}
