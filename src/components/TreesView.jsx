import React, { useMemo, useState } from 'react'
import '../styles/viewpages.css'

export default function TreesView({ individuals, onSwitchView }) {
  const [treeName, setTreeName] = useState(() => localStorage.getItem('treeName') || 'Wairua')
  const [saved, setSaved] = useState(false)

  const stats = useMemo(() => {
    let photos = 0
    let oldest = null
    let youngest = null
    let years = 0
    for (const p of individuals.values()) {
      if (p.photo) photos++
      const y = parseInt((p.birthYear || '').toString().match(/\d{4}/)?.[0] || '0', 10)
      if (y && (oldest === null || y < oldest)) oldest = y
      if (y && (youngest === null || y > youngest)) youngest = y
    }
    years = oldest && youngest ? youngest - oldest : 0
    return { photos, oldest, youngest, years }
  }, [individuals])

  const handleSave = (e) => {
    e.preventDefault()
    localStorage.setItem('treeName', treeName.trim() || 'Wairua')
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="view-page">
      <div className="view-container">
        <div className="view-header">
          <div>
            <h1>Manage trees</h1>
            <p className="view-sub">Switch between trees, rename them, or create a new one.</p>
          </div>
          <button className="btn btn-primary" onClick={() => onSwitchView('import')}>
            <i className="fas fa-plus"></i> New tree
          </button>
        </div>

        <div className="view-card">
          <div className="view-card-header">
            <h2>My trees</h2>
            <span className="view-pill">1 tree</span>
          </div>
          <ul className="trees-list">
            <li className="tree-row active">
              <div className="tree-icon"><i className="fas fa-sitemap"></i></div>
              <div className="tree-info">
                <form className="tree-rename-form" onSubmit={handleSave}>
                  <label htmlFor="treeName" className="sr-only">Tree name</label>
                  <input
                    id="treeName"
                    className="tree-name-input"
                    type="text"
                    value={treeName}
                    onChange={(e) => setTreeName(e.target.value)}
                    placeholder="Wairua"
                  />
                  <button type="submit" className="btn btn-sm">{saved ? 'Saved' : 'Save'}</button>
                </form>
                <p className="tree-stats">
                  <strong>{individuals.size.toLocaleString()}</strong> people &middot;{' '}
                  <strong>{stats.photos.toLocaleString()}</strong> photos &middot;
                  {stats.oldest && stats.youngest ? ` ${stats.oldest}–${stats.youngest}` : ''}
                </p>
              </div>
              <div className="tree-actions">
                <button className="btn btn-sm" onClick={() => onSwitchView('tree')} title="Open family tree">
                  <i className="fas fa-external-link-alt"></i> Open
                </button>
                <button className="btn btn-sm" onClick={() => onSwitchView('print')} title="Print this tree">
                  <i className="fas fa-print"></i> Print
                </button>
              </div>
            </li>
          </ul>
        </div>

        <div className="view-card">
          <div className="view-card-header">
            <h2>Tree settings</h2>
          </div>
          <div className="view-grid">
            <div className="view-tile">
              <i className="fas fa-users"></i>
              <strong>{individuals.size.toLocaleString()}</strong>
              <span>People in this tree</span>
            </div>
            <div className="view-tile">
              <i className="fas fa-images"></i>
              <strong>{stats.photos.toLocaleString()}</strong>
              <span>Photos</span>
            </div>
            <div className="view-tile">
              <i className="fas fa-calendar-alt"></i>
              <strong>{stats.years}</strong>
              <span>Years of history</span>
            </div>
            <div className="view-tile">
              <i className="fas fa-chart-pie"></i>
              <strong>{stats.oldest || '—'}</strong>
              <span>Oldest record</span>
            </div>
          </div>
          <div className="view-footer">
            <button className="btn btn-primary" onClick={() => onSwitchView('import')}>
              <i className="fas fa-file-import"></i> Import GEDCOM
            </button>
            <button className="btn" onClick={() => onSwitchView('gallery')}>
              <i className="fas fa-images"></i> Manage photos
            </button>
            <button className="btn" onClick={() => onSwitchView('sync')}>
              <i className="fas fa-sync"></i> Sync from MyHeritage
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}