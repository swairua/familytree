import React, { useState, useMemo, useEffect } from 'react'
import PersonAvatar from './PersonAvatar'
import { cleanName, getInitials } from '../utils/cleanName'
import { photoUrl } from '../utils/photoUrl'
import '../styles/discoveries.css'

const TABS = [
  { key: 'All Matches', label: 'All Matches' },
  { key: 'Record Matches', label: 'Record Matches' },
  { key: 'Smart Matches', label: 'Smart Matches' },
]

function DiscoveriesView({ individuals, onSelectPerson, onSwitchView, mode = 'default' }) {
  const [tab, setTab] = useState('All Matches')
  const [sort, setSort] = useState('value')
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(12)

  const heading =
    mode === 'people' ? 'Matches by people'
    : mode === 'source' ? 'Matches by source'
    : 'Discoveries'

  // Generic relation text (placeholder – not computed from real tree)
  const relationFor = (p) => {
    const g = p.gender === 'male' ? 'male' : p.gender === 'female' ? 'female' : 'relative'
    const surname = p.surname || (p.name ? p.name.split(' ').pop() : '')
    return `${surname ? surname.charAt(0) + surname.slice(1).toLowerCase() : 'A'} ${g} relative (Wairua Family Tree)`
  }

  const matchesCountFor = (p) => {
    const c = p.children ? p.children.length : 0
    const s = p.spouses ? p.spouses.length : 0
    return Math.max(1, c + s + 1)
  }

  const filtered = useMemo(() => {
    let arr = Array.from(individuals.values())

    if (tab === 'Record Matches') {
      arr = arr.filter(p => !!p.birthDate || !!p.deathDate || !!p.birthPlace || !!p.occupation)
    } else if (tab === 'Smart Matches') {
      arr = arr.filter(p => (p.spouses && p.spouses.length) || (p.children && p.children.length) || (p.parents && p.parents.length))
    } else if (tab === 'Pending') {
      arr = arr.filter(p => !p.birthDate || !p.gender || p.gender === 'unknown')
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase()
      arr = arr.filter(p => (p.name || '').toLowerCase().includes(q))
    }

    arr.sort((a, b) => {
      if (sort === 'name') return (a.name || '').localeCompare(b.name || '')
      if (sort === 'birth') {
        const ya = parseInt((a.birthYear || '').toString().match(/\d{4}/)?.[0] || '0', 10)
        const yb = parseInt((b.birthYear || '').toString().match(/\d{4}/)?.[0] || '0', 10)
        return yb - ya
      }
      // sort === 'value' – keep original order (value rank ~ number of children)
      return (b.children ? b.children.length : 0) - (a.children ? a.children.length : 0) || (a.name || '').localeCompare(b.name || '')
    })

    return arr
  }, [individuals, query, sort, tab])

  const list = filtered.slice(0, visibleCount)

  useEffect(() => { setVisibleCount(12) }, [tab, query, sort])

  return (
    <div className="matches-view">
      <div className="matches-container">
        <h1 className="matches-title">{heading}</h1>

        <div className="matches-filters">
          <div className="matches-segment" role="tablist">
            {TABS.map(t => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                className={`seg-btn ${tab === t.key ? 'active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            className="matches-pill"
            aria-pressed={tab === 'Pending'}
            style={{ fontVariantNumeric: 'tabular-nums' }}
            onClick={() => setTab(tab === 'Pending' ? 'All Matches' : 'Pending')}
          >
            Pending <i className="fas fa-chevron-down"></i>
          </button>

          <button className="matches-pill" type="button">
            All Trees <i className="fas fa-chevron-down"></i>
          </button>

          <div className="matches-sort">
            <span>Sort by: <strong>{sort === 'value' ? 'Value' : sort === 'name' ? 'Name' : 'Birth'}</strong></span>
            <i className="fas fa-chevron-down"></i>
          </div>
          <select
            className="matches-sort-native"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort matches"
          >
            <option value="value">Value</option>
            <option value="name">Name</option>
            <option value="birth">Birth year</option>
          </select>

          <button className="matches-icon-btn" title="Settings">
            <i className="fas fa-cog"></i>
          </button>
          <button
            className="matches-icon-btn"
            title="Search"
            onClick={() => document.querySelector('.matches-search')?.focus()}
          >
            <i className="fas fa-search"></i>
          </button>
        </div>

        <div className="matches-meta">
          <span>
            {filtered.length} people with {filtered.reduce((acc, p) => acc + matchesCountFor(p), 0)} matches
          </span>
          <input
            className="matches-search"
            type="search"
            placeholder="Find a person..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Find a person"
          />
        </div>

        <div className="matches-list">
          {list.map(p => {
            const name = cleanName(p.name) || 'Unknown'
            const initials = getInitials(name)
            const photo = photoUrl(p)
            const rc = matchesCountFor(p)
            return (
              <div className="match-card" key={p.id}>
                <div className="match-card-left">
                  {photo ? (
                    <img className="match-avatar" src={photo} alt={name} />
                  ) : (
                    <div className="match-avatar match-avatar-initials" aria-label={name}>{initials}</div>
                  )}
                  <div className="match-card-info">
                    <h3 className="match-name">{name}</h3>
                    <p className="match-relation">
                      <a href="#" onClick={(e) => { e.preventDefault(); onSelectPerson(p.id) }}>
                        {relationFor(p)}
                      </a>
                    </p>
                    <p className="match-born">
                      {p.birthDate ? `Born ${p.birthDate}` : ''}{p.birthPlace ? ` · ${p.birthPlace}` : ''}
                    </p>
                    <button className="match-show-relatives" onClick={() => onSelectPerson(p.id)}>
                      Show relatives
                    </button>
                  </div>
                </div>
                <div className="match-card-right">
                  <div className="match-newinfo">
                    <p className="match-newinfo-label">New info:</p>
                    <p className="match-newinfo-desc">
                      {p.deathDate
                        ? 'Personal photo, birth date, birth place, death date, death place, burial place, father, mother, sibling(s) and child(ren)'
                        : 'Personal photo, birth date, birth place, father, mother, sibling(s) and child(ren)'}
                    </p>
                    {photo && <img className="match-newinfo-photo" src={photo} alt="" />}
                  </div>
                  <button className="match-review-btn" onClick={() => onSelectPerson(p.id)}>
                    Review {rc === 1 ? 'one match' : `${rc} matches`}
                  </button>
                </div>
              </div>
            )
          })}

          {list.length === 0 && <div className="match-empty">No matches found. Try a different search or tab.</div>}
        </div>

        {visibleCount < filtered.length && (
          <div className="match-loadmore">
            <button className="btn btn-primary" onClick={() => setVisibleCount(c => c + 12)}>
              Load more ({filtered.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default DiscoveriesView
