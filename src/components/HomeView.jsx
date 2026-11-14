import React, { useMemo, useState } from 'react'
import PersonAvatar from './PersonAvatar'
import { cleanName } from '../utils/cleanName'
import '../styles/home.css'

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

function HomeView({ individuals, families, onSelectPerson, onSwitchView, recentActivity }) {
  const peopleCount = individuals.size
  const photoCount = useMemo(() => {
    let n = 0
    for (const p of individuals.values()) if (p.photo) n++
    return n
  }, [individuals])

  const [researchName, setResearchName] = useState('')
  const [researchLast, setResearchLast] = useState('')

  const recentEntries = recentActivity?.entries || []

  // Match activity lines to local individuals by name for thumbnails
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z]/g, ' ').replace(/\s+/g, ' ').trim()
  const personForLine = (line) => {
    const n = norm(line)
    for (const p of individuals.values()) {
      const g = norm(p.givenName || '')
      const s = norm(p.surname || '')
      const full = norm(p.name || '')
      if (full && n.includes(full)) return p
      if (g && s && n.includes(g) && n.includes(s)) return p
    }
    return null
  }

  const creator = useMemo(() => {
    for (const p of individuals.values()) {
      if ((p.name || '').toLowerCase().includes('joseph')) return p
    }
    for (const p of individuals.values()) {
      if (!p.parents || p.parents.length === 0) return p
    }
    return individuals.values().next().value
  }, [individuals])

  if (individuals.size === 0) {
    return (
      <div className="home-view">
        <div className="home-loading"><i className="fas fa-spinner fa-spin"></i> Loading family data...</div>
      </div>
    )
  }

  return (
    <div className="home-view">
      {/* Hero */}
      <div className="home-hero">
        <h1 className="home-hero-title">Wairua Web Site</h1>
      </div>

      <div className="home-container">
        {/* Sidebar */}
        <aside className="home-sidebar">
          <div className="home-profile-card">
            <div className="home-profile-top">
              <PersonAvatar person={creator} className="home-profile-avatar" />
              <div className="home-profile-meta">
                <h2>{creator ? cleanName(creator.name) : 'Joseph Gichuki'}</h2>
                <p>Site creator <a className="mh-contact-link" href="mailto:contact@wairua.site">Contact</a></p>
              </div>
            </div>
            <div className="home-stats">
              <div className="home-stat"><span className="home-stat-value">{peopleCount.toLocaleString()}</span><span className="home-stat-label">People</span></div>
              <div className="home-stat"><span className="home-stat-value">2</span><span className="home-stat-label">Family trees</span></div>
              <div className="home-stat"><span className="home-stat-value">{photoCount.toLocaleString()}</span><span className="home-stat-label">Photos</span></div>
            </div>
            <p className="home-invite">Tell relatives and visitors about your <a href="#" onClick={e => { e.preventDefault(); onSwitchView('members') }}>family site</a>.</p>
          </div>

          <div className="home-research-card">
            <h3>Research your ancestors</h3>
            <p>in 42.2 billion historical records</p>
            <form className="home-research-form" onSubmit={e => { e.preventDefault(); onSwitchView('research') }}>
              <input
                type="text"
                placeholder="First & middle name"
                value={researchName}
                onChange={e => setResearchName(e.target.value)}
              />
              <input
                type="text"
                placeholder="Last name"
                value={researchLast}
                onChange={e => setResearchLast(e.target.value)}
              />
              <button type="submit" className="home-search-btn">Search</button>
            </form>
          </div>
        </aside>

        {/* Main content */}
        <section className="home-main">
          <div className="home-activity-card">
            <h3 className="home-section-title">RECENT ACTIVITY</h3>

            {recentEntries.length === 0 && (
              <p style={{ color: '#888', fontSize: '0.85rem' }}>No recent activity synced yet.</p>
            )}

            {recentEntries.slice(0, 10).map((entry, idx) => {
              const person = personForLine(entry.text)
              const thumb = person ? photoUrl(person) : null
              return (
              <div key={idx} className="home-activity-item">
                <span className="home-activity-date">{entry.date}</span>
                <div className="home-activity-row">
                  {thumb ? (
                    <img
                      className="home-activity-thumb"
                      src={thumb}
                      alt=""
                      loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  ) : (
                    <div className="home-activity-thumb home-activity-thumb-placeholder">
                      <i className="fas fa-user"></i>
                    </div>
                  )}
                  <div className="home-activity-text">
                    {entry.lines.map((line, i) => (
                      <p key={i} style={{ margin: 0, padding: '2px 0' }}>{line}</p>
                    ))}
                  </div>
                </div>
              </div>
              )
            })}

            <button className="home-view-more" onClick={() => onSwitchView('events')}>View more</button>
          </div>
        </section>
      </div>
    </div>
  )
}

export default HomeView