'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/admin/check-auth')
        if (!response.ok) {
          router.push('/admin/login')
        }
      } catch (error) {
        router.push('/admin/login')
      }
    }

    checkAuth()
  }, [router])

  return <>{children}</>
}