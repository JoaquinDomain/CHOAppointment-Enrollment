'use client'

import { useState, useEffect } from 'react'
import { X, FileText, User, Shield, AlertCircle, MapPin, Stethoscope, Printer, Save } from 'lucide-react'
import { BACOLOD_HEALTH_FACILITIES, BACOLOD_YAKAP_FACILITIES } from '@/constants/facilities'
import PrintHeader from '@/components/PrintHeader'

const SERVICE_OPTIONS = [
  { id: 'animal-bite', name: 'Animal Bite Treatment' },
  { id: 'consultation', name: 'Medical Consultation' },
  { id: 'surgical-minor', name: 'Minor Surgery' },
  { id: 'immunization', name: 'Immunization' },
  { id: 'prenatal', name: 'Pre-Natal Checkup' },
  { id: 'health-certificate', name: 'Health Certificate' },
  { id: 'tb-consultation', name: 'TB Consultation' },
  { id: 'dental', name: 'Dental Services' },
  { id: 'family-planning', name: 'Family Planning' },
  { id: 'social-hygiene', name: 'Social Hygiene Clinic' },
  { id: 'drug-testing', name: 'Drug Testing' },
  { id: 'medical-certificate', name: 'Medical Certificate' }
]

const getServiceName = (serviceKey?: string | null): string => {
  if (!serviceKey) return ''
  const found = SERVICE_OPTIONS.find(
    s => s.id === serviceKey || s.name.toLowerCase() === serviceKey.toLowerCase()
  )
  return found ? found.name : serviceKey
}

interface EnrollmentData {
  // Demographics
  lastName: string
  firstName: string
  middleName: string
  suffix: string
  birthdate: string
  age: number
  gender: string
  civilStatus: string
  residentialAddress: string
  contactNumber: string
  spouseName: string
  mothersMaidenName: string
  employmentStatus: string
  primaryCareBenefitMember: boolean

  // Program & Coverage
  philhealthMember: boolean
  philhealthNumber: string
  philhealthStatus: string
  facilityHouseholdNumber: string
  pwd: boolean
  yakapRegistered: boolean
  yakapFacility: string

  // Health Facility
  consultingFacility: string
  selectedService?: string

  // Clinical Information (print-only, dynamically populated)
  chiefComplaint1?: string
  chiefComplaint2?: string

  // Consent
  dataPrivacyConsent: boolean
}

interface EnrollmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: EnrollmentData) => void
  initialData?: Partial<EnrollmentData>
  requireSave?: boolean
  inline?: boolean
  selectedService?: string | null
}

const ClinicalInformationSection = () => (
  <div className="space-y-3 sm:space-y-4">
    {/* Chief Complaint */}
    <div className="w-full flex flex-col gap-1">
      <label className="block text-xs sm:text-sm font-medium text-slate-700">Chief Complaint</label>
      <div className="w-full min-h-12 sm:min-h-14 border-b border-slate-300"></div>
    </div>

    {/* Vital Signs */}
    <div className="w-full flex flex-col gap-2">
      <label className="block text-xs sm:text-sm font-medium text-slate-700">Vital Signs</label>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
        <div>
          <label className="block text-xs text-slate-600 mb-1">PR</label>
          <div className="h-8 border-b border-slate-300"></div>
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">CR</label>
          <div className="h-8 border-b border-slate-300"></div>
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">BP</label>
          <div className="h-8 border-b border-slate-300"></div>
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">RR</label>
          <div className="h-8 border-b border-slate-300"></div>
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">O₂ Sat</label>
          <div className="h-8 border-b border-slate-300"></div>
        </div>
      </div>
    </div>

    {/* Height, Weight, Waist */}
    <div className="w-full flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Ht</label>
          <div className="h-8 border-b border-slate-300"></div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Wt</label>
          <div className="h-8 border-b border-slate-300"></div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Waist</label>
          <div className="h-8 border-b border-slate-300"></div>
        </div>
      </div>
    </div>

    {/* SOAP Notes */}
    <div className="w-full flex flex-col gap-2">
      <label className="block text-xs font-medium text-slate-700">SOAP Notes</label>
      <div className="w-full min-h-16 sm:min-h-20 border-b border-slate-300"></div>
    </div>

    {/* Labs & Prescriptions */}
    <div className="w-full flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Labs</label>
          <div className="h-12 sm:h-14 border-b border-slate-300"></div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Prescriptions</label>
          <div className="h-12 sm:h-14 border-b border-slate-300"></div>
        </div>
      </div>
    </div>

    {/* Physician Signature & Date */}
    <div className="w-full flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Physician Sig</label>
          <div className="h-10 border-b border-slate-300"></div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
          <div className="h-8 border-b border-slate-300"></div>
        </div>
      </div>
    </div>
  </div>
)

export default function EnrollmentModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  requireSave = false,
  inline = false,
  selectedService
}: EnrollmentModalProps) {
  const [formData, setFormData] = useState<EnrollmentData>({
    lastName: '',
    firstName: '',
    middleName: '',
    suffix: '',
    birthdate: '',
    age: 0,
    gender: '',
    civilStatus: '',
    residentialAddress: '',
    contactNumber: '',
    spouseName: '',
    mothersMaidenName: '',
    employmentStatus: '',
    primaryCareBenefitMember: false,

    philhealthMember: false,
    philhealthNumber: '',
    philhealthStatus: '',
    facilityHouseholdNumber: '',
    pwd: false,
    yakapRegistered: false,
    yakapFacility: '',

    consultingFacility: '',

    chiefComplaint1: '',
    chiefComplaint2: '',

    dataPrivacyConsent: false
  })

  const [printTimestamp, setPrintTimestamp] = useState('')

  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({ ...prev, ...initialData }))
    }
  }, [initialData])

  // Dynamic service binding: whatever the patient selects in the UI
  // (radio buttons, checkboxes, or interactive ServiceSelector cards)
  // is mapped to the printable checklist on the PATIENT ENROLLMENT RECORD / ITR.
  useEffect(() => {
    if (selectedService) {
      setFormData(prev =>
        prev.selectedService === selectedService
          ? prev
          : { ...prev, selectedService }
      )
    }
  }, [selectedService])

  useEffect(() => {
    const handleBeforePrint = () => {
      setPrintTimestamp(new Date().toLocaleString())
    }
    window.addEventListener('beforeprint', handleBeforePrint)
    return () => window.removeEventListener('beforeprint', handleBeforePrint)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleBirthdateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const birthdate = e.target.value
    const age = calculateAgeFromDOB(birthdate)
    setFormData(prev => ({
      ...prev,
      birthdate,
      age
    }))
  }

  const calculateAgeFromDOB = (birthdate: string): number => {
    if (!birthdate) return 0
    const birth = new Date(birthdate)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
    onClose()
  }

  const handlePrint = () => {
    window.print()
  }

  const handleClose = () => {
    onClose()
  }

  if (!isOpen) return null

  const formContent = (
    <div className={`bg-white overflow-hidden ${inline ? 'rounded-xl border border-slate-200 shadow-sm' : 'rounded-lg shadow-lg max-w-4xl w-full max-h-[95vh] overflow-y-auto'}`}>
      {/* Header */}
      <div className="bg-emerald-600 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between no-print">
        <div className="flex items-center gap-2 sm:gap-3">
          <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-white">Patient Enrollment Record / ITR</h2>
            <p className="text-emerald-100 text-xs sm:text-sm">Individual Treatment Record</p>
          </div>
        </div>
        {!inline && (
          <button
            onClick={handleClose}
            className="p-2 hover:bg-emerald-700 rounded transition-colors text-white"
            type="button"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}
      </div>

      {/* Printable Form */}
      <div id="enrollment-form" className="p-4 sm:p-6">
        {/* Print Header - Only visible when printing */}
        <PrintHeader />

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          {/* Section 1: Patient Demographics */}
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
              <h3 className="text-sm sm:text-base font-semibold text-slate-800">Patient Demographics</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Last Name *</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Middle Name</label>
                <input
                  type="text"
                  name="middleName"
                  value={formData.middleName}
                  onChange={handleInputChange}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Suffix</label>
                <select
                  name="suffix"
                  value={formData.suffix}
                  onChange={handleInputChange}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                >
                  <option value="">None</option>
                  <option value="Jr.">Jr.</option>
                  <option value="Sr.">Sr.</option>
                  <option value="II">II</option>
                  <option value="III">III</option>
                  <option value="IV">IV</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Birthdate *</label>
                <input
                  type="date"
                  name="birthdate"
                  value={formData.birthdate}
                  onChange={handleBirthdateChange}
                  required
                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Age</label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  readOnly
                  className="w-full px-2 py-1 border border-slate-300 rounded bg-slate-100 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Gender *</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  required
                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Civil Status</label>
                <select
                  name="civilStatus"
                  value={formData.civilStatus}
                  onChange={handleInputChange}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                >
                  <option value="">Select</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Widowed">Widowed</option>
                  <option value="Separated">Separated</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Employment Status</label>
                <select
                  name="employmentStatus"
                  value={formData.employmentStatus}
                  onChange={handleInputChange}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                >
                  <option value="">Select</option>
                  <option value="Employed">Employed</option>
                  <option value="Unemployed">Unemployed</option>
                  <option value="Self-Employed">Self-Employed</option>
                  <option value="Student">Student</option>
                  <option value="Retired">Retired</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Spouse Name (if applicable)</label>
                <input
                  type="text"
                  name="spouseName"
                  value={formData.spouseName}
                  onChange={handleInputChange}
                  placeholder="Enter spouse name"
                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Mother&apos;s Maiden Name</label>
                <input
                  type="text"
                  name="mothersMaidenName"
                  value={formData.mothersMaidenName}
                  onChange={handleInputChange}
                  placeholder="Enter mother's maiden name"
                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Residential Address *</label>
                <input
                  type="text"
                  name="residentialAddress"
                  value={formData.residentialAddress}
                  onChange={handleInputChange}
                  required
                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Contact Number *</label>
                <input
                  type="tel"
                  name="contactNumber"
                  value={formData.contactNumber}
                  onChange={handleInputChange}
                  required
                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Program & Coverage */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
              <Shield className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-semibold text-slate-800">Program & Coverage</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="primaryCareBenefitMember"
                  checked={formData.primaryCareBenefitMember}
                  onChange={handleInputChange}
                  className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-slate-700 font-medium">PCB Member</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="philhealthMember"
                  checked={formData.philhealthMember}
                  onChange={handleInputChange}
                  className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-slate-700 font-medium">PhilHealth Member</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="pwd"
                  checked={formData.pwd}
                  onChange={handleInputChange}
                  className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-slate-700 font-medium">PWD</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="yakapRegistered"
                  checked={formData.yakapRegistered}
                  onChange={handleInputChange}
                  className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-slate-700 font-medium">YAKAP Registered</span>
              </label>
            </div>

            {/* Conditional PhilHealth Fields */}
            {formData.philhealthMember && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded mt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">PhilHealth Number (PIN)</label>
                  <input
                    type="text"
                    name="philhealthNumber"
                    value={formData.philhealthNumber}
                    onChange={handleInputChange}
                    placeholder="Enter PhilHealth PIN"
                    className="w-full px-2 py-1 border border-slate-300 rounded text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">PhilHealth Category / Status</label>
                  <select
                    name="philhealthStatus"
                    value={formData.philhealthStatus}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 border border-slate-300 rounded text-xs bg-white"
                  >
                    <option value="">Select Category</option>
                    <option value="MEMBER">MEMBER</option>
                    <option value="DEPENDENT">DEPENDENT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Facility Household Number</label>
                  <input
                    type="text"
                    name="facilityHouseholdNumber"
                    value={formData.facilityHouseholdNumber}
                    onChange={handleInputChange}
                    placeholder="Enter Household No."
                    className="w-full px-2 py-1 border border-slate-300 rounded text-xs bg-white"
                  />
                </div>
              </div>
            )}

            {/* Conditional YAKAP Fields */}
            {formData.yakapRegistered && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded mt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">YAKAP Facility</label>
                  <select
                    name="yakapFacility"
                    value={formData.yakapFacility}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 border border-slate-300 rounded text-xs bg-white"
                  >
                    <option value="">Select Facility</option>
                    {BACOLOD_YAKAP_FACILITIES.map(facility => (
                      <option key={facility} value={facility}>
                        {facility}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Health Facility & Service Requested */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-semibold text-slate-800">Health Facility & Service Requested</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Health Facility *</label>
                <select
                  name="consultingFacility"
                  value={formData.consultingFacility}
                  onChange={handleInputChange}
                  required
                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                >
                  <option value="">Select Facility</option>
                  {BACOLOD_HEALTH_FACILITIES.map(facility => (
                    <option key={facility} value={facility}>
                      {facility}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Requested Service / Type of Service *</label>
                <input
                  type="text"
                  readOnly
                  value={getServiceName(formData.selectedService || selectedService) || 'No Service Selected'}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs bg-slate-50 font-semibold text-slate-800"
                />
              </div>
            </div>

            {/* Service Selection Checklist */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Service Requested Checklist</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs">
                {SERVICE_OPTIONS.map(service => {
                  const activeKey = formData.selectedService || selectedService || ''
                  const activeName = getServiceName(activeKey)
                  const isSelected =
                    activeKey === service.id ||
                    activeName.toLowerCase() === service.name.toLowerCase()

                  return (
                    <div
                      key={service.id}
                      className={`flex items-center gap-1.5 p-1.5 rounded border ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <span
                        className={`print-service-checkbox inline-flex items-center justify-center w-3.5 h-3.5 border rounded-2xs text-[10px] leading-none ${
                          isSelected
                            ? 'border-emerald-700 bg-emerald-600 text-white font-bold'
                            : 'border-slate-400 bg-white'
                        }`}
                      >
                        {isSelected ? '✓' : ''}
                      </span>
                      <span className="text-xs leading-tight">{service.name}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Section 4: Data Privacy Consent */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
              <AlertCircle className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-semibold text-slate-800">Section II: Data Privacy Consent (Pahintulot ng Pasyente)</h3>
            </div>
            <div className="consent-text space-y-1.5 text-xs text-slate-600 leading-relaxed">
              <p>
                Aking nabasa at naintindihan ang Impormasyon ng Pasyente matapos ako&apos;y bigyang-kaalaman ng mga nilalaman nito. Sa isang pag-uusap kasama ang kinatawan ng CHO/BHS, ako ay binigyang-paunawa nang mahusay tungkol sa kakayahan at kahalagahan ng Integrated Clinic Information System (iClinicSys/YAKAP). Lahat ng aking mga katanungan sa panahon ng pag-uusap ay nasagot ng sapat at ako ay binigyang ng sapat na oras upang magpasya nito.
              </p>
              <p>
                Higit pa rito, pinapayagan ko ang CHO/BHS upang i-encode ang mga impormasyon patungkol sa akin at ang mga nakolektang impormasyon tungkol sa mga sintomas ng aking sakit at konsultasyong kaugnay dito para sa nasabing information system.
              </p>
              <p>
                Nais kong malaman at maipaalam sa aking direktang kapamilya ang aking mga medikal na resulta. Gayundin, maari kong kanselahin ang aking pahintulot sa CHO/BHS anumang oras na walang ibinibigay na dahilan at walang kinalaman sa anumang kawalan para sa aking medikal na pagpapagamot.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                name="dataPrivacyConsent"
                id="dataPrivacyConsent"
                checked={formData.dataPrivacyConsent}
                onChange={handleInputChange}
                required
                className="w-3 h-3"
              />
              <label htmlFor="dataPrivacyConsent" className="text-xs font-medium text-slate-700">
                I accept the Data Privacy Consent *
              </label>
            </div>
            {/* Print-order: Signatures Block terminates Page 1 directly below Section II consent.
                Web UI unchanged: .print-only-clinical-info stays display:none on screen. */}
            <div className="signature-row-compact signature-page1-end">
              <div className="signature-col-compact">
                <div className="signature-line-compact"></div>
                <div className="signature-label-compact">Patient Sig / Date</div>
              </div>
              <div className="signature-col-compact">
                <div className="signature-line-compact"></div>
                <div className="signature-label-compact">CHO/BHS Rep Sig / Date</div>
              </div>
            </div>
            {/* Print-only Clinical Information — hidden on screen, rendered only in print.
                PAGE 2: entire section forced onto second printed page via
                break-before: page. Page 1 ends at signatures above.
                Web UI layout, styles, and components above remain 100% untouched. */}
            <div className="print-only-clinical-info print-page-2" aria-hidden="true">
              <div className="print-clinical-title">Clinical Information</div>
              <div className="print-cc-block">
                <div className="print-cc-label">Chief Complaint</div>
                <div className="print-cc-line">{[formData.chiefComplaint1, formData.chiefComplaint2].filter(Boolean).join(' / ') || ''}&nbsp;</div>
                <div className="print-cc-line">&nbsp;</div>
              </div>
              <div className="print-vs-block">
                <div className="print-vs-row print-vs-row-4">
                  <div className="print-vs-cell"><span className="print-vs-label">PR</span><span className="print-vs-line">&nbsp;</span></div>
                  <div className="print-vs-cell"><span className="print-vs-label">CR</span><span className="print-vs-line">&nbsp;</span></div>
                  <div className="print-vs-cell"><span className="print-vs-label">BP</span><span className="print-vs-line">&nbsp;</span></div>
                  <div className="print-vs-cell"><span className="print-vs-label">RR</span><span className="print-vs-line">&nbsp;</span></div>
                </div>
                <div className="print-vs-row print-vs-row-1">
                  <div className="print-vs-cell"><span className="print-vs-label">O2 Sat</span><span className="print-vs-line">&nbsp;</span></div>
                </div>
                <div className="print-vs-row print-vs-row-3">
                  <div className="print-vs-cell"><span className="print-vs-label">Height</span><span className="print-vs-line">&nbsp;</span></div>
                  <div className="print-vs-cell"><span className="print-vs-label">Weight</span><span className="print-vs-line">&nbsp;</span></div>
                  <div className="print-vs-cell"><span className="print-vs-label">Waist</span><span className="print-vs-line">&nbsp;</span></div>
                </div>
              </div>
              <div className="print-soap-block">
                <div className="print-cc-label">SOAP Notes</div>
                <div className="print-write-line">&nbsp;</div>
                <div className="print-write-line">&nbsp;</div>
              </div>
              <div className="print-labs-block">
                <div className="print-cc-label">Labs</div>
                <div className="print-write-line">&nbsp;</div>
                <div className="print-write-line">&nbsp;</div>
              </div>
              <div className="print-rx-block">
                <div className="print-cc-label">Prescriptions</div>
                <div className="print-write-line">&nbsp;</div>
                <div className="print-write-line">&nbsp;</div>
              </div>
              <div className="print-physician-row">
                <div className="print-physician-col">
                  <div className="print-physician-line"></div>
                  <div className="print-physician-label">Physician Signature</div>
                </div>
                <div className="print-physician-col print-physician-date">
                  <div className="print-physician-line"></div>
                  <div className="print-physician-label">Date</div>
                </div>
              </div>
            </div>
          </div>

          {/* NOTE: Full ClinicalInformationSection web component is intentionally not
              rendered on screen here to preserve the web UI layout 100%.
              Only the print-only block above (.print-only-clinical-info.print-page-2)
              is emitted in print, forced onto PAGE 2 for a 2-page A4 layout. */}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t border-slate-200 no-print">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium"
            >
              Print
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-2 py-1 bg-emerald-600 text-white rounded text-xs font-medium"
            >
              Save
            </button>
          </div>
        </form>
      </div>

      <style jsx global>{`
        .signature-row-compact {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          margin-top: 8px;
        }
        .signature-col-compact {
          width: 48%;
          text-align: center;
        }
        .signature-line-compact {
          border-bottom: 1px solid #000;
          margin-bottom: 2px;
          height: 20px;
        }
        .signature-label-compact {
          font-size: 7pt;
          font-weight: 600;
          color: #0f172a;
        }
        /* Print-only Clinical Information — strictly hidden on screen/web.
           Zero impact on web UI layout, margins, fonts, or positioning. */
        .print-only-clinical-info {
          display: none !important;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 8mm;
          }
          
          body {
            background: #fff !important;
            color: #000 !important;
            font-size: 9px;
            line-height: 1.15;
          }

          .consent-text {
            font-size: 7pt !important;
            line-height: 1.15 !important;
            margin-bottom: 2px !important;
          }

          .consent-text p {
            margin: 0 0 2px !important;
          }
          
          body * {
            visibility: hidden;
          }
          
          #enrollment-form, #enrollment-form * {
            visibility: visible;
          }
          
          #enrollment-form {
            position: static;
            left: auto;
            top: auto;
            width: auto;
            max-height: none;
            overflow: visible;
            page-break-inside: auto;
            margin: 0 2mm;
            padding: 3mm 4mm;
            line-height: 1.15;
            font-size: 9px;
            zoom: 1;
          }

          #enrollment-form form {
            line-height: 1.15;
          }

          #enrollment-form .space-y-2 > *,
          #enrollment-form .space-y-3 > *,
          #enrollment-form .space-y-4 > * {
            margin-bottom: 3px !important;
            font-size: 9px;
            line-height: 1.15;
            padding: 2mm 0;
          }

          /* Page 1 ends at Patient / CHO-BHS signatures */
          .signature-row-compact {
            margin-top: 4px !important;
            gap: 10px !important;
          }

          .signature-page1-end {
            break-after: page !important;
            page-break-after: always !important;
          }

          .signature-line-compact {
            height: 14px !important;
            margin-bottom: 1px !important;
          }

          .signature-label-compact {
            font-size: 6.5pt !important;
          }

          .signature-terminator {
            break-after: avoid;
            page-break-after: avoid;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          
          .no-print {
            display: none !important;
          }
          
          .print-only {
            display: block !important;
          }

          /* Full Clinical Information — PAGE 2 ONLY.
             Entire section forced onto second printed page, kept together.
             Web classes untouched. Spec: font-size 9px; line-height 1.15; padding 2mm 0. */
          .print-only-clinical-info {
            display: block !important;
            font-size: 9px !important;
            line-height: 1.15 !important;
            padding: 2mm 0 !important;
            margin-bottom: 2px !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .print-only-clinical-info.print-page-2 {
            break-before: page !important;
            page-break-before: always !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .print-only-clinical-info .print-clinical-title {
            font-size: 9px !important;
            line-height: 1.15 !important;
            padding: 2mm 0 !important;
            margin-bottom: 2px !important;
            font-weight: 700 !important;
            color: #000 !important;
            border-bottom: 1px solid #000 !important;
            padding-bottom: 2px !important;
          }

          .print-only-clinical-info .print-cc-block,
          .print-only-clinical-info .print-vs-block,
          .print-only-clinical-info .print-soap-block,
          .print-only-clinical-info .print-labs-block,
          .print-only-clinical-info .print-rx-block {
            font-size: 9px !important;
            line-height: 1.15 !important;
            padding: 2mm 0 !important;
            margin-bottom: 2px !important;
          }

          .print-only-clinical-info .print-cc-label {
            font-size: 9px !important;
            line-height: 1.15 !important;
            padding: 2mm 0 !important;
            margin-bottom: 1px !important;
            font-weight: 600 !important;
            color: #000 !important;
          }

          .print-only-clinical-info .print-cc-line,
          .print-only-clinical-info .print-write-line {
            font-size: 9px !important;
            line-height: 1.15 !important;
            padding: 2mm 0 !important;
            margin-bottom: 1px !important;
            border-bottom: 1px solid #000 !important;
            min-height: 12px !important;
            color: #000 !important;
          }

          .print-only-clinical-info .print-vs-row {
            display: flex !important;
            gap: 8px !important;
            margin-bottom: 1px !important;
            font-size: 9px !important;
            line-height: 1.15 !important;
            padding: 2mm 0 !important;
          }

          .print-only-clinical-info .print-vs-cell {
            flex: 1 !important;
            display: flex !important;
            align-items: flex-end !important;
            gap: 3px !important;
          }

          .print-only-clinical-info .print-vs-label {
            font-size: 9px !important;
            line-height: 1.15 !important;
            font-weight: 600 !important;
            color: #000 !important;
            white-space: nowrap !important;
          }

          .print-only-clinical-info .print-vs-line {
            flex: 1 !important;
            border-bottom: 1px solid #000 !important;
            min-height: 12px !important;
          }

          .print-only-clinical-info .print-physician-row {
            display: flex !important;
            justify-content: space-between !important;
            gap: 10px !important;
            margin-top: 3px !important;
            font-size: 9px !important;
            line-height: 1.15 !important;
            padding: 2mm 0 !important;
          }

          .print-only-clinical-info .print-physician-col {
            width: 48% !important;
            text-align: center !important;
          }

          .print-only-clinical-info .print-physician-col.print-physician-date {
            width: 30% !important;
            margin-left: auto !important;
          }

          .print-only-clinical-info .print-physician-line {
            border-bottom: 1px solid #000 !important;
            margin-bottom: 1px !important;
            height: 14px !important;
          }

          .print-only-clinical-info .print-physician-label {
            font-size: 6.5pt !important;
            line-height: 1.15 !important;
            font-weight: 600 !important;
            color: #000 !important;
          }
          
          input, select, textarea {
            border: none !important;
            border-bottom: 1px solid #000 !important;
            border-radius: 0 !important;
            background: transparent !important;
            padding: 0 !important;
            font-size: 9px !important;
            line-height: 1.15 !important;
            box-shadow: none !important;
            outline: none !important;
            -webkit-appearance: none !important;
            -moz-appearance: none !important;
            appearance: none !important;
          }
          
          select {
            background-image: none !important;
          }
          
          input[type="checkbox"] {
            display: none !important;
          }

          .print-service-checkbox {
            border: 1px solid #000 !important;
            color: #000 !important;
            background: transparent !important;
            display: inline-flex !important;
          }
          
          .border-slate-200, .border-slate-300 {
            border-color: #000 !important;
          }
          
          .text-slate-600, .text-slate-700, .text-slate-800, .text-slate-900 {
            color: #000 !important;
          }
          
          .bg-slate-100, .bg-amber-50 {
            background: transparent !important;
          }
          
          .space-y-2 {
            gap: 0.2rem !important;
          }
          
          .space-y-3 {
            gap: 0.25rem !important;
          }
          
          .space-y-4 {
            gap: 0.3rem !important;
          }

          #enrollment-form .grid {
            gap: 0.25rem !important;
          }

          #enrollment-form h3 {
            margin-bottom: 2px !important;
            padding-bottom: 2px !important;
            line-height: 1.15 !important;
            font-size: 9px !important;
          }

          #enrollment-form label {
            line-height: 1.15 !important;
            font-size: 8.5px !important;
            margin-bottom: 0 !important;
          }

          /* Compact service checklist boxes for print */
          #enrollment-form .grid > div[class*="rounded"] {
            padding: 2px 4px !important;
          }

          #enrollment-form .grid span:last-child {
            font-size: 8.5px !important;
            line-height: 1.15 !important;
          }

          #enrollment-form .mb-1,
          #enrollment-form .mb-1\.5 {
            margin-bottom: 1px !important;
          }

          #enrollment-form .pb-1,
          #enrollment-form .pb-2 {
            padding-bottom: 2px !important;
          }

          #enrollment-form .pt-1,
          #enrollment-form .pt-2 {
            padding-top: 1px !important;
          }

          #enrollment-form .p-2,
          #enrollment-form .p-2\.5 {
            padding: 4px !important;
          }
        }
        
        @media (max-width: 640px) {
          #enrollment-form {
            padding: 8px;
          }
        }
      `}</style>
    </div>
  )

  if (inline) {
    return formContent
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      {formContent}
    </div>
  )
}
