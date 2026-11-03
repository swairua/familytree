import React, { useMemo, useState } from 'react'
import PersonAvatar from './PersonAvatar'
import { cleanName } from '../utils/cleanName'
import '../styles/familyevents.css'

function FamilyEventsView({ individuals, families, onSelectPerson }) {
  const [query, setQuery] = useState('')

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  const parseMD = (date) => {
    if (!date) return null
    const m = date.match(/(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/i)
    if (m) {
      const mon = monthNames.findIndex(x => x.toLowerCase() === m[2].slice(0,3).toLowerCase())
      return { day: parseInt(m[1],10), month: mon >= 0 ? mon : 0 }
    }
    const m2 = date.match(/(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{1,2})/i)
    if (m2) {
      const mon = monthNames.findIndex(x => x.toLowerCase() === m2[1].slice(0,3).toLowerCase())
      return { day: parseInt(m2[2],10), month: mon >= 0 ? mon : 0 }
    }
    return null
  }

  const events = useMemo(() => {
    const out = []
    for (const p of individuals.values()) {
      const md = parseMD(p.birthDate)
      if (md) {
        out.push({
          id: p.id,
          person: p,
          type: 'Birthday',
          day: md.day,
          month: md.month,
          label: `${cleanName(p.name)}'s birthday`,
          year: (p.birthDate.match(/\d{4}/) || [])[0],
        })
      }
    }
    // upcoming sort by month then day
    out.sort((a, b) => a.month - b.month || a.day - b.day)
    return out
  }, [individuals])

  const filtered = useMemo(() => {
    if (!query.trim()) return events
    const q = query.toLowerCase()
    return events.filter(e => (e.person.name || '').toLowerCase().includes(q))
  }, [events, query])

  const missing = useMemo(() => {
    const out = []
    for (const p of individuals.values()) {
      if (!p.birthDate) out.push(p)
    }
    return out.slice(0, 12)
  }, [individuals])

  const now = new Date()
  const curM = now.getMonth()
  const upcoming = filtered.filter(e => e.month >= curM).slice(0, 8)
  const later = filtered.filter(e => e.month < curM).slice(0, 8)

  return (
    <div className="fe-view">
      <div className="fe-container">
        <div className="fe-header">
          <h1>Family Events</h1>
          <div className="fe-search">
            <input placeholder="Find an event" value={query} onChange={e => setQuery(e.target.value)} />
            <button className="btn btn-sm">Show advanced search</button>
          </div>
          <button className="btn btn-primary">Post an event</button>
        </div>

        <div className="fe-nav">
          <button className="fe-nav-btn active">Upcoming</button>
          <button className="fe-nav-btn">Month</button>
          <button className="fe-nav-btn">Year</button>
          <button className="fe-nav-btn">Events of close family</button>
        </div>

        <section className="fe-section">
          <h2>Upcoming events</h2>
          <ul className="fe-list">
            {(upcoming.length ? upcoming : filtered.slice(0, 8)).map(e => (
              <li key={e.id} className="fe-item" onClick={() => onSelectPerson(e.id)}>
                <div className="fe-date">
                  <span className="fe-day">{e.day}</span>
                  <span className="fe-mon">{monthNames[e.month]}</span>
                </div>
                <PersonAvatar person={e.person} className="fe-avatar" />
                <div className="fe-info">
                  <strong>{e.label}</strong>
                  {e.year && <span> (born {e.year})</span>}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {later.length > 0 && (
          <section className="fe-section">
            <h2>Later this year</h2>
            <ul className="fe-list">
              {later.map(e => (
                <li key={e.id} className="fe-item" onClick={() => onSelectPerson(e.id)}>
                  <div className="fe-date">
                    <span className="fe-day">{e.day}</span>
                    <span className="fe-mon">{monthNames[e.month]}</span>
                  </div>
                  <PersonAvatar person={e.person} className="fe-avatar" />
                  <div className="fe-info">
                    <strong>{e.label}</strong>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="fe-section">
          <h2>Missing family events</h2>
          <ul className="fe-missing">
            {missing.map(p => (
              <li key={p.id}>
                <i className="fas fa-plus-circle"></i>
                Birthday of {cleanName(p.name)}
              </li>
            ))}
            {missing.length === 0 && <li>All events recorded.</li>}
          </ul>
        </section>
      </div>
    </div>
  )
}

export default FamilyEventsView