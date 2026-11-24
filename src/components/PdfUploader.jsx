/**
 * PdfUploader.jsx
 *
 * Dedicated PDF invoice / cart upload component.
 */

import { useRef } from 'react'

export default function PdfUploader({ onPdfSelect, loading, hasData, fileName }) {
  const inputRef = useRef(null)

  function handleChange(e) {
    const file = e.target.files[0]
    if (!file) return
    onPdfSelect(file)
    e.target.value = ''
  }

  return (
    <div
      style={{
        border: `2px dashed ${hasData ? '#1e5c2c' : '#CECECE'}`,
        borderRadius: 6,
        padding: '1rem 1.2rem',
        background: hasData ? '#f0faf2' : '#fafafa',
        cursor: loading ? 'wait' : 'pointer',
        transition: 'border-color 0.15s',
      }}
      onClick={() => !loading && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        style={{ display: 'none' }}
        onChange={handleChange}
        disabled={loading}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span style={{ fontSize: 20 }}>{hasData ? '✅' : '📑'}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#131A48' }}>
            cart.pdf (Invoice / Order Summary)
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
            {loading
              ? 'Extracting table rows from PDF...'
              : hasData
              ? fileName
              : 'Upload order invoice PDF (Order #OP-9921)'}
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: hasData ? '#1e5c2c' : '#FF5800',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {loading ? 'Parsing...' : hasData ? 'Change' : 'Upload PDF'}
          </span>
        </div>
      </div>
    </div>
  )
}
