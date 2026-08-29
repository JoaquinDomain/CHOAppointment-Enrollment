'use client'

import { useState } from 'react'
import { Calendar, User, MapPin, AlertTriangle, CheckCircle, FileText, QrCode } from 'lucide-react'
import DatePicker from './DatePicker'
import ServiceSelector from './ServiceSelector'
import EnrollmentModal from './EnrollmentModal'
import { QRCodeCanvas as QRCode } from 'qrcode.react'
import { Appointment } from '../lib/services/appointmentService'

const healthFacilities = [
  'CHO Main / Bacolod City Health Office',
  'Senior Citizen Center',
  'Alijis Health Station',
  'Banago Health Station',
  'Bata Health Station',
  'Bacolod City Mental Care Center',
  'Singcang Health Station',
  'Handumanan Health Station',
  'Pahanocoy Health Station',
  'Villamonte Health Station',
  'Taculing Health Station',
  'Others'
]

const laboratoryTests = [
  { id: 'panel', name: 'Panel (CBC, Platelet, Lipid Profile, FBS, Creatinine, Uric Acid)', requiresFasting: true },
  { id: 'blood-typing', name: 'Blood Typing', requiresFasting: false },
  { id: 'cbc-platelet', name: 'CBC / Platelet Count', requiresFasting: false },
  { id: 'fecal-occult', name: 'Fecal Occult Blood', requiresFasting: false },
  { id: 'stool-exam', name: 'Stool Exam', requiresFasting: false },
  { id: 'urinalysis', name: 'Urinalysis', requiresFasting: false },
  { id: 'dengue', name: 'Dengue NS1 / Dengue Duo', requiresFasting: false },
  { id: 'hbsag', name: 'HBsAg', requiresFasting: false },
  { id: 'pregnancy', name: 'Pregnancy Test', requiresFasting: false },
  { id: 'syphilis', name: 'Syphilis', requiresFasting: false },
  { id: 'sgpt-sgot', name: 'SGPT / SGOT', requiresFasting: false },
  { id: 'bun', name: 'BUN', requiresFasting: false },
  { id: 'creatinine', name: 'Creatinine', requiresFasting: false },
  { id: 'uric-acid', name: 'Uric Acid', requiresFasting: false },
  { id: 'lipid-profile', name: 'Lipid Profile', requiresFasting: true },
  { id: 'fbs', name: 'FBS', requiresFasting: true },
  { id: 'ogtt', name: 'OGTT', requiresFasting: true }
]

const yakapFacilities = [
  'CHO Main',
  'Alijis Health Station',
  'Banago Health Station',
  'Bata Health Station',
  'Singcang Health Station',
  'Handumanan Health Station',
  'Pahanocoy Health Station',
  'Villamonte Health Station',
  'Taculing Health Station'
]

export default function AppointmentForm() {
  const [step, setStep] = useState(1)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [selectedTests, setSelectedTests] = useState<string[]>([])
  const [enrollmentModalOpen, setEnrollmentModalOpen] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [appointmentId, setAppointmentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentBookings, setCurrentBookings] = useState<{ [key: string]: number }>({})

  // Patient Information
  const [patientInfo, setPatientInfo] = useState({
    fullName: '',
    age: '',
    consultingFacility: '',
    yakapRegistered: false,
    yakapFacility: ''
  })

  // Enrollment data
  const [enrollmentData, setEnrollmentData] = useState<any>(null)

  const handleTestToggle = (testId: string) => {
    setSelectedTests(prev => 
      prev.includes(testId) 
        ? prev.filter(id => id !== testId)
        : [...prev, testId]
    )
  }

  const isFastingRequired = () => {
    return selectedTests.some(testId => {
      const test = laboratoryTests.find(t => t.id === testId)
      return test?.requiresFasting
    })
  }

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

  const validateStep2 = () => {
    if (!patientInfo.fullName.trim()) {
      setError('Please enter your full name')
      return false
    }
    if (!patientInfo.age || parseInt(patientInfo.age) <= 0) {
      setError('Please enter a valid age')
      return false
    }
    if (!patientInfo.consultingFacility) {
      setError('Please select a health facility')
      return false
    }
    if (patientInfo.yakapRegistered && !patientInfo.yakapFacility) {
      setError('Please select your YAKAP facility')
      return false
    }
    setError(null)
    return true
  }

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2)
    } else if (step === 2 && validateStep2()) {
      setStep(3)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleSubmit = async () => {
    if (!validateStep2()) return

    setLoading(true)
    setError(null)

    try {
      const appointmentData = {
        full_name: patientInfo.fullName,
        age: parseInt(patientInfo.age),
        consulting_facility: patientInfo.consultingFacility,
        yakap_registered: patientInfo.yakapRegistered,
        yakap_facility: patientInfo.yakapFacility,
        service_type: selectedService!,
        appointment_date: selectedDate!,
        // Include enrollment data if available
        ...(enrollmentData || {})
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
  }

  const resetForm = () => {
    setStep(1)
    setSelectedDate(null)
    setSelectedService(null)
    setSelectedTests([])
    setPatientInfo({
      fullName: '',
      age: '',
      consultingFacility: '',
      yakapRegistered: false,
      yakapFacility: ''
    })
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
          {[1, 2, 3].map((stepNumber) => (
            <div key={stepNumber} className="flex items-center">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center font-semibold
                ${step >= stepNumber ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600'}
              `}>
                {stepNumber}
              </div>
              {stepNumber < 3 && (
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

          {/* Step 2: Patient Information */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-teal-700" />
                <h2 className="text-xl font-semibold text-slate-800">Patient Information</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Full Name *</label>
                  <input
                    type="text"
                    value={patientInfo.fullName}
                    onChange={(e) => setPatientInfo({ ...patientInfo, fullName: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none text-slate-800"
                    placeholder="Enter your full name"
                    style={{ color: '#1e293b' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Age *</label>
                  <input
                    type="number"
                    value={patientInfo.age}
                    onChange={(e) => setPatientInfo({ ...patientInfo, age: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none text-slate-800"
                    placeholder="Enter your age"
                    min="1"
                    style={{ color: '#1e293b' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Health Facility Where Consulted *</label>
                  <select
                    value={patientInfo.consultingFacility}
                    onChange={(e) => setPatientInfo({ ...patientInfo, consultingFacility: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none text-slate-800"
                    style={{ color: '#1e293b' }}
                  >
                    <option value="" className="text-slate-400">Select a facility</option>
                    {healthFacilities.map(facility => (
                      <option key={facility} value={facility} className="text-slate-800">{facility}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">YAKAP Registration Status *</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={!patientInfo.yakapRegistered}
                        onChange={() => setPatientInfo({ ...patientInfo, yakapRegistered: false, yakapFacility: '' })}
                        className="w-4 h-4 text-teal-600 border-slate-300 focus:ring-teal-500"
                      />
                      <span className="text-slate-700">NO</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={patientInfo.yakapRegistered}
                        onChange={() => setPatientInfo({ ...patientInfo, yakapRegistered: true })}
                        className="w-4 h-4 text-teal-600 border-slate-300 focus:ring-teal-500"
                      />
                      <span className="text-slate-700">YES</span>
                    </label>
                  </div>

                  {!patientInfo.yakapRegistered && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">
                        <strong>Note:</strong> YAKAP verification may be done at CHO. Charges or cost may be applied for non-CHO YAKAP registered.
                      </p>
                    </div>
                  )}

                  {patientInfo.yakapRegistered && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-slate-700 mb-2">YAKAP Facility *</label>
                      <select
                        value={patientInfo.yakapFacility}
                        onChange={(e) => setPatientInfo({ ...patientInfo, yakapFacility: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-200 focus:outline-none text-slate-800"
                        style={{ color: '#1e293b' }}
                      >
                        <option value="" className="text-slate-400">Select YAKAP facility</option>
                        {yakapFacilities.map(facility => (
                          <option key={facility} value={facility} className="text-slate-800">{facility}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Enrollment Button */}
              <div className="pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEnrollmentModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                >
                  <FileText className="w-4 h-4" />
                  Fill Up Patient Enrollment Record
                </button>
                {enrollmentData && (
                  <p className="text-sm text-green-600 mt-2">✓ Enrollment record completed</p>
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
                  onClick={handleNext}
                  className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
                >
                  Next Step
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Laboratory Tests */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <QrCode className="w-5 h-5 text-teal-700" />
                <h2 className="text-xl font-semibold text-slate-800">Laboratory Tests</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {laboratoryTests.map(test => (
                  <label key={test.id} className="flex items-start gap-3 p-3 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-teal-300 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedTests.includes(test.id)}
                      onChange={() => handleTestToggle(test.id)}
                      className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500 mt-1"
                    />
                    <span className="text-sm text-slate-700">{test.name}</span>
                  </label>
                ))}
              </div>

              {/* Fasting Warning */}
              {isFastingRequired() && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-900">Fasting Required</p>
                    <p className="text-sm text-amber-800">10–12 Hours Fasting is required prior to your test.</p>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <button
                  onClick={handleBack}
                  className="px-6 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || selectedTests.length === 0}
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
          onClose={() => setEnrollmentModalOpen(false)}
          onSave={handleEnrollmentSave}
          initialData={enrollmentData}
        />
      </div>
    </div>
  )
}