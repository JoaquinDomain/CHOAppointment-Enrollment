'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Shield, Stethoscope } from 'lucide-react'

export default function Navigation() {
  const pathname = usePathname()
  const isHome = pathname === '/'
  const isAdmin = pathname?.startsWith('/admin')

  return (
    <header className="sticky top-0 z-40 border-b border-emerald-900/10 bg-white/85 shadow-[0_1px_12px_rgba(6,78,59,0.08)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex min-w-0 items-center gap-3">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-600/25 ring-1 ring-emerald-900/20">
            <Stethoscope className="h-5 w-5" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[15px] font-extrabold tracking-tight text-slate-900">
              CHO Bacolod
            </span>
            <span className="block truncate text-xs font-medium text-slate-500">
              Laboratory Appointment System
            </span>
          </span>
        </Link>

        <nav className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link
            href="/"
            aria-current={isHome ? 'page' : undefined}
            className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition-all sm:px-4 ${
              isHome
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'
            }`}
          >
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Book Appointment</span>
            <span className="sm:hidden">Book</span>
          </Link>
          <Link
            href="/admin/login"
            aria-current={isAdmin ? 'page' : undefined}
            className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition-all sm:px-4 ${
              isAdmin
                ? 'bg-slate-900 text-white shadow-md'
                : 'border border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:text-emerald-800'
            }`}
          >
            <Shield className="h-4 w-4" />
            Admin
          </Link>
        </nav>
      </div>
    </header>
  )
}
