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

  // Automatically open enrollment modal when reaching step 2
  useEffect(() => {
    if (step === 2 && !enrollmentData) {
      setEnrollmentModalOpen(true)
    }
  }, [step, enrollmentData])

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
      const appointmentData = {
        service_type: selectedService!,
        appointment_date: selectedDate!,
        // Include all enrollment data
        ...enrollmentData
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

  const handleEnrollmentSave = (data: any) => {
    setEnrollmentData(data)
    setEnrollmentModalOpen(false)
  }

  const handleEnrollmentClose = () => {
    // Only allow closing if enrollment data is saved
    if (enrollmentData) {
      setEnrollmentModalOpen(false)
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
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 py-12 px-4 pt-20">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-teal-600" />
            </div>
            
            <h1 className="text-3xl font-bold text-slate-900 mb-4">Appointment Confirmed!</h1>
            
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-6 mb-6">
              <p className="text-lg text-teal-900 font-medium mb-2">
                Please proceed to CHO Lab on your date of choice at 8:00 AM
              </p>
              <p className="text-sm text-teal-700">
                Appointment ID: <span className="font-mono font-bold">{appointmentId}</span>
              </p>
            </div>

            <div className="flex justify-center mb-6">
              <div className="bg-white p-4 rounded-lg border-2 border-slate-200">
                <QRCode 
                  value={appointmentId} 
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-6">
              Show this QR code to the staff when you arrive at the health office
            </p>

            <button
              onClick={resetForm}
              className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
            >
              Book Another Appointment
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 py-12 px-4 pt-20">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">CHO Laboratory Appointment</h1>
          <p className="text-slate-600">City Health Office Bacolod</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2].map((stepNumber) => (
            <div key={stepNumber} className="flex items-center">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center font-semibold
                ${step >= stepNumber ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600'}
              `}>
                {stepNumber}
              </div>
              {stepNumber < 2 && (
                <div className={`w-16 h-1 mx-2 ${step > stepNumber ? 'bg-teal-600' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Main Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Error Message */}
          {error && (
            <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
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
                  className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next Step
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Patient Enrollment */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-teal-700" />
                <h2 className="text-xl font-semibold text-slate-800">Patient Information</h2>
              </div>

              {/* Enrollment Status */}
              <div className="flex flex-col items-center justify-center py-8">
                {enrollmentData ? (
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Enrollment Record Completed</h3>
                    <p className="text-slate-600 mb-4">Your patient information has been saved.</p>
                    <button
                      type="button"
                      onClick={() => setEnrollmentModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition-colors font-medium"
                    >
                      <FileText className="w-4 h-4" />
                      Edit Patient Enrollment Record
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-teal-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Patient Enrollment Record</h3>
                    <p className="text-slate-600 mb-4">Please complete your patient information to proceed.</p>
                    <p className="text-sm text-teal-600">The enrollment form will open automatically</p>
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={handleBack}
                  className="px-6 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !enrollmentData}
                  className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Submitting...' : 'Submit Appointment'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Enrollment Modal */}
        <EnrollmentModal
          isOpen={enrollmentModalOpen}
          onClose={handleEnrollmentClose}
          onSave={handleEnrollmentSave}
          initialData={enrollmentData}
          requireSave={step === 2 && !enrollmentData}
        />
      </div>
    </div>
  )
}