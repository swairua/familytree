import React, { useMemo } from 'react'
import '../styles/viewpages.css'

export default function PrintView({ individuals, families, onSwitchView }) {
  const stats = useMemo(() => {
    return {
      people: individuals.size,
      families: families.size,
    }
  }, [individuals, families])

  const handlePrint = () => window.print()

  return (
    <div className="view-page">
      <div className="view-container">
        <div className="view-header">
          <div>
            <h1>Print charts &amp; books</h1>
            <p className="view-sub">Create print-ready family tree charts and books.</p>
          </div>
          <div>
            <button className="btn btn-primary" onClick={handlePrint}>
              <i className="fas fa-print"></i> Print
            </button>
            <button className="btn" onClick={() => onSwitchView('tree')} style={{ marginLeft: 8 }}>
              <i className="fas fa-sitemap"></i> Open tree
            </button>
          </div>
        </div>

        <div className="view-card">
          <div className="view-card-header">
            <h2>Print options</h2>
          </div>
          <div className="print-options">
            <div className="print-option">
              <div className="print-option-icon"><i className="fas fa-sitemap"></i></div>
              <div className="print-option-body">
                <h3>Family tree chart</h3>
                <p>Print a full-page pedigree chart with photos for the selected family.</p>
                <button className="btn btn-sm btn-primary" onClick={handlePrint}>
                  <i className="fas fa-print"></i> Print chart
                </button>
              </div>
            </div>

            <div className="print-option">
              <div className="print-option-icon"><i className="fas fa-book"></i></div>
              <div className="print-option-body">
                <h3>Family book</h3>
                <p>Print a photo book with biographies and family histories.</p>
                <button className="btn btn-sm btn-primary" onClick={handlePrint}>
                  <i className="fas fa-print"></i> Print book
                </button>
              </div>
            </div>

            <div className="print-option">
              <div className="print-option-icon"><i className="fas fa-file-pdf"></i></div>
              <div className="print-option-body">
                <h3>Download PDF</h3>
                <p>Export the tree and photos as a PDF for archiving.</p>
                <button className="btn btn-sm btn-primary" onClick={handlePrint}>
                  <i className="fas fa-file-pdf"></i> Save as PDF
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="view-card">
          <div className="view-card-header">
            <h2>What&apos;s included</h2>
          </div>
          <div className="view-grid">
            <div className="view-tile">
              <i className="fas fa-users"></i>
              <strong>{stats.people.toLocaleString()}</strong>
              <span>People</span>
            </div>
            <div className="view-tile">
              <i className="fas fa-user-friends"></i>
              <strong>{stats.families.toLocaleString()}</strong>
              <span>Families</span>
            </div>
            <div className="view-tile">
              <i className="fas fa-sitemap"></i>
              <strong>Pedigree</strong>
              <span>Left-to-right layout</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}