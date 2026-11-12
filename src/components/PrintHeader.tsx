export default function PrintHeader() {
  return (
    <div className="print-header">
      {/* Top-Left Block */}
      <div className="print-header-left">
        {/* A plain <img> is intentional: print previews must load the seal
            directly and must not depend on the Next.js image optimizer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/cho-seal.png"
          alt="Official Seal"
          width={46}
          height={46}
          className="print-header-logo"
        />
        <div className="print-header-left-text">
          <div className="print-header-line1">Republic of the Philippines</div>
          <div className="print-header-line2">Department of Health</div>
          <div className="print-header-line3">Kagawaran ng Kalusugan</div>
        </div>
      </div>

      {/* Top-Middle Block */}
      <div className="print-header-middle">
        <div className="print-header-middle-line1">BACOLOD CITY HEALTH OFFICE</div>
        <div className="print-header-middle-line2">BACOLOD CITY</div>
      </div>

      {/* Top-Right Block */}
      <div className="print-header-right">
        <div className="print-header-date">Date: ____________</div>
      </div>
    </div>
  )
}
