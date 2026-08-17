import React, { useRef, useState } from 'react'

function ImportView({ onImport, status }) {
  const fileInputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFileSelect = (e) => {
    const files = e.target.files
    if (files.length > 0) {
      onImport(files[0])
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      onImport(files[0])
    }
  }

  return (
    <div className="import-container">
      <div className="import-card">
        <i className="fas fa-file-import import-icon"></i>
        <h2>Import GEDCOM File</h2>
        <p>
          GEDCOM is the standard format for family tree data. Export your tree from
          MyHeritage as GEDCOM and import it here.
        </p>

        <div className="import-steps">
          <div className="step">
            <span className="step-num">1</span>
            <div className="step-content">
              <h3>Export from MyHeritage</h3>
              <p>Log into MyHeritage → Family Tree → Manage → Export to GEDCOM</p>
            </div>
          </div>
          <div className="step">
            <span className="step-num">2</span>
            <div className="step-content">
              <h3>Download the .ged file</h3>
              <p>MyHeritage will generate a GEDCOM file with all your family data</p>
            </div>
          </div>
          <div className="step">
            <span className="step-num">3</span>
            <div className="step-content">
              <h3>Import it here</h3>
              <p>Upload the .ged file below to build your family tree</p>
            </div>
          </div>
        </div>

        <div
          className={`file-upload-area ${isDragging ? 'dragover' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input
            type="file"
            ref={fileInputRef}
            accept=".ged,.gedcom"
            onChange={handleFileSelect}
            hidden
          />
          <i className="fas fa-cloud-upload-alt"></i>
          <p>Click to upload or drag & drop your GEDCOM file</p>
          <p className="file-hint">Supported formats: .ged, .gedcom</p>
        </div>

        {status && (
          <div className={`import-status ${status.type}`}>
            {status.type === 'success' && <i className="fas fa-check-circle"></i>}
            {status.type === 'error' && <i className="fas fa-exclamation-circle"></i>}
            {status.type === 'info' && <i className="fas fa-spinner fa-spin"></i>}
            {' '}{status.message}
          </div>
        )}
      </div>
    </div>
  )
}

export default ImportView