'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Home, Shield } from 'lucide-react'

export default function Navigation() {
  return (
    <nav className="bg-emerald-600 text-white shadow">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/cho-logo.png"
              alt="CHO Bacolod logo"
              width={32}
              height={32}
              className="w-8 h-8 rounded-full object-cover"
              priority
            />
            <span className="font-bold text-lg">CHO Bacolod</span>
          </div>
          <div className="flex gap-4">
            <Link 
              href="/" 
              className="flex items-center gap-2 px-4 py-2 rounded hover:bg-emerald-700 transition-colors"
            >
              <Home className="w-4 h-4" />
              Book Appointment
            </Link>
            <Link 
              href="/admin/login" 
              className="flex items-center gap-2 px-4 py-2 rounded hover:bg-emerald-700 transition-colors"
            >
              <Shield className="w-4 h-4" />
              Admin Portal
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}