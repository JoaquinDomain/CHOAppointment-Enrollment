'use client'

import EnrollmentModal, { type EnrollmentData } from './EnrollmentModal'

interface AdminITRPrintProps {
  initialData: EnrollmentData
  selectedService: string
}

export default function AdminITRPrint({
  initialData,
  selectedService,
}: AdminITRPrintProps) {
  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <EnrollmentModal
        isOpen
        inline
        printOnly
        initialData={initialData}
        selectedService={selectedService}
        onClose={() => undefined}
        onSave={() => false}
      />
    </div>
  )
}
