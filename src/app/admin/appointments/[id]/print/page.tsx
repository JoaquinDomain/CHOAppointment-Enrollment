import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import AdminITRPrint from '@/components/AdminITRPrint'
import { buildITREnrollmentData } from '@/lib/itr'
import { getAppointmentService } from '@/server/appointments'
import { getAdminSession } from '@/server/auth/session'
import { AppError } from '@/server/errors'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Print ITR - CHO Admin Portal',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
}

export default async function AdminITRPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  let session
  try {
    session = await getAdminSession()
  } catch {
    redirect('/admin/login')
  }

  if (!session) {
    redirect('/admin/login')
  }

  const { id } = await params

  let detail
  try {
    detail = await getAppointmentService().getAdminDetail(id)
  } catch (error) {
    if (error instanceof AppError && error.status === 404) {
      notFound()
    }
    throw error
  }

  return (
    <AdminITRPrint
      initialData={buildITREnrollmentData(detail)}
      selectedService={detail.service_type}
    />
  )
}
