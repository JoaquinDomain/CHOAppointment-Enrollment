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
  requireSave?: boolean
  inline?: boolean
}

const ClinicalInformationSection = () => (
  <div className="space-y-2 sm:space-y-3">
    {/* Chief Complaint */}
    <div>
      <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Chief Complaint</label>
      <div className="h-12 sm:h-14 border-b border-slate-300"></div>
    </div>

    {/* Vital Signs */}
    <div>
      <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Vital Signs</label>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 sm:gap-2">
        <div>
          <label className="block text-xs text-slate-600 mb-1">PR</label>
          <div className="h-7 border-b border-slate-300"></div>
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">CR</label>
          <div className="h-7 border-b border-slate-300"></div>
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">BP</label>
          <div className="h-7 border-b border-slate-300"></div>
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">RR</label>
          <div className="h-7 border-b border-slate-300"></div>
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">O₂ Sat</label>
          <div className="h-7 border-b border-slate-300"></div>
        </div>
      </div>
    </div>

    {/* Height, Weight, Waist */}
    <div className="grid grid-cols-3 gap-1 sm:gap-2">
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Ht</label>
        <div className="h-7 border-b border-slate-300"></div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Wt</label>
        <div className="h-7 border-b border-slate-300"></div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Waist</label>
        <div className="h-7 border-b border-slate-300"></div>
      </div>
    </div>

    {/* SOAP Notes */}
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">SOAP Notes</label>
      <div className="h-14 sm:h-16 border-b border-slate-300"></div>
    </div>

    {/* Labs & Prescriptions */}
    <div className="grid grid-cols-2 gap-1 sm:gap-2">
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Labs</label>
        <div className="h-12 sm:h-14 border-b border-slate-300"></div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Prescriptions</label>
        <div className="h-12 sm:h-14 border-b border-slate-300"></div>
      </div>
    </div>

    {/* Physician Signature & Date */}
    <div className="grid grid-cols-2 gap-1 sm:gap-2">
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Physician Sig</label>
        <div className="h-10 border-b border-slate-300"></div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
        <div className="h-7 border-b border-slate-300"></div>
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
  inline = false
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
        <div className="print-only hidden">
          <div className="text-center mb-3">
            <h1 className="text-xl font-bold text-slate-900">City Health Office</h1>
            <h2 className="text-sm font-semibold text-slate-700">Patient Enrollment Record / Individual Treatment Record</h2>
            <p className="text-xs text-slate-600 mt-1">Date Printed: {printTimestamp}</p>
          </div>
        </div>

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

            <div>
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

          {/* Section 2: Program & Coverage - Condensed */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
              <Shield className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-semibold text-slate-800">Program & Coverage</h3>
            </div>
            <div className="flex gap-3 text-xs">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  name="philhealthMember"
                  checked={formData.philhealthMember}
                  onChange={handleInputChange}
                  className="w-3 h-3"
                />
                PhilHealth
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  name="pwd"
                  checked={formData.pwd}
                  onChange={handleInputChange}
                  className="w-3 h-3"
                />
                PWD
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  name="yakapRegistered"
                  checked={formData.yakapRegistered}
                  onChange={handleInputChange}
                  className="w-3 h-3"
                />
                YAKAP
              </label>
            </div>
          </div>

          {/* Section 3: Health Facility Information */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-semibold text-slate-800">Health Facility</h3>
            </div>
            <select
              name="consultingFacility"
              value={formData.consultingFacility}
              onChange={handleInputChange}
              required
              className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
            >
              <option value="">Select Facility</option>
              <option value="City Health Office">City Health Office</option>
              <option value="Alangilan Health Station">Alangilan Health Station</option>
            </select>
          </div>

          {/* Section 4: Data Privacy Consent */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
              <AlertCircle className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-semibold text-slate-800">Section II: Data Privacy Consent</h3>
            </div>
            <div className="flex items-center gap-2">
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
            {/* Signature Section */}
            <div className="signature-row-compact">
              <div className="signature-col-compact">
                <div className="signature-line-compact"></div>
                <div className="signature-label-compact">Patient Sig / Date</div>
              </div>
              <div className="signature-col-compact">
                <div className="signature-line-compact"></div>
                <div className="signature-label-compact">CHO/BHS Rep Sig / Date</div>
              </div>
            </div>
          </div>

          {/* Section 5: Clinical Information - Instance 1 */}
          <div className="space-y-2 pt-2 border-t border-slate-300">
            <h3 className="text-xs font-semibold text-slate-800">Clinical Information (Instance 1)</h3>
            <ClinicalInformationSection />
          </div>

          {/* Divider Line */}
          <div className="border-t-2 border-dashed border-slate-400 my-2"></div>

          {/* Section 6: Clinical Information - Instance 2 */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-800">Clinical Information (Instance 2)</h3>
            <ClinicalInformationSection />
          </div>

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
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 8mm;
          }
          
          body {
            background: #fff !important;
            color: #000 !important;
            font-size: 9pt;
          }
          
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
            padding: 12px;
          }
          
          .no-print {
            display: none !important;
          }
          
          .print-only {
            display: block !important;
          }
          
          input, select, textarea {
            border: none !important;
            border-bottom: 1px solid #000 !important;
            border-radius: 0 !important;
            background: transparent !important;
            padding: 1px 0 !important;
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
          
          .border-slate-200, .border-slate-300 {
            border-color: #000 !important;
          }
          
          .text-slate-600, .text-slate-700, .text-slate-800, .text-slate-900 {
            color: #000 !important;
          }
          
          .bg-slate-100, .bg-amber-50 {
            background: transparent !important;
          }
          
          .space-y-2, .space-y-3, .space-y-4, .space-y-6 {
            gap: 0.25rem !important;
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
