import React from 'react'

export default function PrintHeader() {
  return (
    <div className="print-header">
      <img
        src="/cho-seal.png"
        alt="Official Seal"
        className="print-header-logo"
      />
      <div className="print-header-text">
        <div className="print-header-line1">Republic of the Philippines</div>
        <div className="print-header-line2">Department of Health</div>
        <div className="print-header-line3">Kagawaran ng Kalusugan</div>
      </div>
    </div>
  )
}
