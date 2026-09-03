'use client'

import { useState, useEffect } from 'react'
import { Calendar, AlertTriangle, CheckCircle, FileText, QrCode } from 'lucide-react'
import DatePicker from './DatePicker'
import ServiceSelector from './ServiceSelector'
import EnrollmentModal from './EnrollmentModal'
import { QRCodeCanvas as QRCode } from 'qrcode.react'

export default function AppointmentForm() {
  const [step, setStep] = useState(1)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [enrollmentModalOpen, setEnrollmentModalOpen] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [appointmentId, setAppointmentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentBookings, setCurrentBookings] = useState<{ [key: string]: number }>({})

  // Enrollment data (single source of truth for patient info)
  const [enrollmentData, setEnrollmentData] = useState<any>(null)

  const validateStep1 = () => {
    if (!selectedDate) {
      setError('Please select an appointment date')
      return false
    }
    if (!selectedService) {
      setError('Please select a service')
      return false
    }
    setError(null)
    return true
  }

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleSubmit = async () => {
    // Check if enrollment data is required before submission
    if (!enrollmentData) {
      setError('Please complete the Patient Enrollment Record first')
      setEnrollmentModalOpen(true)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Map enrollment data to API expected format
      const appointmentData = {
        service_type: selectedService!,
        appointment_date: selectedDate!,
        // Map enrollment data fields to API expected fields
        full_name: `${enrollmentData.firstName} ${enrollmentData.middleName} ${enrollmentData.lastName}`.trim(),
        age: enrollmentData.age,
        birthdate: enrollmentData.birthdate,
        gender: enrollmentData.gender,
        civil_status: enrollmentData.civilStatus,
        residential_address: enrollmentData.residentialAddress,
        contact_number: enrollmentData.contactNumber,
        spouse_name: enrollmentData.spouseName,
        mothers_maiden_name: enrollmentData.mothersMaidenName,
        employment_status: enrollmentData.employmentStatus,
        primary_care_benefit_member: enrollmentData.primaryCareBenefitMember,
        consulting_facility: enrollmentData.consultingFacility,
        yakap_registered: enrollmentData.yakapRegistered,
        yakap_facility: enrollmentData.yakapFacility,
        philhealth_member: enrollmentData.philhealthMember,
        philhealth_number: enrollmentData.philhealthNumber,
        philhealth_status: enrollmentData.philhealthStatus,
        facility_household_number: enrollmentData.facilityHouseholdNumber,
        pwd: enrollmentData.pwd,
        data_privacy_consent: enrollmentData.dataPrivacyConsent,
      }

      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(appointmentData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create appointment')
      }

      const result = await response.json()
      setAppointmentId(result.id || null)
      setShowConfirmation(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create appointment')
    } finally {
      setLoading(false)
    }
  }

  const handleEnrollmentSave = async (data: any) => {
    setEnrollmentData(data)
    await submitAppointmentWithData(data)
  }

  const handleEnrollmentClose = () => {
    setStep(1)
    setError(null)
  }

  const submitAppointmentWithData = async (data: any) => {
    setLoading(true)
    setError(null)

    try {
      const appointmentData = {
        service_type: selectedService!,
        appointment_date: selectedDate!,
        full_name: `${data.firstName} ${data.middleName} ${data.lastName}`.trim(),
        age: data.age,
        birthdate: data.birthdate,
        gender: data.gender,
        civil_status: data.civilStatus,
        residential_address: data.residentialAddress,
        contact_number: data.contactNumber,
        spouse_name: data.spouseName,
        mothers_maiden_name: data.mothersMaidenName,
        employment_status: data.employmentStatus,
        primary_care_benefit_member: data.primaryCareBenefitMember,
        consulting_facility: data.consultingFacility,
        yakap_registered: data.yakapRegistered,
        yakap_facility: data.yakapFacility,
        philhealth_member: data.philhealthMember,
        philhealth_number: data.philhealthNumber,
        philhealth_status: data.philhealthStatus,
        facility_household_number: data.facilityHouseholdNumber,
        pwd: data.pwd,
        data_privacy_consent: data.dataPrivacyConsent,
      }

      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(appointmentData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create appointment')
      }

      const result = await response.json()
      setAppointmentId(result.id || null)
      setShowConfirmation(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create appointment')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setStep(1)
    setSelectedDate(null)
    setSelectedService(null)
    setEnrollmentData(null)
    setShowConfirmation(false)
    setAppointmentId(null)
    setError(null)
  }

  if (showConfirmation && appointmentId) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 sm:p-10 text-center">
            <div className="w-20 h-20 bg-emerald-100/80 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
            
            <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Appointment Confirmed!</h1>
            <p className="text-slate-600 mb-6">Your laboratory schedule has been recorded successfully.</p>
            
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-6 mb-8 text-left">
              <p className="text-lg text-emerald-950 font-semibold mb-2">
                Please proceed to CHO Lab on your date of choice at 8:00 AM
              </p>
              <p className="text-sm text-emerald-800">
                Appointment ID: <span className="font-mono font-bold text-emerald-950">{appointmentId}</span>
              </p>
            </div>

            <div className="flex justify-center mb-6">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <QRCode 
                  value={appointmentId} 
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-8">
              Show this QR code to the staff when you arrive at the health office.
            </p>

            <button
              onClick={resetForm}
              className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all duration-200 font-semibold shadow-md hover:shadow-lg"
            >
              Book Another Appointment
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">
            CHO Laboratory Appointment System
          </h1>
          <p className="text-base text-slate-600 font-medium">City Health Office · Bacolod City</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-10">
          <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-full shadow-sm border border-slate-200/80">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${step >= 1 ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-200 text-slate-600'}`}>
                1
              </div>
              <span className={`text-sm font-semibold ${step >= 1 ? 'text-slate-900' : 'text-slate-500'}`}>Date & Service</span>
            </div>

            <div className={`w-12 h-1 rounded-full transition-all ${step >= 2 ? 'bg-emerald-600' : 'bg-slate-200'}`} />

            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${step >= 2 ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-200 text-slate-600'}`}>
                2
              </div>
              <span className={`text-sm font-semibold ${step >= 2 ? 'text-slate-900' : 'text-slate-500'}`}>Patient Record</span>
            </div>
          </div>
        </div>

        {/* Main Form Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-6 sm:p-8">
          {/* Error Message */}
          {error && (
            <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Step 1: Date and Service Selection */}
          {step === 1 && (
            <div className="space-y-8">
              <DatePicker 
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
              />
              
              <ServiceSelector 
                selectedService={selectedService}
                onServiceSelect={setSelectedService}
                selectedDate={selectedDate}
                currentBookings={currentBookings}
              />

              <div className="flex justify-end">
                <button
                  onClick={handleNext}
                  disabled={!selectedDate || !selectedService}
                  className="px-6 py-3 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next Step
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Patient Enrollment */}
          {step === 2 && (
            <div className="space-y-6">
              <EnrollmentModal
                isOpen={true}
                inline={true}
                onClose={handleEnrollmentClose}
                onSave={handleEnrollmentSave}
                initialData={enrollmentData}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}