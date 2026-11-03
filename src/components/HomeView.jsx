import React, { useMemo } from 'react'
import PersonAvatar from './PersonAvatar'
import { cleanName } from '../utils/cleanName'
import { photoUrl } from '../utils/photoUrl'
import '../styles/home.css'

function HomeView({ individuals, families, onSelectPerson, onSwitchView }) {
  const peopleCount = individuals.size
  const treeCount = Math.max(1, families.size > 0 ? 1 : 0)
  const photoCount = useMemo(() => {
    let n = 0
    for (const p of individuals.values()) if (p.photo) n++
    return n
  }, [individuals])

  const recent = useMemo(() => {
    const arr = Array.from(individuals.values())
    // Prefer people with birth years, newest first
    arr.sort((a, b) => {
      const ya = parseInt((a.birthYear || '').toString().match(/\d{4}/)?.[0] || '0', 10)
      const yb = parseInt((b.birthYear || '').toString().match(/\d{4}/)?.[0] || '0', 10)
      return yb - ya
    })
    return arr.slice(0, 8)
  }, [individuals])

  const creator = useMemo(() => {
    // Site creator = earliest root person (no parents) or first
    for (const p of individuals.values()) {
      if (!p.parents || p.parents.length === 0) return p
    }
    return individuals.values().next().value
  }, [individuals])

  return (
    <div className="home-view">
      <div className="home-container">
        <aside className="home-sidebar">
          <div className="profile-card">
            <div className="profile-cover" />
            <div className="profile-body">
              <PersonAvatar person={creator} className="profile-avatar" />
              <h2 className="profile-name">{creator ? cleanName(creator.name) : 'Wairua Family'}</h2>
              <p className="profile-role">Site manager</p>
              <div className="profile-stats">
                <div className="stat">
                  <span className="stat-value">{peopleCount.toLocaleString()}</span>
                  <span className="stat-label">People</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{treeCount}</span>
                  <span className="stat-label">Family trees</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{photoCount.toLocaleString()}</span>
                  <span className="stat-label">Photos</span>
                </div>
              </div>
              <div className="profile-actions">
                <button className="btn btn-primary btn-block" onClick={() => onSwitchView('tree')}>
                  <i className="fas fa-sitemap"></i> View family tree
                </button>
                <button className="btn btn-block" onClick={() => onSwitchView('gallery')}>
                  <i className="fas fa-images"></i> View photos
                </button>
              </div>
            </div>
          </div>
        </aside>

        <section className="home-main">
          <div className="home-card">
            <div className="home-card-header">
              <h1>Recent activity</h1>
              <span className="home-card-sub">Latest updates to the Wairua family site</span>
            </div>
            <ul className="activity-list">
              {recent.map((p) => (
                <li key={p.id} className="activity-item" onClick={() => onSelectPerson(p.id)}>
                  <PersonAvatar person={p} className="activity-avatar" />
                  <div className="activity-content">
                    <p className="activity-text">
                      <strong>{cleanName(p.name)}</strong>
                      {p.birthDate ? ` was born ${p.birthDate}` : ' was added to the family tree'}
                      {p.birthPlace ? ` in ${p.birthPlace}` : ''}
                    </p>
                    <span className="activity-date">
                      {p.birthYear || p.deathYear || 'Recently'}
                    </span>
                  </div>
                  {photoUrl(p) && (
                    <img
                      className="activity-thumb"
                      src={photoUrl(p)}
                      alt=""
                      loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  )}
                </li>
              ))}
            </ul>
            <div className="home-card-footer">
              <button className="btn btn-accent" onClick={() => onSwitchView('people')}>
                View more
              </button>
            </div>
          </div>

          <div className="home-card">
            <div className="home-card-header">
              <h2>Quick links</h2>
            </div>
            <div className="quick-links">
              <button onClick={() => onSwitchView('tree')}><i className="fas fa-sitemap"></i><span>Family tree</span></button>
              <button onClick={() => onSwitchView('people')}><i className="fas fa-users"></i><span>People</span></button>
              <button onClick={() => onSwitchView('search')}><i className="fas fa-search"></i><span>Search</span></button>
              <button onClick={() => onSwitchView('gallery')}><i className="fas fa-images"></i><span>Photos</span></button>
              <button onClick={() => onSwitchView('import')}><i className="fas fa-file-import"></i><span>Import GEDCOM</span></button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default HomeView