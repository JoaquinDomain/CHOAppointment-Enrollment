'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Filter, Scan, Download, Calendar, MapPin, User, CheckCircle, XCircle, QrCode, LogOut } from 'lucide-react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { Appointment } from '../lib/services/appointmentService'
import SiteQRPoster from './SiteQRPoster'
import { useRouter } from 'next/navigation'

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
    <div className="min-h-screen bg-slate-50">
      {/* Admin Header */}
      <div className="bg-emerald-600 text-white shadow">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
              <p className="text-emerald-200">City Health Office Bacolod</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowQRPoster(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 rounded transition-colors"
              >
                <QrCode className="w-4 h-4" />
                Site QR Poster
              </button>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 rounded transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* QR Scanner Section */}
        {showQRScanner && (
          <div className="mb-6 bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Scan className="w-5 h-5 text-emerald-600" />
                Scan Patient QR Code
              </h2>
              <button
                onClick={stopQRScanner}
                className="p-2 hover:bg-slate-100 rounded transition-colors"
              >
                <XCircle className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            
            <div id="qr-reader" className="mb-4" />
            
            {scannerError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                {scannerError}
              </div>
            )}
          </div>
        )}

        {/* Selected Appointment Detail */}
        {selectedAppointment && (
          <div className="mb-6 bg-white rounded-lg shadow p-6 border-l-4 border-emerald-500">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Patient Found
              </h2>
              <button
                onClick={() => setSelectedAppointment(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5 text-slate-600" />
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
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
              {/* Search */}
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              {/* Facility Filter */}
              <div className="relative w-full md:w-48">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  value={facilityFilter}
                  onChange={(e) => setFacilityFilter(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 appearance-none"
                >
                  <option value="">All Facilities</option>
                  {healthFacilities.map(facility => (
                    <option key={facility} value={facility}>{facility}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 w-full md:w-auto">
              <button
                onClick={startQRScanner}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
              >
                <Scan className="w-4 h-4" />
                Scan QR
              </button>
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 rounded">
                <User className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Appointments</p>
                <p className="text-2xl font-bold text-slate-900">{appointments.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Today's Appointments</p>
                <p className="text-2xl font-bold text-slate-900">
                  {appointments.filter(apt => {
                    const today = new Date().toISOString().split('T')[0]
                    return apt.appointment_date === today
                  }).length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">YAKAP Registered</p>
                <p className="text-2xl font-bold text-slate-900">
                  {appointments.filter(apt => apt.yakap_registered).length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded">
                <MapPin className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Active Facilities</p>
                <p className="text-2xl font-bold text-slate-900">
                  {new Set(appointments.map(apt => apt.consulting_facility)).size}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Appointments Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800">Patient Records</h2>
          </div>
          
          {loading ? (
            <div className="p-12 text-center text-slate-600">Loading appointments...</div>
          ) : filteredAppointments.length === 0 ? (
            <div className="p-12 text-center text-slate-600">
              No appointments found matching your criteria
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Patient Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Age
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Appointment Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[180px]">
                      Facility
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      YAKAP Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[200px]">
                      Service
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Booked / Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {filteredAppointments.map((appointment) => (
                    <tr key={appointment.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-slate-900">
                              {appointment.full_name}
                            </div>
                            <div className="text-xs text-slate-500">
                              ID: {appointment.id?.slice(0, 8)}...
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        {appointment.yakap_registered ? (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                            Yes
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-800 rounded-full">
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