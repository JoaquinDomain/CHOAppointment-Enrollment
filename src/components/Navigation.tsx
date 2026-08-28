'use client'

import Link from 'next/link'
import { Home, Shield, Stethoscope } from 'lucide-react'

export default function Navigation() {
  return (
    <nav className="bg-teal-700 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-6 h-6" />
            <span className="font-bold text-lg">CHO Bacolod</span>
          </div>
          <div className="flex gap-4">
            <Link 
              href="/" 
              className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-teal-600 transition-colors"
            >
              <Home className="w-4 h-4" />
              Book Appointment
            </Link>
            <Link 
              href="/admin" 
              className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-teal-600 transition-colors"
            >
              <Shield className="w-4 h-4" />
              Admin Dashboard
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}