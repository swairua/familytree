import React, { useState, useMemo } from 'react'
import PersonAvatar from './PersonAvatar'
import { cleanName } from '../utils/cleanName'
import '../styles/discoveries.css'

const TABS = ['All Matches', 'Record Matches', 'Smart Matches', 'Pending']

function DiscoveriesView({ individuals, onSelectPerson, onSwitchView }) {
  const [tab, setTab] = useState('All Matches')
  const [sort, setSort] = useState('name')
  const [query, setQuery] = useState('')

  const list = useMemo(() => {
    let arr = Array.from(individuals.values())
    if (query.trim()) {
      const q = query.toLowerCase()
      arr = arr.filter(p => (p.name || '').toLowerCase().includes(q))
    }
    arr.sort((a, b) => {
      if (sort === 'name') return (a.name || '').localeCompare(b.name || '')
      const ya = parseInt((a.birthYear || '').toString().match(/\d{4}/)?.[0] || '0', 10)
      const yb = parseInt((b.birthYear || '').toString().match(/\d{4}/)?.[0] || '0', 10)
      return yb - ya
    })
    return arr.slice(0, 60)
  }, [individuals, query, sort])

  return (
    <div className="discoveries-view">
      <div className="discoveries-container">
        <div className="discoveries-header">
          <div>
            <h1>Discoveries</h1>
            <p className="discoveries-sub">
              {individuals.size.toLocaleString()} people &middot; {list.length} shown
            </p>
          </div>
          <div className="discoveries-controls">
            <input
              type="search"
              placeholder="Find a person..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="discoveries-search"
            />
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="discoveries-sort">
              <option value="name">Sort by name</option>
              <option value="birth">Sort by birth year</option>
            </select>
          </div>
        </div>

        <div className="discoveries-tabs">
          {TABS.map(t => (
            <button
              key={t}
              className={`disc-tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="discoveries-list">
          {list.map(p => (
            <div key={p.id} className="disc-card">
              <PersonAvatar person={p} className="disc-avatar" />
              <div className="disc-info">
                <h3 className="disc-name">{cleanName(p.name)}</h3>
                <p className="disc-rel">
                  {p.gender === 'male' ? 'Male' : p.gender === 'female' ? 'Female' : 'Person'}
                  {p.birthDate ? ` • born ${p.birthDate}` : ''}
                  {p.birthPlace ? ` in ${p.birthPlace}` : ''}
                </p>
                <p className="disc-new">
                  {p.deathDate ? `Deceased ${p.deathDate}` : 'Living'}
                  {p.occupation ? ` • ${p.occupation}` : ''}
                </p>
              </div>
              <button className="disc-review" onClick={() => onSelectPerson(p.id)}>
                Review match
              </button>
            </div>
          ))}
          {list.length === 0 && (
            <div className="disc-empty">No matches found.</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DiscoveriesView