import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, Calendar, CheckCircle, Clock, MapPin, XCircle } from 'lucide-react'
import { getAppointmentService } from '@/server/appointments'
import { AppError } from '@/server/errors'
import { logError } from '@/server/logging/logger'
import PrivacyPolicyLink from '@/components/PrivacyPolicyLink'
import type { AppointmentStatus, PublicAppointmentStatus } from '@/types/appointment'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Appointment Status - CHO Bacolod',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
}

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No show',
}

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  scheduled: 'bg-slate-100 text-slate-800 ring-slate-200',
  confirmed: 'bg-blue-100 text-blue-800 ring-blue-200',
  completed: 'bg-green-100 text-green-800 ring-green-200',
  cancelled: 'bg-red-100 text-red-800 ring-red-200',
  no_show: 'bg-amber-100 text-amber-800 ring-amber-200',
}

const STATUS_MESSAGES: Record<AppointmentStatus, string> = {
  scheduled:
    'Your slot is reserved. Please arrive at the CHO laboratory on your appointment date and show this page or your QR code.',
  confirmed:
    'Your appointment has been confirmed. Please arrive on time and bring a valid ID.',
  completed: 'This appointment has been marked as completed.',
  cancelled:
    'This appointment was cancelled. If you still need the service, please book a new appointment.',
  no_show:
    'This appointment was marked as a no-show. Please book a new appointment if you still need the service.',
}

function formatDate(dateString: string): string {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function StatusIcon({ status }: { status: AppointmentStatus }) {
  if (status === 'cancelled' || status === 'no_show') {
    return <XCircle className="h-8 w-8" />
  }
  if (status === 'completed') {
    return <CheckCircle className="h-8 w-8" />
  }
  return <Clock className="h-8 w-8" />
}

export default async function AppointmentStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>
}) {
  const params = await searchParams
  const token = Array.isArray(params.token) ? params.token[0] : params.token

  let status: PublicAppointmentStatus | null = null
  let errorMessage: string | null = null

  if (!token) {
    errorMessage =
      'No appointment link was provided. Scan the QR code from your booking confirmation or use the complete link.'
  } else {
    try {
      status = await getAppointmentService().getPublicStatus(token)
    } catch (error) {
      if (error instanceof AppError && error.status === 404) {
        errorMessage = error.message
      } else {
        logError('public_status.load_failed', error)
        errorMessage =
          'The appointment status service is temporarily unavailable. Please try again later or contact the CHO.'
      }
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
        City Health Office · Bacolod City
      </p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
        Appointment status
      </h1>

      {errorMessage ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
            <div>
              <p className="font-semibold text-amber-950">Unable to show appointment</p>
              <p className="mt-1 text-sm leading-relaxed text-amber-900">{errorMessage}</p>
            </div>
          </div>
        </div>
      ) : null}

      {status ? (
        <div className="mt-6 overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-xl shadow-emerald-900/5">
          <div className="bg-gradient-to-r from-emerald-700 to-teal-700 px-6 py-6 text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
                <StatusIcon status={status.status} />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-100">
                  {status.patient_display_name}
                </p>
                <span
                  className={`mt-1 inline-flex rounded-full px-3 py-1 text-sm font-bold ring-1 ${STATUS_STYLES[status.status]}`}
                >
                  {STATUS_LABELS[status.status]}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <Calendar className="h-3.5 w-3.5" />
                  Date
                </p>
                <p className="mt-1 font-bold text-slate-900">
                  {formatDate(status.appointment_date)}
                </p>
                {status.appointment_time ? (
                  <p className="text-sm font-semibold text-slate-600">
                    {status.appointment_time === 'AM' ? 'Morning (AM)' : 'Afternoon (PM)'}
                  </p>
                ) : null}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <MapPin className="h-3.5 w-3.5" />
                  Facility
                </p>
                <p className="mt-1 font-bold text-slate-900">{status.consulting_facility}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Service
                </p>
                <p className="mt-1 font-bold text-slate-900">{status.service_name}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Appointment ID
                </p>
                <p className="mt-1 break-all font-mono text-sm font-semibold text-slate-900">
                  {status.public_id}
                </p>
              </div>
            </div>

            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-950">
              {STATUS_MESSAGES[status.status]}
            </p>

            <p className="text-xs leading-relaxed text-slate-500">
              For privacy, this page shows only your appointment details. It does not show
              medical results or your full patient record.
            </p>
            <p className="text-xs leading-relaxed text-slate-500">
              The City Health Office publishes how your personal and health information is
              collected, used, stored, and protected.{' '}
              <PrivacyPolicyLink className="text-xs" />
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/"
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700"
        >
          Book an appointment
        </Link>
        <Link
          href="/privacy"
          className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-800"
        >
          Privacy notice
        </Link>
      </div>
    </div>
  )
}
