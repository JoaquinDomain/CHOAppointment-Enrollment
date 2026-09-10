'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react'
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
      <div className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
        <div className="cho-animate-in mx-auto max-w-2xl">
          <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-2xl shadow-emerald-900/10">
            <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 px-8 pb-6 pt-8 text-center text-white">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30 backdrop-blur">
                <CheckCircle className="h-8 w-8" />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Appointment confirmed</h1>
              <p className="mt-1 text-sm font-medium text-emerald-50">
                Your laboratory schedule has been recorded successfully.
              </p>
            </div>
            <div className="p-6 sm:p-8">
              <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-left">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">
                  What&apos;s next
                </p>
                <p className="mt-1 text-[15px] font-semibold leading-relaxed text-emerald-950">
                  Please proceed to the CHO Lab on your chosen date at 8:00 AM.
                </p>
                <p className="mt-2 text-sm text-emerald-800">
                  Appointment ID:{' '}
                  <span className="rounded-md bg-white px-2 py-0.5 font-mono font-bold text-emerald-950 ring-1 ring-emerald-200">
                    {appointmentId}
                  </span>
                </p>
              </div>

              <div className="mb-4 flex justify-center">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <QRCode
                    value={appointmentId}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div>
              </div>

              <p className="mb-7 text-center text-sm text-slate-500">
                Show this QR code to the staff when you arrive at the health office.
              </p>

              <button
                onClick={resetForm}
                className="w-full rounded-xl bg-emerald-600 px-8 py-3.5 font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all hover:-translate-y-px hover:bg-emerald-700 hover:shadow-xl active:translate-y-0"
              >
                Book another appointment
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl">
        {/* Hero */}
        <div className="cho-animate-in relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-700 p-6 text-white shadow-xl shadow-emerald-900/20 sm:p-9">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-teal-300/20 blur-2xl"
          />
          <div className="relative">
            <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-50 ring-1 ring-white/25">
              <Clock className="h-3.5 w-3.5" />
              City Health Office · Bacolod City
            </p>
            <h1 className="max-w-2xl text-[1.65rem] font-extrabold leading-[1.12] tracking-tight sm:text-4xl">
              BACOLOD CITY HEALTH LABORATORY APPOINTMENT SYSTEM
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-emerald-900 shadow-sm">
                <Clock className="h-3.5 w-3.5 text-emerald-600" />
                Lab opens 8:00 AM
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/30 px-3 py-1.5 text-white ring-1 ring-white/25">
                Mon – Fri only
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/30 px-3 py-1.5 text-white ring-1 ring-white/25">
                QR check-in
              </span>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="cho-animate-in cho-animate-in-1 mb-6 flex justify-center">
          <ol className="flex w-full max-w-xl items-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm sm:gap-3 sm:px-6">
            <li className="flex items-center gap-2">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all ${step >= 1 ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30' : 'bg-slate-200 text-slate-600'}`}>
                1
              </span>
              <span className={`text-sm font-semibold ${step >= 1 ? 'text-slate-900' : 'text-slate-500'}`}>Date & Service</span>
            </li>
            <li aria-hidden className={`h-1 min-w-8 flex-1 rounded-full transition-all sm:min-w-12 ${step >= 2 ? 'bg-emerald-500' : 'bg-slate-200'}`} />
            <li className="flex items-center gap-2">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all ${step >= 2 ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30' : 'bg-slate-200 text-slate-600'}`}>
                2
              </span>
              <span className={`text-sm font-semibold ${step >= 2 ? 'text-slate-900' : 'text-slate-500'}`}>Patient Record</span>
            </li>
          </ol>
        </div>

        {/* Main Form Card */}
        <div className="cho-animate-in cho-animate-in-2 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xl shadow-slate-900/5 sm:p-8">
          {/* Error Message */}
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
              <p className="text-sm font-medium text-red-800">{error}</p>
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

              <div className="flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-medium text-slate-500">
                  Slots refresh per date · weekends closed · bring a valid ID.
                </p>
                <button
                  onClick={handleNext}
                  disabled={!selectedDate || !selectedService}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-7 py-3 font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all hover:-translate-y-px hover:bg-emerald-700 hover:shadow-xl active:translate-y-0 disabled:translate-y-0 disabled:opacity-40 disabled:shadow-none"
                >
                  Continue
                  <span aria-hidden>→</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Patient Enrollment */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 sm:p-5">
                <h3 className="text-sm font-extrabold tracking-tight text-emerald-950">
                  Step 2 — Patient enrollment record
                </h3>
                <p className="mt-0.5 text-xs font-medium leading-relaxed text-emerald-900/80 sm:text-[13px]">
                  Complete the record below. Saving submits your {selectedService ?? 'selected service'} booking for {selectedDate ?? 'your chosen date'}.
                </p>
              </div>
              <EnrollmentModal
                isOpen={true}
                inline={true}
                onClose={handleEnrollmentClose}
                onSave={handleEnrollmentSave}
                initialData={enrollmentData}
                selectedService={selectedService}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
