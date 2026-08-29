'use client'

import { QRCodeCanvas as QRCode } from 'qrcode.react'
import { QrCode, MapPin, Phone, Clock, Globe } from 'lucide-react'

interface SiteQRPosterProps {
  siteUrl?: string
  printable?: boolean
}

export default function SiteQRPoster({ 
  siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://cho-lab-appointment.vercel.app',
  printable = false 
}: SiteQRPosterProps) {
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className={`
      bg-gradient-to-br from-teal-700 to-teal-900 rounded-2xl shadow-2xl overflow-hidden
      ${printable ? 'p-8' : 'p-6'}
    `}>
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <QrCode className="w-8 h-8 text-white" />
          <h1 className="text-2xl font-bold text-white">City Health Office</h1>
        </div>
        <h2 className="text-lg font-semibold text-teal-100">Bacolod City</h2>
        <p className="text-teal-100 text-sm mt-1">Laboratory Appointment System</p>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl p-6 mb-6">
        <div className="text-center mb-4">
          <h3 className="text-xl font-bold text-slate-900 mb-2">Book Your Appointment Online</h3>
          <p className="text-slate-600 text-sm">
            Scan the QR code to schedule your laboratory appointment
          </p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center mb-4">
          <div className="bg-white p-4 rounded-lg border-4 border-teal-600 shadow-lg">
            <QRCode
              value={siteUrl}
              size={printable ? 256 : 200}
              level="H"
              includeMargin={true}
            />
          </div>
        </div>

        {/* URL Display */}
        <div className="text-center">
          <p className="text-xs text-slate-600 mb-1">Visit:</p>
          <p className="text-sm font-mono text-teal-800 break-all">{siteUrl}</p>
        </div>
      </div>

      {/* Information Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-teal-50/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-teal-200" />
            <h4 className="font-semibold text-white">Office Hours</h4>
          </div>
          <p className="text-teal-50 text-sm">
            Monday - Friday<br />
            8:00 AM - 5:00 PM
          </p>
        </div>

        <div className="bg-teal-50/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-5 h-5 text-teal-200" />
            <h4 className="font-semibold text-white">Location</h4>
          </div>
          <p className="text-teal-50 text-sm">
            CHO Main Office<br />
            Bacolod City Health Office
          </p>
        </div>

        <div className="bg-teal-50/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Phone className="w-5 h-5 text-teal-200" />
            <h4 className="font-semibold text-white">Contact</h4>
          </div>
          <p className="text-teal-50 text-sm">
            (034) XXX-XXXX<br />
            cho@bacolodcity.gov.ph
          </p>
        </div>

        <div className="bg-teal-50/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-5 h-5 text-teal-200" />
            <h4 className="font-semibold text-white">Services</h4>
          </div>
          <p className="text-teal-50 text-sm">
            Laboratory Tests<br />
            Health Certificates & More
          </p>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-white/10 rounded-lg p-4 mb-6">
        <h4 className="font-semibold text-white mb-2">How to Use:</h4>
        <ol className="text-teal-50 text-sm space-y-1 list-decimal list-inside">
          <li>Open your phone's camera or QR scanner app</li>
          <li>Point it at the QR code above</li>
          <li>Follow the instructions to book your appointment</li>
          <li>Bring your confirmation QR code on your appointment date</li>
        </ol>
      </div>

      {/* Footer */}
      <div className="text-center">
        <p className="text-teal-50 text-xs">
          © 2024 City Health Office Bacolod • Serving the Community
        </p>
      </div>

      {/* Print Button (only if not in printable mode) */}
      {!printable && (
        <div className="mt-6 text-center">
          <button
            onClick={handlePrint}
            className="px-6 py-3 bg-white text-teal-700 rounded-lg hover:bg-teal-50 transition-colors font-medium shadow-lg"
          >
            Print Poster
          </button>
        </div>
      )}
    </div>
  )
}