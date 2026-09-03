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
          <div className="text-center mb-4">
            <h1 className="text-2xl font-bold text-slate-900">City Health Office</h1>
            <h2 className="text-lg font-semibold text-slate-700">Patient Enrollment Record / Individual Treatment Record</h2>
            <p className="text-sm text-slate-600 mt-2">Date Printed: {printTimestamp}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Section 1: Patient Demographics */}
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
              <h3 className="text-base sm:text-lg font-semibold text-slate-800">Patient Demographics</h3>
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
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm sm:text-base"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm sm:text-base"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Middle Name</label>
                <input
                  type="text"
                  name="middleName"
                  value={formData.middleName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm sm:text-base"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm sm:text-base"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm sm:text-base"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-slate-100 text-slate-600 text-sm sm:text-base"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Gender *</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm sm:text-base"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm sm:text-base"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm sm:text-base"
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
                className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm sm:text-base"
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
                className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm sm:text-base"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm sm:text-base"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Mother's Maiden Name</label>
                <input
                  type="text"
                  name="mothersMaidenName"
                  value={formData.mothersMaidenName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm sm:text-base"
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
                className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
              />
              <label htmlFor="primaryCareBenefitMember" className="text-xs sm:text-sm text-slate-700">
                Primary Care Benefit Member
              </label>
            </div>
          </div>

          {/* Section 2: Program & Coverage */}
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
              <h3 className="text-base sm:text-lg font-semibold text-slate-800">Program & Coverage</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="philhealthMember"
                  id="philhealthMember"
                  checked={formData.philhealthMember}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                />
                <label htmlFor="philhealthMember" className="text-xs sm:text-sm text-slate-700">
                  PhilHealth Member
                </label>
              </div>

              {formData.philhealthMember && (
                <div className="space-y-3 pl-4 sm:pl-6 border-l-2 border-emerald-200">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">PhilHealth Number</label>
                    <input
                      type="text"
                      name="philhealthNumber"
                      value={formData.philhealthNumber}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm sm:text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">PhilHealth Status / Family Member</label>
                    <input
                      type="text"
                      name="philhealthStatus"
                      value={formData.philhealthStatus}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm sm:text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Facility Household Number</label>
                    <input
                      type="text"
                      name="facilityHouseholdNumber"
                      value={formData.facilityHouseholdNumber}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm sm:text-base"
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
                  className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
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
                  className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                />
                <label htmlFor="yakapRegistered" className="text-xs sm:text-sm text-slate-700">
                  YAKAP Registered
                </label>
              </div>

              {formData.yakapRegistered && (
                <div className="pl-4 sm:pl-6 border-l-2 border-emerald-200">
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">YAKAP Facility</label>
                  <select
                    name="yakapFacility"
                    value={formData.yakapFacility}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm sm:text-base"
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
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
              <h3 className="text-base sm:text-lg font-semibold text-slate-800">Health Facility Information</h3>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Health Facility Where Consulted *</label>
              <select
                name="consultingFacility"
                value={formData.consultingFacility}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm sm:text-base"
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

          {/* Section 4: Data Privacy Consent */}
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
              <h3 className="text-base sm:text-lg font-semibold text-slate-800">Section II: Data Privacy Consent</h3>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded">
              <p className="text-xs sm:text-sm text-amber-900 mb-3">
                I hereby consent to the collection, processing, and storage of my personal data 
                by the City Health Office for the purpose of healthcare service delivery and 
                patient record management. I understand that my data will be handled in 
                accordance with the Data Privacy Act of 2012.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="dataPrivacyConsent"
                  id="dataPrivacyConsent"
                  checked={formData.dataPrivacyConsent}
                  onChange={handleInputChange}
                  required
                  className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                />
                <label htmlFor="dataPrivacyConsent" className="text-xs sm:text-sm text-amber-900 font-medium">
                  I accept the Data Privacy Consent *
                </label>
              </div>
            </div>

            {/* Signature Section */}
            <div className="signature-row">
              {/* Left Block: Patient */}
              <div className="signature-col">
                <div className="signature-line"></div>
                <div className="signature-label-main">Signature or Name of Patient / Date</div>
                <div className="signature-label-sub">(Lagda o Pangalan ng Pasyente / Petsa)</div>
              </div>

              {/* Right Block: Representative */}
              <div className="signature-col">
                <div className="signature-line"></div>
                <div className="signature-label-main">Name and Signature of CHO/BHS Representative</div>
                <div className="signature-label-sub">(Pangalan at Lagda ng Kinatawan ng CHO/BHS)</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-200 no-print">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition-colors font-medium text-sm sm:text-base"
            >
              Print Form
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition-colors font-medium text-sm sm:text-base"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors font-medium text-sm sm:text-base"
            >
              Save Record
            </button>
          </div>
        </form>
      </div>

      <style jsx global>{`
        .signature-row {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          margin-top: 25px;
        }
        .signature-col {
          width: 48%;
          text-align: center;
        }
        .signature-line {
          border-bottom: 1.5px solid #000;
          margin-bottom: 4px;
        }
        .signature-label-main {
          font-size: 9.5pt;
          font-weight: 600;
          color: #0f172a;
        }
        .signature-label-sub {
          font-size: 8.5pt;
          font-style: italic;
          color: #475569;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 10mm;
          }
          
          body {
            background: #fff !important;
            color: #000 !important;
            font-size: 10pt;
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
            padding: 20px;
          }
          
          .no-print {
            display: none !important;
          }
          
          .print-only {
            display: block !important;
          }
          
          /* Remove boxed input styling and replace with underline fields */
          input, select, textarea {
            border: none !important;
            border-bottom: 1px dashed #444 !important;
            border-radius: 0 !important;
            background: transparent !important;
            padding: 2px 0 !important;
            box-shadow: none !important;
            outline: none !important;
            -webkit-appearance: none !important;
            -moz-appearance: none !important;
            appearance: none !important;
          }
          
          /* Fix select dropdown arrows */
          select {
            background-image: none !important;
          }
          
          /* Hide checkboxes in print mode */
          input[type="checkbox"] {
            display: none !important;
          }
          
          /* Add better spacing for print */
          .space-y-3, .space-y-4, .space-y-6 {
            gap: 0.5rem !important;
          }
          
          /* Make borders darker for print */
          .border-slate-200, .border-slate-300 {
            border-color: #000 !important;
          }
          
          /* Ensure text is black for print */
          .text-slate-600, .text-slate-700, .text-slate-800, .text-slate-900 {
            color: #000 !important;
          }
          
          /* Remove background colors */
          .bg-amber-50, .bg-emerald-50, .bg-teal-50, .bg-slate-100 {
            background: transparent !important;
          }
          
          /* Remove colored backgrounds and borders */
          .bg-amber-50, .border-amber-200 {
            background: transparent !important;
            border: none !important;
          }
          
          .text-amber-900, .text-emerald-900, .text-teal-900 {
            color: #000 !important;
          }

          .consent-box {
            border: 1.5px solid #000;
            padding: 10px;
            margin-top: 10px;
          }
          .consent-text {
            font-size: 8.5pt;
            line-height: 1.25;
            margin-bottom: 20px;
          }
          .signature-row {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            margin-top: 25px;
          }
          .signature-col {
            width: 48%;
            text-align: center;
          }
          .signature-line {
            border-bottom: 1.5px solid #000;
            margin-bottom: 4px;
          }
          .signature-label-main {
            font-size: 9.5pt;
            font-weight: 600;
          }
          .signature-label-sub {
            font-size: 8.5pt;
            font-style: italic;
          }
        }
        
        @media (max-width: 640px) {
          #enrollment-form {
            padding: 12px;
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
