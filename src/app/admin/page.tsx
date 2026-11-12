import { redirect } from 'next/navigation'
import AdminDashboard from '@/components/AdminDashboard'
import { getAdminSession, type AdminRole } from '@/server/auth/session'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  let session
  try {
    session = await getAdminSession()
  } catch {
    redirect('/admin/login')
  }

  if (!session) {
    redirect('/admin/login')
  }

  return (
    <AdminDashboard
      adminUsername={session.username}
      adminRole={session.role as AdminRole}
    />
  )
}
