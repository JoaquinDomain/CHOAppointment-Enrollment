'use client'

import { useState, useEffect } from 'react'
import { X, FileText, User, Shield, AlertCircle, MapPin } from 'lucide-react'

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

const emptyEnrollmentData: EnrollmentData = {
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
}

export default function EnrollmentModal({ 
  isOpen, 
  onClose, 
  onSave,
  initialData,
  requireSave = false
}: EnrollmentModalProps) {
  const [formData, setFormData] = useState<EnrollmentData>(emptyEnrollmentData)
  const [printTimestamp, setPrintTimestamp] = useState<string>('')

  // Initialize form data when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      setFormData({ ...emptyEnrollmentData, ...initialData })
    }
  }, [isOpen, initialData])

  // Setup print handler
  useEffect(() => {
    const handleBeforePrint = () => {
      setPrintTimestamp(new Date().toLocaleString('en-US', {
        dateStyle: 'full',
        timeStyle: 'long'
      }))
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

  const calculateAge = (birthdate: string): number => {
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

  const handleBirthdateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const birthdate = e.target.value
    const age = calculateAge(birthdate)
    setFormData(prev => ({
      ...prev,
      birthdate,
      age
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic validation
    if (!formData.dataPrivacyConsent) {
      alert('Please accept the data privacy consent to proceed.')
      return
    }

    onSave(formData)
    onClose()
  }

  const handlePrint = () => {
    window.print()
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-teal-700" />
              <h2 className="text-xl font-semibold text-slate-800">Patient Enrollment Record / ITR</h2>
            </div>
            <button
              onClick={onClose}
              disabled={requireSave && !initialData}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          {/* Printable Form */}
          <div id="enrollment-form" className="p-6">
            {/* Print Header - Only visible when printing */}
            <div className="print-only hidden">
              <div className="text-center mb-4">
                <h1 className="text-2xl font-bold text-slate-900">City Health Office</h1>
                <h2 className="text-lg font-semibold text-slate-700">Patient Enrollment Record / Individual Treatment Record</h2>
                <p className="text-sm text-slate-600 mt-2">Date Printed: {printTimestamp}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Section 1: Demographics */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <User className="w-5 h-5 text-teal-700" />
                  <h3 className="text-lg font-semibold text-slate-800">Patient Demographics</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Last Name *</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-800"
                      style={{ color: '#1e293b' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">First Name *</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-800"
                      style={{ color: '#1e293b' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Middle Name</label>
                    <input
                      type="text"
                      name="middleName"
                      value={formData.middleName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-800"
                      style={{ color: '#1e293b' }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Suffix</label>
                    <select
                      name="suffix"
                      value={formData.suffix}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">Birthdate *</label>
                    <input
                      type="date"
                      name="birthdate"
                      value={formData.birthdate}
                      onChange={handleBirthdateChange}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Age</label>
                    <input
                      type="number"
                      name="age"
                      value={formData.age}
                      readOnly
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Gender *</label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Civil Status</label>
                    <select
                      name="civilStatus"
                      value={formData.civilStatus}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    >
                      <option value="">Select Status</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Widowed">Widowed</option>
                      <option value="Separated">Separated</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Residential Address *</label>
                  <input
                    type="text"
                    name="residentialAddress"
                    value={formData.residentialAddress}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Contact Number *</label>
                    <input
                      type="tel"
                      name="contactNumber"
                      value={formData.contactNumber}
                      onChange={handleInputChange}
                      required
                      placeholder="09XXXXXXXXX"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-800"
                      style={{ color: '#1e293b' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Employment Status</label>
                    <select
                      name="employmentStatus"
                      value={formData.employmentStatus}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    >
                      <option value="">Select Status</option>
                      <option value="Employed">Employed</option>
                      <option value="Self-Employed">Self-Employed</option>
                      <option value="Unemployed">Unemployed</option>
                      <option value="Student">Student</option>
                      <option value="Retired">Retired</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Spouse Name (if applicable)</label>
                    <input
                      type="text"
                      name="spouseName"
                      value={formData.spouseName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Mother's Maiden Name</label>
                    <input
                      type="text"
                      name="mothersMaidenName"
                      value={formData.mothersMaidenName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
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
                    className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                  />
                  <label htmlFor="primaryCareBenefitMember" className="text-sm text-slate-700">
                    Primary Care Benefit Member
                  </label>
                </div>
              </div>

              {/* Section 2: Program & Coverage */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <Shield className="w-5 h-5 text-teal-700" />
                  <h3 className="text-lg font-semibold text-slate-800">Program & Coverage</h3>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="philhealthMember"
                      id="philhealthMember"
                      checked={formData.philhealthMember}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                    />
                    <label htmlFor="philhealthMember" className="text-sm text-slate-700">
                      PhilHealth Member
                    </label>
                  </div>

                  {formData.philhealthMember && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">PhilHealth Number</label>
                        <input
                          type="text"
                          name="philhealthNumber"
                          value={formData.philhealthNumber}
                          onChange={handleInputChange}
                          placeholder="XX-XXXXXXXXX-X"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">PhilHealth Status/Family Member</label>
                        <input
                          type="text"
                          name="philhealthStatus"
                          value={formData.philhealthStatus}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Facility Household Number</label>
                    <input
                      type="text"
                      name="facilityHouseholdNumber"
                      value={formData.facilityHouseholdNumber}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="pwd"
                      id="pwd"
                      checked={formData.pwd}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                    />
                    <label htmlFor="pwd" className="text-sm text-slate-700">
                      Person with Disability (PWD)
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="yakapRegistered"
                      id="yakapRegistered"
                      checked={formData.yakapRegistered}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                    />
                    <label htmlFor="yakapRegistered" className="text-sm text-slate-700">
                      YAKAP Registered
                    </label>
                  </div>

                  {formData.yakapRegistered && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">YAKAP Facility</label>
                      <select
                        name="yakapFacility"
                        value={formData.yakapFacility}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-800"
                        style={{ color: '#1e293b' }}
                      >
                        <option value="">Select YAKAP facility</option>
                        <option value="CHO Main">CHO Main</option>
                        <option value="Alijis Health Station">Alijis Health Station</option>
                        <option value="Banago Health Station">Banago Health Station</option>
                        <option value="Bata Health Station">Bata Health Station</option>
                        <option value="Singcang Health Station">Singcang Health Station</option>
                        <option value="Handumanan Health Station">Handumanan Health Station</option>
                        <option value="Pahanocoy Health Station">Pahanocoy Health Station</option>
                        <option value="Villamonte Health Station">Villamonte Health Station</option>
                        <option value="Taculing Health Station">Taculing Health Station</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Health Facility Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <MapPin className="w-5 h-5 text-teal-700" />
                  <h3 className="text-lg font-semibold text-slate-800">Health Facility Information</h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Health Facility Where Consulted *</label>
                  <select
                    name="consultingFacility"
                    value={formData.consultingFacility}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-800"
                    style={{ color: '#1e293b' }}
                  >
                    <option value="">Select a facility</option>
                    <option value="CHO Main / Bacolod City Health Office">CHO Main / Bacolod City Health Office</option>
                    <option value="Senior Citizen Center">Senior Citizen Center</option>
                    <option value="Alijis Health Station">Alijis Health Station</option>
                    <option value="Banago Health Station">Banago Health Station</option>
                    <option value="Bata Health Station">Bata Health Station</option>
                    <option value="Bacolod City Mental Care Center">Bacolod City Mental Care Center</option>
                    <option value="Singcang Health Station">Singcang Health Station</option>
                    <option value="Handumanan Health Station">Handumanan Health Station</option>
                    <option value="Pahanocoy Health Station">Pahanocoy Health Station</option>
                    <option value="Villamonte Health Station">Villamonte Health Station</option>
                    <option value="Taculing Health Station">Taculing Health Station</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </div>

              {/* Section 3: Clinical Section (for printing) */}
              <div className="space-y-4 print-only-block hidden">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <FileText className="w-5 h-5 text-teal-700" />
                  <h3 className="text-lg font-semibold text-slate-800">Clinical Section</h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Chief Complaint</label>
                    <div className="h-20 border-b border-slate-300"></div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">PR</label>
                      <div className="h-8 border-b border-slate-300"></div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">CR</label>
                      <div className="h-8 border-b border-slate-300"></div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">BP</label>
                      <div className="h-8 border-b border-slate-300"></div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">RR</label>
                      <div className="h-8 border-b border-slate-300"></div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">O₂ Sat</label>
                      <div className="h-8 border-b border-slate-300"></div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Height</label>
                      <div className="h-8 border-b border-slate-300"></div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Weight</label>
                      <div className="h-8 border-b border-slate-300"></div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Waist</label>
                      <div className="h-8 border-b border-slate-300"></div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">SOAP Notes</label>
                    <div className="h-32 border-b border-slate-300"></div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Labs</label>
                    <div className="h-20 border-b border-slate-300"></div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Prescriptions</label>
                    <div className="h-20 border-b border-slate-300"></div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Physician Signature</label>
                      <div className="h-16 border-b border-slate-300"></div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                      <div className="h-8 border-b border-slate-300"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: Consent */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <AlertCircle className="w-5 h-5 text-teal-700" />
                  <h3 className="text-lg font-semibold text-slate-800">Data Privacy Consent</h3>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-900 mb-3">
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
                      className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                    />
                    <label htmlFor="dataPrivacyConsent" className="text-sm text-amber-900 font-medium">
                      I accept the Data Privacy Consent *
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-200 no-print">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                >
                  Print Form
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={requireSave && !initialData}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
                >
                  Save Record
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
          .print-only-block {
            display: block !important;
          }
        }
      `}</style>
    </>
  )
}