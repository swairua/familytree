import React, { useEffect, useMemo, useState } from 'react'
import { photoUrl } from '../utils/photoUrl'
import { cleanName } from '../utils/cleanName'
import '../styles/viewpages.css'
import '../styles/printpages.css'

// ---------- helpers ----------
const yearOf = (d) => {
  if (!d) return ''
  const m = String(d).match(/\b(\d{4})\b/)
  return m ? m[1] : ''
}

const lifespan = (p) => {
  const b = yearOf(p.birthDate) || '?'
  const d = yearOf(p.deathDate)
  return d ? `${b}–${d}` : b
}

const fullName = (p) => {
  if (!p) return ''
  return cleanName(p.name) || `${p.givenName || ''} ${p.surname || ''}`.trim()
}

// Build ancestor chart up to N generations from anchor individual
function buildAncestorChart(individuals, anchorId, maxGen = 4) {
  if (!anchorId) return []
  const root = individuals.get(anchorId)
  if (!root) return []

  // Generation rows: index 0 = self, 1 = parents, 2 = grandparents, 3 = great-grandparents
  const generations = [[root]]
  let current = [root]
  for (let gen = 1; gen <= maxGen; gen++) {
    const next = []
    for (const person of current) {
      const parentIds = person.parents || []
      const parents = parentIds.map(id => individuals.get(id)).filter(Boolean)
      const father = parents.find(p => p.gender === 'male')
      const mother = parents.find(p => p.gender === 'female')
      next.push(father || null, mother || null)
    }
    generations.push(next)
    current = next.filter(Boolean)
    if (!current.length) break
  }
  return generations
}

// BFS relatives around anchor (ancestors + siblings + spouses' parents)
function buildRelatives(individuals, anchorId, limit = 80) {
  if (!anchorId) return []
  const seen = new Set([anchorId])
  const out = []
  const queue = [anchorId]
  while (queue.length && out.length < limit) {
    const id = queue.shift()
    const person = individuals.get(id)
    if (!person) continue
    out.push(person)
    const neighbors = new Set()
    for (const pid of (person.parents || [])) neighbors.add(pid)
    for (const cid of (person.children || [])) neighbors.add(cid)
    for (const sid of (person.spouses || [])) neighbors.add(sid)
    for (const sid of (person.siblings || [])) neighbors.add(sid)
    for (const nid of neighbors) {
      if (!seen.has(nid)) {
        seen.add(nid)
        queue.push(nid)
      }
    }
  }
  return out
}

function Thumb({ person, size = 'sm' }) {
  const url = photoUrl(person)
  if (url) {
    return <img src={url} alt="" className={`print-thumb print-thumb-${size}`} loading="lazy" />
  }
  const initials = (() => {
    const n = fullName(person)
    const parts = n.split(' ').filter(Boolean)
    if (parts.length === 0) return '?'
    return (parts[0][0] || '').toUpperCase() + (parts.length > 1 ? parts[parts.length - 1][0] || '' : '').toUpperCase()
  })()
  return <div className={`print-thumb print-thumb-${size} print-thumb-fallback`}>{initials}</div>
}

function PhotoChart({ people }) {
  const rows = people || []
  if (rows.length === 0) {
    return <div className="print-empty">No chart data available. Pick a family member to anchor the chart.</div>
  }
  return (
    <section className="print-content print-chart" aria-hidden="true">
      <header className="print-content-header">
        <h1>Family chart</h1>
        <p>TheWairuaHeritage · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </header>
      <div className="ancestors-grid">
        {rows.map((row, gi) => (
          <div key={gi} className="ancestors-row">
            <div className="ancestors-row-label">{gi === 0 ? 'Self' : gi === 1 ? 'Parents' : gi === 2 ? 'Grandparents' : gi === 3 ? 'Great-grandparents' : 'Generation ' + gi}</div>
            <div className="ancestors-row-people">
              {row.map((person, i) => {
                if (!person) return <div key={i} className="print-card print-card-empty"><span>unknown</span></div>
                return (
                  <figure key={i} className="print-card">
                    <Thumb person={person} size={48 + 8 * (4 - gi)} />
                    <figcaption>
                      <strong>{fullName(person)}</strong>
                      <span>{lifespan(person)}</span>
                    </figcaption>
                  </figure>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function BookPages({ people }) {
  const list = people || []
  return (
    <section className="print-content print-book" aria-hidden="true">
      <header className="print-content-header">
        <h1>Family book</h1>
        <p>TheWairuaHeritage · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · {list.length} family members</p>
      </header>
      <div className="book-grid">
        {list.map(person => (
          <article className="book-entry" key={person.id}>
            <Thumb person={person} size={96} />
            <div className="book-entry-body">
              <h2>{fullName(person)}</h2>
              <div className="book-entry-dates">{lifespan(person)}{person.gender && person.gender !== 'unknown' ? ' · ' + person.gender : ''}</div>
              {person.occupation && <div className="book-entry-note">{person.occupation}</div>}
              {person.birthPlace && <div className="book-entry-note">Born: {person.birthPlace}</div>}
              {person.deathPlace && <div className="book-entry-note">Died: {person.deathPlace}</div>}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default function PrintView({ individuals, families, onSwitchView, currentUser }) {
  const [mode, setMode] = useState('config') // config | chart | book
  const stats = { people: individuals.size, families: families.size }

  const anchorId = currentUser?.individual_id || null
  const chart = useMemo(() => buildAncestorChart(individuals, anchorId, 4), [individuals, anchorId])
  const book = useMemo(() => buildRelatives(individuals, anchorId, 80), [individuals, anchorId])

  // Print once the print view is mounted
  useEffect(() => {
    if (mode !== 'config') {
      const title = mode === 'book' ? 'TheWairuaHeritage — Family book' : 'TheWairuaHeritage — Family chart'
      document.title = title
      const t = setTimeout(() => window.print(), 120)
      return () => clearTimeout(t)
    }
  }, [mode])

  // Printing screen renders only the printable section; config is hidden in print media
  return (
    <div className={`view-page print-page print-mode-${mode}`}>
      {/* Print-only content */}
      {mode === 'chart' && <PhotoChart people={chart} />}
      {mode === 'book' && <BookPages people={book} />}

      {/* Config screen (hidden in print) */}
      {mode === 'config' && (
        <div className="print-config">
          <div className="view-container">
            <div className="view-header">
              <div>
                <h1>Print charts &amp; books</h1>
                <p className="view-sub">Create print-ready family tree charts and books.</p>
              </div>
              <div>
                <button className="btn btn-primary" onClick={() => setMode('chart')}>
                  <i className="fas fa-print"></i> Print all
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
                    <p>Ancestor chart with photos — four generations from {anchorId ? 'Simon Gichuki Wairua' : 'the chosen tree'}.</p>
                    <button className="btn btn-sm btn-primary" onClick={() => setMode('chart')}>
                      <i className="fas fa-print"></i> Print chart
                    </button>
                  </div>
                </div>

                <div className="print-option">
                  <div className="print-option-icon"><i className="fas fa-book"></i></div>
                  <div className="print-option-body">
                    <h3>Family book</h3>
                    <p>Photo book of the closest family: {book.length} relatives, their dates, places and occupations.</p>
                    <button className="btn btn-sm btn-primary" onClick={() => setMode('book')}>
                      <i className="fas fa-print"></i> Print book
                    </button>
                  </div>
                </div>

                <div className="print-option">
                  <div className="print-option-icon"><i className="fas fa-file-pdf"></i></div>
                  <div className="print-option-body">
                    <h3>Download PDF</h3>
                    <p>Export the booklet to PDF for archiving — choose “Save as PDF” in the print dialog.</p>
                    <button className="btn btn-sm btn-primary" onClick={() => setMode('book')}>
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
                  <strong>{chart.length}</strong>
                  <span>Generations charted</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
