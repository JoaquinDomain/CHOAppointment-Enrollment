import { redirect } from 'next/navigation'
import AdminUsersManager from '@/components/AdminUsersManager'
import { getAdminSession } from '@/server/auth/session'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  let session
  try {
    session = await getAdminSession()
  } catch {
    redirect('/admin/login')
  }

  if (!session) {
    redirect('/admin/login')
  }

  if (session.role !== 'superadmin') {
    redirect('/admin')
  }

  return (
    <AdminUsersManager
      currentAdminId={session.adminId}
      currentAdminUsername={session.username}
    />
  )
}
