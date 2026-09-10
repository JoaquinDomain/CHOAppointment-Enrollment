'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Filter, Scan, Download, Calendar, MapPin, User, CheckCircle, XCircle, QrCode, LogOut } from 'lucide-react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { Appointment } from '../lib/services/appointmentService'
import SiteQRPoster from './SiteQRPoster'
import { useRouter } from 'next/navigation'
import { BACOLOD_HEALTH_FACILITIES } from '@/constants/facilities'

export default function AdminDashboard() {
  const router = useRouter()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [facilityFilter, setFacilityFilter] = useState('')
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [showQRScanner, setShowQRScanner] = useState(false)
  const [showQRPoster, setShowQRPoster] = useState(false)
  const [scannerError, setScannerError] = useState<string | null>(null)
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)

  const healthFacilities = BACOLOD_HEALTH_FACILITIES

  // Load appointments on component mount
  useEffect(() => {
    loadAppointments()
  }, [])

  // Filter appointments based on search and facility filter
  useEffect(() => {
    let filtered = appointments

    if (searchTerm) {
      filtered = filtered.filter(apt => 
        apt.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        apt.id?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (facilityFilter) {
      filtered = filtered.filter(apt => apt.consulting_facility === facilityFilter)
    }

    setFilteredAppointments(filtered)
  }, [appointments, searchTerm, facilityFilter])

  const loadAppointments = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/appointments')
      if (!response.ok) throw new Error('Failed to fetch appointments')
      const data = await response.json()
      setAppointments(data)
    } catch (error) {
      console.error('Failed to load appointments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleQRScan = async (decodedText: string) => {
    try {
      // Find appointment by ID from the loaded appointments
      const appointment = appointments.find(apt => apt.id === decodedText)
      if (appointment) {
        setSelectedAppointment(appointment)
        setShowQRScanner(false)
        setScannerError(null)
      } else {
        setScannerError('Appointment not found with this QR code')
      }
    } catch (error) {
      setScannerError('Failed to lookup appointment')
    }
  }

  const startQRScanner = () => {
    setShowQRScanner(true)
    setScannerError(null)
  }

  const stopQRScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear()
      scannerRef.current = null
    }
    setShowQRScanner(false)
    setScannerError(null)
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
      router.push('/admin/login')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  useEffect(() => {
    if (showQRScanner && !scannerRef.current) {
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      )
      
      scanner.render(
        (decodedText) => {
          handleQRScan(decodedText)
          stopQRScanner()
        },
        (error) => {
          // Ignore scan errors (continuous scanning)
        }
      )
      
      scannerRef.current = scanner
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear()
        scannerRef.current = null
      }
    }
  }, [showQRScanner])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const exportToCSV = () => {
    const headers = ['ID', 'Patient Name', 'Age', 'Appointment Date', 'Facility', 'YAKAP Registered', 'Service Type', 'Created At']
    const rows = filteredAppointments.map(apt => [
      apt.id,
      apt.full_name,
      apt.age,
      apt.appointment_date,
      apt.consulting_facility,
      apt.yakap_registered ? 'Yes' : 'No',
      apt.service_type,
      apt.created_at
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `appointments-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen">
      {/* Admin Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-700 text-white shadow-lg shadow-emerald-900/20">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-white/10 blur-2xl"
        />
        <div className="relative mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-50 ring-1 ring-white/25">
                CHO Bacolod · Operations
              </p>
              <h1 className="text-2xl font-extrabold tracking-tight">Admin dashboard</h1>
              <p className="text-sm font-medium text-emerald-100">Monitor bookings, verify patients, and manage daily flow.</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => setShowQRPoster(true)}
                className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-emerald-900 shadow-md transition-all hover:-translate-y-px hover:shadow-lg"
              >
                <QrCode className="h-4 w-4" />
                Site QR poster
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-xl bg-emerald-950/30 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/25 transition-all hover:bg-emerald-950/45"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* QR Scanner Section */}
        {showQRScanner && (
          <div className="cho-animate-in mb-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-slate-900">
                <span className="cho-section-icon">
                  <Scan className="h-4 w-4" />
                </span>
                Scan patient QR code
              </h2>
              <button
                onClick={stopQRScanner}
                className="rounded-xl p-2 transition-colors hover:bg-slate-100"
                aria-label="Close scanner"
              >
                <XCircle className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div id="qr-reader" className="overflow-hidden rounded-xl" />

            {scannerError && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
                {scannerError}
              </div>
            )}
          </div>
        )}

        {/* Selected Appointment Detail */}
        {selectedAppointment && (
          <div className="cho-animate-in mb-6 rounded-2xl border border-emerald-200 bg-white p-5 shadow-md shadow-emerald-900/5 ring-1 ring-emerald-100 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-slate-900">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                Patient found
              </h2>
              <button
                onClick={() => setSelectedAppointment(null)}
                className="rounded-xl p-2 transition-colors hover:bg-slate-100"
                aria-label="Dismiss patient details"
              >
                <XCircle className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-600">Patient Name</p>
                <p className="font-semibold text-slate-900">{selectedAppointment.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Age</p>
                <p className="font-semibold text-slate-900">{selectedAppointment.age}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Appointment Date</p>
                <p className="font-semibold text-slate-900">{formatDate(selectedAppointment.appointment_date)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Facility</p>
                <p className="font-semibold text-slate-900">{selectedAppointment.consulting_facility}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Service</p>
                <p className="font-semibold text-slate-900">{selectedAppointment.service_type}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">YAKAP Registered</p>
                <p className="font-semibold text-slate-900">
                  {selectedAppointment.yakap_registered ? 'Yes' : 'No'}
                </p>
              </div>
              {selectedAppointment.contact_number && (
                <div>
                  <p className="text-sm text-slate-600">Contact Number</p>
                  <p className="font-semibold text-slate-900">{selectedAppointment.contact_number}</p>
                </div>
              )}
              {selectedAppointment.residential_address && (
                <div>
                  <p className="text-sm text-slate-600">Address</p>
                  <p className="font-semibold text-slate-900">{selectedAppointment.residential_address}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="cho-animate-in mb-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Search */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="cho-input !pl-10"
                />
              </div>

              {/* Facility Filter */}
              <div className="relative w-full sm:w-60">
                <Filter className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={facilityFilter}
                  onChange={(e) => setFacilityFilter(e.target.value)}
                  className="cho-select !pl-10 appearance-none pr-9"
                >
                  <option value="">All facilities</option>
                  {healthFacilities.map(facility => (
                    <option key={facility} value={facility}>{facility}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={startQRScanner}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/25 transition-all hover:-translate-y-px hover:bg-emerald-700 sm:flex-none"
              >
                <Scan className="h-4 w-4" />
                Scan QR
              </button>
              <button
                onClick={exportToCSV}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-slate-300 hover:bg-slate-50 sm:flex-none"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-100 p-3 ring-1 ring-emerald-200/60">
                <User className="h-6 w-6 text-emerald-700" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total appointments</p>
                <p className="text-2xl font-extrabold tracking-tight text-slate-900">{appointments.length}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-100 p-3 ring-1 ring-blue-200/60">
                <Calendar className="h-6 w-6 text-blue-700" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Today&apos;s appointments</p>
                <p className="text-2xl font-extrabold tracking-tight text-slate-900">
                  {appointments.filter(apt => {
                    const today = new Date().toISOString().split('T')[0]
                    return apt.appointment_date === today
                  }).length}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-green-100 p-3 ring-1 ring-green-200/60">
                <CheckCircle className="h-6 w-6 text-green-700" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">YAKAP registered</p>
                <p className="text-2xl font-extrabold tracking-tight text-slate-900">
                  {appointments.filter(apt => apt.yakap_registered).length}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-purple-100 p-3 ring-1 ring-purple-200/60">
                <MapPin className="h-6 w-6 text-purple-700" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Active facilities</p>
                <p className="text-2xl font-extrabold tracking-tight text-slate-900">
                  {new Set(appointments.map(apt => apt.consulting_facility)).size}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Appointments Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-slate-200/80 bg-slate-50/60 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <h2 className="text-base font-extrabold tracking-tight text-slate-900">Patient records</h2>
            <p className="text-xs font-semibold text-slate-500">{filteredAppointments.length} shown</p>
          </div>
          
          {loading ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" aria-hidden />
              <p className="text-sm font-semibold text-slate-600">Loading appointments…</p>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-bold text-slate-800">No appointments found</p>
              <p className="mt-1 text-xs font-medium text-slate-500">Try a different name, ID, or facility filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200/80">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="whitespace-nowrap px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      Patient
                    </th>
                    <th className="whitespace-nowrap px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      Age
                    </th>
                    <th className="whitespace-nowrap px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      Date
                    </th>
                    <th className="min-w-[180px] px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      Facility
                    </th>
                    <th className="whitespace-nowrap px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      YAKAP
                    </th>
                    <th className="min-w-[200px] px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      Service
                    </th>
                    <th className="whitespace-nowrap px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      Booked
                    </th>
                    <th className="whitespace-nowrap px-6 py-3.5 text-right text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredAppointments.map((appointment) => (
                    <tr key={appointment.id} className="transition-colors hover:bg-emerald-50/50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 ring-1 ring-emerald-200/60">
                            <User className="h-5 w-5 text-emerald-700" />
                          </div>
                          <div className="ml-3.5">
                            <div className="text-sm font-bold tracking-tight text-slate-900">
                              {appointment.full_name}
                            </div>
                            <div className="font-mono text-[11px] font-medium text-slate-400">
                              {appointment.id?.slice(0, 8)}…
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {appointment.age}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {formatDate(appointment.appointment_date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900 min-w-[180px] break-words">
                        {appointment.consulting_facility}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {appointment.yakap_registered ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                            No
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900 min-w-[200px] break-words">
                        {appointment.service_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {formatDateTime(appointment.created_at || '')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => setSelectedAppointment(appointment)}
                          className="text-emerald-600 hover:text-emerald-800 font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* QR Poster Modal */}
      {showQRPoster && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800">Site Access QR Poster</h2>
              <button
                onClick={() => setShowQRPoster(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="p-6">
              <SiteQRPoster printable={false} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}