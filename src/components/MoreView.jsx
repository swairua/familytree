import React from 'react'
import '../styles/viewpages.css'

export default function MoreView({ individuals, onSwitchView, onSyncClick, syncing }) {
  return (
    <div className="view-page">
      <div className="view-container">
        <div className="view-header">
          <div>
            <h1>More actions</h1>
            <p className="view-sub">Additional tools for managing your family tree.</p>
          </div>
        </div>

        <div className="view-card">
          <div className="view-card-header">
            <h2>Actions</h2>
            <span className="view-pill">{individuals.size.toLocaleString()} people</span>
          </div>
          <div className="more-actions">
            <button className="more-action" onClick={() => onSwitchView('tree')}>
              <i className="fas fa-sitemap"></i>
              <strong>My family tree</strong>
              <span>Open the pedigree view</span>
            </button>
            <button className="more-action" onClick={() => onSwitchView('gallery')}>
              <i className="fas fa-images"></i>
              <strong>My photos</strong>
              <span>Browse all family photos</span>
            </button>
            <button className="more-action" onClick={() => onSwitchView('trees')}>
              <i className="fas fa-layer-group"></i>
              <strong>Manage trees</strong>
              <span>Switch / rename your tree</span>
            </button>
            <button className="more-action" onClick={() => onSwitchView('print')}>
              <i className="fas fa-print"></i>
              <strong>Print charts &amp; books</strong>
              <span>Print or export as PDF</span>
            </button>
            <button className="more-action" onClick={() => onSwitchView('import')}>
              <i className="fas fa-file-import"></i>
              <strong>Import GEDCOM</strong>
              <span>Import a GEDCOM file</span>
            </button>
            <button className="more-action" onClick={() => onSyncClick && onSyncClick()} disabled={syncing}>
              <i className="fas fa-sync"></i>
              <strong>Sync from TheWairuaHeritage</strong>
              <span>Re-pull the latest data from TheWairuaHeritage</span>
            </button>
            <button className="more-action" onClick={() => onSwitchView('members')}>
              <i className="fas fa-users"></i>
              <strong>Site members</strong>
              <span>People who help edit your tree</span>
            </button>
            <button className="more-action" onClick={() => onSwitchView('research')}>
              <i className="fas fa-search"></i>
              <strong>Research</strong>
              <span>Search 42.2 billion records</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
