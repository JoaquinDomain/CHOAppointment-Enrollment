'use client'

import { useState, useEffect } from 'react'
import { X, FileText, User, Shield, AlertCircle, MapPin, Printer, Save } from 'lucide-react'

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

  // Consent
  dataPrivacyConsent: boolean
}

interface EnrollmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: EnrollmentData) => void
  initialData?: Partial<EnrollmentData>
  requireSave?: boolean // If true, modal cannot be closed without saving
}

export default function EnrollmentModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  requireSave = false
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

    dataPrivacyConsent: false
  })

  const [printTimestamp, setPrintTimestamp] = useState('')

  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({ ...prev, ...initialData }))
    }
  }, [initialData])

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

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto border border-slate-200">
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-teal-700 to-teal-800 px-4 sm:px-6 py-3 sm:py-5 flex items-center justify-between z-50 shadow-lg">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-white/20 p-1.5 sm:p-2 rounded-lg">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h2 className="text-base sm:text-xl font-bold text-white">Patient Enrollment Record / ITR</h2>
                <p className="text-teal-100 text-xs sm:text-sm">Individual Treatment Record</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 sm:p-3 hover:bg-white/20 rounded-lg transition-colors z-50 group touch-manipulation"
              type="button"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6 text-white group-hover:text-teal-200" />
            </button>
          </div>

          {/* Printable Form */}
          <div id="enrollment-form" className="p-3 sm:p-6">
            {/* Print Header - Only visible when printing */}
            <div className="print-only hidden">
              <div className="text-center mb-4">
                <h1 className="text-2xl font-bold text-slate-900">City Health Office</h1>
                <h2 className="text-lg font-semibold text-slate-700">Patient Enrollment Record / Individual Treatment Record</h2>
                <p className="text-sm text-slate-600 mt-2">Date Printed: {printTimestamp}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              {/* Section 1: Demographics */}
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b-2 border-teal-200">
                  <div className="bg-teal-100 p-1.5 sm:p-2 rounded-lg">
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-teal-700" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800">Patient Demographics</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Last Name *</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-800 text-sm sm:text-base"
                      style={{ color: '#1e293b' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">First Name *</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-800 text-sm sm:text-base"
                      style={{ color: '#1e293b' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Middle Name</label>
                    <input
                      type="text"
                      name="middleName"
                      value={formData.middleName}
                      onChange={handleInputChange}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-800 text-sm sm:text-base"
                      style={{ color: '#1e293b' }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Suffix</label>
                    <select
                      name="suffix"
                      value={formData.suffix}
                      onChange={handleInputChange}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm sm:text-base"
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
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Birthdate *</label>
                    <input
                      type="date"
                      name="birthdate"
                      value={formData.birthdate}
                      onChange={handleBirthdateChange}
                      required
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm sm:text-base"
                      style={{ color: '#1e293b' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Age</label>
                    <input
                      type="number"
                      name="age"
                      value={formData.age}
                      onChange={handleInputChange}
                      readOnly
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-600 text-sm sm:text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Gender *</label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      required
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm sm:text-base"
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Civil Status</label>
                    <select
                      name="civilStatus"
                      value={formData.civilStatus}
                      onChange={handleInputChange}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm sm:text-base"
                    >
                      <option value="">Select Status</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Widowed">Widowed</option>
                      <option value="Separated">Separated</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Employment Status</label>
                    <select
                      name="employmentStatus"
                      value={formData.employmentStatus}
                      onChange={handleInputChange}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm sm:text-base"
                    >
                      <option value="">Select Status</option>
                      <option value="Employed">Employed</option>
                      <option value="Unemployed">Unemployed</option>
                      <option value="Self-Employed">Self-Employed</option>
                      <option value="Student">Student</option>
                      <option value="Retired">Retired</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Residential Address *</label>
                  <input
                    type="text"
                    name="residentialAddress"
                    value={formData.residentialAddress}
                    onChange={handleInputChange}
                    required
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-800 text-sm sm:text-base"
                    style={{ color: '#1e293b' }}
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Contact Number *</label>
                  <input
                    type="tel"
                    name="contactNumber"
                    value={formData.contactNumber}
                    onChange={handleInputChange}
                    required
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-800 text-sm sm:text-base"
                    style={{ color: '#1e293b' }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Spouse Name (if applicable)</label>
                    <input
                      type="text"
                      name="spouseName"
                      value={formData.spouseName}
                      onChange={handleInputChange}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-800 text-sm sm:text-base"
                      style={{ color: '#1e293b' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Mother's Maiden Name</label>
                    <input
                      type="text"
                      name="mothersMaidenName"
                      value={formData.mothersMaidenName}
                      onChange={handleInputChange}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-800 text-sm sm:text-base"
                      style={{ color: '#1e293b' }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="primaryCareBenefitMember"
                    id="primaryCareBenefitMember"
                    checked={formData.primaryCareBenefitMember}
                    onChange={handleInputChange}
                    className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                  />
                  <label htmlFor="primaryCareBenefitMember" className="text-xs sm:text-sm text-slate-700">
                    Primary Care Benefit Member
                  </label>
                </div>
              </div>

              {/* Section 2: Program & Coverage */}
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b-2 border-teal-200">
                  <div className="bg-teal-100 p-1.5 sm:p-2 rounded-lg">
                    <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-teal-700" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800">Program & Coverage</h3>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="philhealthMember"
                      id="philhealthMember"
                      checked={formData.philhealthMember}
                      onChange={handleInputChange}
                      className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                    />
                    <label htmlFor="philhealthMember" className="text-xs sm:text-sm text-slate-700">
                      PhilHealth Member
                    </label>
                  </div>

                  {formData.philhealthMember && (
                    <div className="space-y-3 pl-4 sm:pl-6 border-l-2 border-teal-200">
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">PhilHealth Number</label>
                        <input
                          type="text"
                          name="philhealthNumber"
                          value={formData.philhealthNumber}
                          onChange={handleInputChange}
                          className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm sm:text-base"
                          style={{ color: '#1e293b' }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">PhilHealth Status / Family Member</label>
                        <input
                          type="text"
                          name="philhealthStatus"
                          value={formData.philhealthStatus}
                          onChange={handleInputChange}
                          className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm sm:text-base"
                          style={{ color: '#1e293b' }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Facility Household Number</label>
                        <input
                          type="text"
                          name="facilityHouseholdNumber"
                          value={formData.facilityHouseholdNumber}
                          onChange={handleInputChange}
                          className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm sm:text-base"
                          style={{ color: '#1e293b' }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="pwd"
                      id="pwd"
                      checked={formData.pwd}
                      onChange={handleInputChange}
                      className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                    />
                    <label htmlFor="pwd" className="text-xs sm:text-sm text-slate-700">
                      PWD
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="yakapRegistered"
                      id="yakapRegistered"
                      checked={formData.yakapRegistered}
                      onChange={handleInputChange}
                      className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                    />
                    <label htmlFor="yakapRegistered" className="text-xs sm:text-sm text-slate-700">
                      YAKAP Registered
                    </label>
                  </div>

                  {formData.yakapRegistered && (
                    <div className="pl-4 sm:pl-6 border-l-2 border-teal-200">
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">YAKAP Facility</label>
                      <select
                        name="yakapFacility"
                        value={formData.yakapFacility}
                        onChange={handleInputChange}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm sm:text-base"
                      >
                        <option value="">Select Facility</option>
                        <option value="City Health Office">City Health Office</option>
                        <option value="Alangilan Health Station">Alangilan Health Station</option>
                        <option value="Banago Health Station">Banago Health Station</option>
                        <option value="Bata Health Station">Bata Health Station</option>
                        <option value="Cabug Health Station">Cabug Health Station</option>
                        <option value="Estefania Health Station">Estefania Health Station</option>
                        <option value="Felisa Health Station">Felisa Health Station</option>
                        <option value="Gomez Health Station">Gomez Health Station</option>
                        <option value="Granada Health Station">Granada Health Station</option>
                        <option value="Handumanan Health Station">Handumanan Health Station</option>
                        <option value="Mandalagan Health Station">Mandalagan Health Station</option>
                        <option value="Mansilingan Health Station">Mansilingan Health Station</option>
                        <option value="Monte Rey Health Station">Monte Rey Health Station</option>
                        <option value="Pahanocoy Health Station">Pahanocoy Health Station</option>
                        <option value="Puso Health Station">Puso Health Station</option>
                        <option value="San Juan Health Station">San Juan Health Station</option>
                        <option value="Singcang Health Station">Singcang Health Station</option>
                        <option value="Sum-ag Health Station">Sum-ag Health Station</option>
                        <option value="Tangub Health Station">Tangub Health Station</option>
                        <option value="Taculing Health Station">Taculing Health Station</option>
                        <option value="Vista Alegre Health Station">Vista Alegre Health Station</option>
                        <option value="Villamonte Health Station">Villamonte Health Station</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Health Facility Information */}
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b-2 border-teal-200">
                  <div className="bg-teal-100 p-1.5 sm:p-2 rounded-lg">
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-teal-700" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800">Health Facility Information</h3>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Health Facility Where Consulted *</label>
                  <select
                    name="consultingFacility"
                    value={formData.consultingFacility}
                    onChange={handleInputChange}
                    required
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm sm:text-base"
                  >
                    <option value="">Select Facility</option>
                    <option value="City Health Office">City Health Office</option>
                    <option value="Alangilan Health Station">Alangilan Health Station</option>
                    <option value="Banago Health Station">Banago Health Station</option>
                    <option value="Bata Health Station">Bata Health Station</option>
                    <option value="Cabug Health Station">Cabug Health Station</option>
                    <option value="Estefania Health Station">Estefania Health Station</option>
                    <option value="Felisa Health Station">Felisa Health Station</option>
                    <option value="Gomez Health Station">Gomez Health Station</option>
                    <option value="Granada Health Station">Granada Health Station</option>
                    <option value="Handumanan Health Station">Handumanan Health Station</option>
                    <option value="Mandalagan Health Station">Mandalagan Health Station</option>
                    <option value="Mansilingan Health Station">Mansilingan Health Station</option>
                    <option value="Monte Rey Health Station">Monte Rey Health Station</option>
                    <option value="Pahanocoy Health Station">Pahanocoy Health Station</option>
                    <option value="Puso Health Station">Puso Health Station</option>
                    <option value="San Juan Health Station">San Juan Health Station</option>
                    <option value="Singcang Health Station">Singcang Health Station</option>
                    <option value="Sum-ag Health Station">Sum-ag Health Station</option>
                    <option value="Tangub Health Station">Tangub Health Station</option>
                    <option value="Taculing Health Station">Taculing Health Station</option>
                    <option value="Vista Alegre Health Station">Vista Alegre Health Station</option>
                    <option value="Villamonte Health Station">Villamonte Health Station</option>
                  </select>
                </div>
              </div>

              {/* Section 4: Clinical Information (Print Only) */}
              <div className="space-y-3 sm:space-y-4 print-section">
                <div className="flex items-center gap-2 pb-2 border-b-2 border-teal-200">
                  <div className="bg-teal-100 p-1.5 sm:p-2 rounded-lg">
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-teal-700" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800">Clinical Information</h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Chief Complaint</label>
                    <div className="h-16 sm:h-20 border-b border-slate-300"></div>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Vital Signs</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
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

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Height</label>
                      <div className="h-8 border-b border-slate-300"></div>
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Weight</label>
                      <div className="h-8 border-b border-slate-300"></div>
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Waist</label>
                      <div className="h-8 border-b border-slate-300"></div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">SOAP Notes</label>
                    <div className="h-24 sm:h-32 border-b border-slate-300"></div>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Labs</label>
                    <div className="h-16 sm:h-20 border-b border-slate-300"></div>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Prescriptions</label>
                    <div className="h-16 sm:h-20 border-b border-slate-300"></div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Physician Signature</label>
                      <div className="h-16 border-b border-slate-300"></div>
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Date</label>
                      <div className="h-8 border-b border-slate-300"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 5: Consent */}
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b-2 border-teal-200">
                  <div className="bg-teal-100 p-1.5 sm:p-2 rounded-lg">
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-teal-700" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800">Data Privacy Consent</h3>
                </div>

                <div className="p-3 sm:p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl shadow-sm">
                  <p className="text-xs sm:text-sm text-amber-900 mb-3 leading-relaxed">
                    I hereby consent to the collection, processing, and storage of my personal data 
                    by the City Health Office for the purpose of healthcare service delivery and 
                    patient record management. I understand that my data will be handled in 
                    accordance with the Data Privacy Act of 2012.
                  </p>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <input
                      type="checkbox"
                      name="dataPrivacyConsent"
                      id="dataPrivacyConsent"
                      checked={formData.dataPrivacyConsent}
                      onChange={handleInputChange}
                      required
                      className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 border-2 border-slate-300 rounded focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
                    />
                    <label htmlFor="dataPrivacyConsent" className="text-xs sm:text-sm text-amber-900 font-semibold">
                      I accept the Data Privacy Consent *
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 sm:gap-3 pt-4 border-t border-slate-200 no-print sticky bottom-0 bg-white pb-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 rounded-lg hover:from-slate-200 hover:to-slate-300 transition-all font-medium shadow-sm hover:shadow-md flex items-center justify-center gap-2 text-xs sm:text-sm"
                >
                  <Printer className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Print Form</span>
                  <span className="sm:hidden">Print</span>
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-red-100 to-red-200 text-red-700 rounded-lg hover:from-red-200 hover:to-red-300 transition-all font-medium shadow-sm hover:shadow-md flex items-center justify-center gap-2 text-xs sm:text-sm"
                >
                  <X className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Cancel</span>
                  <span className="sm:hidden">Cancel</span>
                </button>
                <button
                  type="submit"
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-lg hover:from-teal-700 hover:to-teal-800 transition-all font-medium shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-xs sm:text-sm"
                >
                  <Save className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Save Record</span>
                  <span className="sm:hidden">Save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #enrollment-form, #enrollment-form * {
            visibility: visible;
          }
          #enrollment-form {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
        }
        @media (max-width: 640px) {
          #enrollment-form {
            padding: 12px;
          }
        }
      `}</style>
    </>
  )
}