import React from 'react'

export interface PrintHeaderProps {
  className?: string
}

export default function PrintHeader({ className = '' }: PrintHeaderProps) {
  return (
    <div
      className={`print-header ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <img
        src="/cho-seal.png"
        alt="Official Seal"
        style={{
          width: '45px',
          height: '45px',
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
      <div
        style={{
          marginLeft: '10px',
          textAlign: 'left',
          lineHeight: 1.25,
        }}
      >
        <div
          style={{
            fontWeight: 'normal',
            fontSize: '11px',
          }}
        >
          Republic of the Philippines
        </div>
        <div
          style={{
            fontWeight: 'bold',
            fontSize: '12px',
          }}
        >
          Department of Health
        </div>
        <div
          style={{
            fontWeight: 'normal',
            fontSize: '11px',
          }}
        >
          Kagawaran ng Kalusugan
        </div>
      </div>
    </div>
  )
}
