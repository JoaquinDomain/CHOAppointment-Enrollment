'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Download,
  Filter,
  LogOut,
  MapPin,
  Printer,
  QrCode,
  Scan,
  Search,
  User,
  XCircle,
} from 'lucide-react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import type {
  AdminAppointment,
  AdminAppointmentDetail,
  AppointmentStatus,
} from '@/types/appointment'
import SiteQRPoster from './SiteQRPoster'
import { useRouter } from 'next/navigation'
import { BACOLOD_HEALTH_FACILITIES } from '@/constants/facilities'
import { buildCsvDocument } from '@/lib/csv'

interface AdminDashboardProps {
  adminUsername: string
  adminRole: 'admin' | 'superadmin'
}

const STATUS_OPTIONS: AppointmentStatus[] = [
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
]

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No show',
}

const STATUS_BADGES: Record<AppointmentStatus, string> = {
  scheduled: 'bg-slate-100 text-slate-700 ring-slate-200',
  confirmed: 'bg-blue-100 text-blue-800 ring-blue-200',
  completed: 'bg-green-100 text-green-800 ring-green-200',
  cancelled: 'bg-red-100 text-red-800 ring-red-200',
  no_show: 'bg-amber-100 text-amber-800 ring-amber-200',
}

function readCookieValue(name: string): string | null {
  const prefix = `${name}=`
  const row = document.cookie.split('; ').find(item => item.startsWith(prefix))
  return row ? decodeURIComponent(row.slice(prefix.length)) : null
}

function getCsrfToken(): string | null {
  return readCookieValue('__Host-cho_csrf') ?? readCookieValue('cho_csrf')
}

function formatDate(dateString: string): string {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(dateString: string): string {
  if (!dateString) return '—'
  const parsed = new Date(`${dateString.replace(' ', 'T')}Z`)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function manilaToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export default function AdminDashboard({ adminUsername, adminRole }: AdminDashboardProps) {
  const router = useRouter()
  const [appointments, setAppointments] = useState<AdminAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [facilityFilter, setFacilityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | AppointmentStatus>('')
  const [selectedAppointment, setSelectedAppointment] = useState<AdminAppointmentDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showQRScanner, setShowQRScanner] = useState(false)
  const [showQRPoster, setShowQRPoster] = useState(false)
  const [scannerError, setScannerError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  const scanLockRef = useRef(false)

  const healthFacilities = BACOLOD_HEALTH_FACILITIES

  const adminFetch = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const headers = new Headers(init.headers)
      const method = (init.method ?? 'GET').toUpperCase()
      if (method !== 'GET' && method !== 'HEAD') {
        const csrfToken = getCsrfToken()
        if (csrfToken) headers.set('x-csrf-token', csrfToken)
      }
      const response = await fetch(input, {
        ...init,
        headers,
        credentials: 'same-origin',
      })
      if (response.status === 401) {
        router.replace('/admin/login')
      }
      return response
    },
    [router]
  )

  useEffect(() => {
    const controller = new AbortController()

    const loadAppointments = async () => {
      try {
        const response = await adminFetch('/api/appointments?limit=1000', {
          signal: controller.signal,
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error || 'Failed to fetch appointments')
        }
        const data = (await response.json()) as AdminAppointment[]
        setAppointments(Array.isArray(data) ? data : [])
        setActionError(null)
      } catch (error) {
        if (controller.signal.aborted) return
        setActionError(error instanceof Error ? error.message : 'Failed to load appointments')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadAppointments()

    return () => controller.abort()
  }, [adminFetch])

  const filteredAppointments = appointments.filter(appointment => {
    const term = searchTerm.trim().toLowerCase()
    const matchesSearch =
      !term ||
      appointment.full_name.toLowerCase().includes(term) ||
      appointment.public_id.toLowerCase().includes(term) ||
      appointment.id.includes(term)
    const matchesFacility =
      !facilityFilter || appointment.consulting_facility === facilityFilter
    const matchesStatus = !statusFilter || appointment.status === statusFilter
    return matchesSearch && matchesFacility && matchesStatus
  })

  const viewDetails = async (id: string) => {
    setDetailLoading(true)
    setActionError(null)
    try {
      const response = await adminFetch(`/api/admin/appointments/${id}`)
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load appointment details')
      }
      setSelectedAppointment(payload.appointment)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to load appointment details')
    } finally {
      setDetailLoading(false)
    }
  }

  const stopQRScanner = useCallback(() => {
    if (scannerRef.current) {
      try {
        void scannerRef.current.clear()
      } catch {
        // Scanner already stopped.
      }
      scannerRef.current = null
    }
    scanLockRef.current = false
    setShowQRScanner(false)
    setScannerError(null)
  }, [])

  const handleQRScan = useCallback(
    async (decodedText: string) => {
      if (scanLockRef.current) return
      scanLockRef.current = true
      setScannerError(null)
      try {
        const response = await adminFetch('/api/admin/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: decodedText }),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error || 'Appointment not found for this QR code')
        }
        setSelectedAppointment(payload.appointment)
        stopQRScanner()
      } catch (error) {
        setScannerError(error instanceof Error ? error.message : 'Failed to validate QR code')
        scanLockRef.current = false
      }
    },
    [adminFetch, stopQRScanner]
  )

  useEffect(() => {
    if (!showQRScanner || scannerRef.current) return

    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    )

    scanner.render(
      decodedText => {
        void handleQRScan(decodedText)
      },
      () => {
        // Ignore continuous scan errors.
      }
    )

    scannerRef.current = scanner

    return () => {
      if (scannerRef.current) {
        try {
          void scannerRef.current.clear()
        } catch {
          // Scanner already stopped.
        }
        scannerRef.current = null
      }
    }
  }, [showQRScanner, handleQRScan])

  const startQRScanner = () => {
    scanLockRef.current = false
    setShowQRScanner(true)
    setScannerError(null)
  }

  const handleStatusChange = async (status: AppointmentStatus) => {
    if (!selectedAppointment || actionLoading) return
    setActionLoading(true)
    setActionError(null)
    try {
      const response = await adminFetch(`/api/admin/appointments/${selectedAppointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to update appointment status')
      }
      const updated = payload.appointment as AdminAppointmentDetail
      setSelectedAppointment(updated)
      setAppointments(previous =>
        previous.map(appointment => (appointment.id === updated.id ? updated : appointment))
      )
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Failed to update appointment status'
      )
    } finally {
      setActionLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      const csrfToken = getCsrfToken()
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: csrfToken ? { 'x-csrf-token': csrfToken } : undefined,
      })
    } catch {
      // Redirect regardless; the cookie is cleared by the server response when possible.
    } finally {
      router.replace('/admin/login')
      router.refresh()
    }
  }

  const exportToCSV = () => {
    const headers = [
      'Public ID',
      'Patient Name',
      'Age',
      'Appointment Date',
      'Time',
      'Facility',
      'Status',
      'YAKAP Registered',
      'Service Type',
      'Created At',
    ]
    const rows = filteredAppointments.map(appointment => [
      appointment.public_id,
      appointment.full_name,
      appointment.age,
      appointment.appointment_date,
      appointment.appointment_time ?? '',
      appointment.consulting_facility,
      STATUS_LABELS[appointment.status],
      appointment.yakap_registered ? 'Yes' : 'No',
      appointment.service_name,
      appointment.created_at ?? '',
    ])

    const csvContent = buildCsvDocument(headers, rows)

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `appointments-${manilaToday()}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const today = manilaToday()

  return (
    <div className="min-h-screen">
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
              <p className="text-sm font-medium text-emerald-100">
                Signed in as {adminUsername} ({adminRole}) · Monitor bookings, verify patients,
                and manage daily flow.
              </p>
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
        {actionError && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 shadow-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

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

        {detailLoading && (
          <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-5 text-sm font-semibold text-slate-600 shadow-sm">
            Loading appointment details…
          </div>
        )}

        {selectedAppointment && (
          <div className="cho-animate-in mb-6 rounded-2xl border border-emerald-200 bg-white p-5 shadow-md shadow-emerald-900/5 ring-1 ring-emerald-100 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-slate-900">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                Appointment details
              </h2>
              <div className="flex items-center gap-2">
                <a
                  href={`/admin/appointments/${selectedAppointment.id}/print`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <Printer className="h-4 w-4" />
                  Print ITR
                </a>
                <button
                  onClick={() => setSelectedAppointment(null)}
                  className="rounded-xl p-2 transition-colors hover:bg-slate-100"
                  aria-label="Dismiss patient details"
                >
                  <XCircle className="h-5 w-5 text-slate-500" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-slate-600">Patient Name</p>
                <p className="font-semibold text-slate-900">{selectedAppointment.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Public ID</p>
                <p className="break-all font-mono text-sm font-semibold text-slate-900">
                  {selectedAppointment.public_id}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Status</p>
                <span
                  className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${STATUS_BADGES[selectedAppointment.status]}`}
                >
                  {STATUS_LABELS[selectedAppointment.status]}
                </span>
              </div>
              <div>
                <p className="text-sm text-slate-600">Age / Birthdate</p>
                <p className="font-semibold text-slate-900">
                  {selectedAppointment.age} · {selectedAppointment.birthdate ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Appointment</p>
                <p className="font-semibold text-slate-900">
                  {formatDate(selectedAppointment.appointment_date)}
                  {selectedAppointment.appointment_time
                    ? ` · ${selectedAppointment.appointment_time}`
                    : ''}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Facility</p>
                <p className="font-semibold text-slate-900">
                  {selectedAppointment.consulting_facility}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Service</p>
                <p className="font-semibold text-slate-900">
                  {selectedAppointment.service_name}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">YAKAP</p>
                <p className="font-semibold text-slate-900">
                  {selectedAppointment.yakap_registered ? 'Registered' : 'Not registered'}
                  {selectedAppointment.yakap_facility
                    ? ` · ${selectedAppointment.yakap_facility}`
                    : ''}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">PhilHealth</p>
                <p className="font-semibold text-slate-900">
                  {selectedAppointment.philhealth_member
                    ? `${selectedAppointment.philhealth_status ?? ''} · ${
                        selectedAppointment.philhealth_number ?? ''
                      }`
                    : 'Not a member'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Contact Number</p>
                <p className="font-semibold text-slate-900">
                  {selectedAppointment.contact_number ?? '—'}
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-slate-600">Residential Address</p>
                <p className="font-semibold text-slate-900">
                  {selectedAppointment.residential_address ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">PWD / PCB</p>
                <p className="font-semibold text-slate-900">
                  {selectedAppointment.pwd ? 'PWD' : 'Not PWD'} ·{' '}
                  {selectedAppointment.primary_care_benefit_member ? 'PCB member' : 'No PCB'}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:gap-3">
              <label htmlFor="appointment-status" className="text-sm font-semibold text-slate-700">
                Update status
              </label>
              <select
                id="appointment-status"
                value={selectedAppointment.status}
                onChange={event => void handleStatusChange(event.target.value as AppointmentStatus)}
                disabled={actionLoading}
                className="cho-select max-w-xs"
              >
                {STATUS_OPTIONS.map(status => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              {actionLoading && (
                <span className="text-xs font-semibold text-slate-500">Saving…</span>
              )}
            </div>
          </div>
        )}

        <div className="cho-animate-in mb-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or ID..."
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  maxLength={100}
                  className="cho-input !pl-10"
                />
              </div>

              <div className="relative w-full sm:w-60">
                <Filter className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={facilityFilter}
                  onChange={event => setFacilityFilter(event.target.value)}
                  className="cho-select !pl-10 appearance-none pr-9"
                >
                  <option value="">All facilities</option>
                  {healthFacilities.map(facility => (
                    <option key={facility} value={facility}>
                      {facility}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative w-full sm:w-48">
                <select
                  value={statusFilter}
                  onChange={event =>
                    setStatusFilter(event.target.value as '' | AppointmentStatus)
                  }
                  className="cho-select appearance-none pr-9"
                  aria-label="Filter by status"
                >
                  <option value="">All statuses</option>
                  {STATUS_OPTIONS.map(status => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
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

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-100 p-3 ring-1 ring-emerald-200/60">
                <User className="h-6 w-6 text-emerald-700" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Total appointments
                </p>
                <p className="text-2xl font-extrabold tracking-tight text-slate-900">
                  {appointments.length}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-100 p-3 ring-1 ring-blue-200/60">
                <Calendar className="h-6 w-6 text-blue-700" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Today&apos;s appointments
                </p>
                <p className="text-2xl font-extrabold tracking-tight text-slate-900">
                  {appointments.filter(appointment => appointment.appointment_date === today).length}
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
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  YAKAP registered
                </p>
                <p className="text-2xl font-extrabold tracking-tight text-slate-900">
                  {appointments.filter(appointment => appointment.yakap_registered).length}
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
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Active facilities
                </p>
                <p className="text-2xl font-extrabold tracking-tight text-slate-900">
                  {new Set(appointments.map(appointment => appointment.consulting_facility)).size}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-slate-200/80 bg-slate-50/60 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <h2 className="text-base font-extrabold tracking-tight text-slate-900">
              Patient records
            </h2>
            <p className="text-xs font-semibold text-slate-500">
              {filteredAppointments.length} shown
            </p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <span
                className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600"
                aria-hidden
              />
              <p className="text-sm font-semibold text-slate-600">Loading appointments…</p>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-bold text-slate-800">No appointments found</p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Try a different name, ID, status, or facility filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200/80">
                <thead className="bg-slate-50/80">
                  <tr>
                    {['Patient', 'Age', 'Date', 'Facility', 'Status', 'YAKAP', 'Service', 'Booked', 'Actions'].map(
                      header => (
                        <th
                          key={header}
                          className="whitespace-nowrap px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500"
                        >
                          {header}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredAppointments.map(appointment => (
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
                              {appointment.public_id.slice(0, 8)}…
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                        {appointment.age}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                        {formatDate(appointment.appointment_date)}
                        {appointment.appointment_time ? (
                          <span className="ml-1 text-xs text-slate-500">
                            {appointment.appointment_time}
                          </span>
                        ) : null}
                      </td>
                      <td className="min-w-[180px] px-6 py-4 text-sm text-slate-900 break-words">
                        {appointment.consulting_facility}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${STATUS_BADGES[appointment.status]}`}
                        >
                          {STATUS_LABELS[appointment.status]}
                        </span>
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
                      <td className="min-w-[200px] px-6 py-4 text-sm text-slate-900 break-words">
                        {appointment.service_name}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                        {formatDateTime(appointment.created_at ?? '')}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <button
                          onClick={() => void viewDetails(appointment.id)}
                          className="font-medium text-emerald-600 hover:text-emerald-800"
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

      {showQRPoster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <h2 className="text-xl font-semibold text-slate-800">Site Access QR Poster</h2>
              <button
                onClick={() => setShowQRPoster(false)}
                className="rounded-lg p-2 transition-colors hover:bg-slate-100"
              >
                <XCircle className="h-5 w-5 text-slate-600" />
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
