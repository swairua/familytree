import React, { useState, useMemo } from 'react'
import PersonAvatar from './PersonAvatar'
import { cleanName } from '../utils/cleanName'
import '../styles/research.css'

function ResearchView({ individuals, onSelectPerson }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [place, setPlace] = useState('')
  const [keywords, setKeywords] = useState('')
  const [exact, setExact] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const results = useMemo(() => {
    if (!submitted) return []
    const fn = firstName.trim().toLowerCase()
    const ln = lastName.trim().toLowerCase()
    const by = birthYear.trim()
    const pl = place.trim().toLowerCase()
    const kw = keywords.trim().toLowerCase()

    const match = (val, q) => {
      if (!q) return true
      const v = (val || '').toLowerCase()
      return exact ? v === q : v.includes(q)
    }

    const out = []
    for (const p of individuals.values()) {
      const name = (p.name || '').toLowerCase()
      const given = (p.givenName || '').toLowerCase()
      const surname = (p.surname || '').toLowerCase()
      if (fn && !(exact ? given === fn : given.includes(fn) || name.includes(fn))) return
      if (ln && !(exact ? surname === ln : surname.includes(ln) || name.includes(ln))) return
      if (by) {
        const y = (p.birthYear || '').toString()
        if (!y.includes(by)) return
      }
      if (pl) {
        const bp = (p.birthPlace || '').toLowerCase()
        if (!(exact ? bp === pl : bp.includes(pl))) return
      }
      if (kw) {
        const hay = `${p.name} ${p.birthPlace} ${p.occupation} ${p.notes || ''}`.toLowerCase()
        if (!(exact ? hay.includes(kw) : hay.includes(kw))) return
      }
      out.push(p)
    }
    return out.slice(0, 80)
  }, [individuals, firstName, lastName, birthYear, place, keywords, exact, submitted])

  const handleSearch = (e) => {
    e.preventDefault()
    setSubmitted(true)
  }

  const handleClear = () => {
    setFirstName(''); setLastName(''); setBirthYear(''); setPlace(''); setKeywords(''); setExact(false); setSubmitted(false)
  }

  return (
    <div className="research-view">
      <div className="research-container">
        <div className="research-grid">
          <section className="research-card research-form-card">
            <h2>Search records</h2>
            <p className="research-sub">Find ancestors in census &amp; voter lists</p>
            <form onSubmit={handleSearch}>
              <div className="research-row">
                <label>First name</label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="e.g. Simon" />
              </div>
              <div className="research-row">
                <label>Last name</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="e.g. Wairua" />
              </div>
              <div className="research-row two">
                <div>
                  <label>Birth year</label>
                  <input value={birthYear} onChange={e => setBirthYear(e.target.value)} placeholder="1978" />
                </div>
                <div>
                  <label>Residence / place</label>
                  <input value={place} onChange={e => setPlace(e.target.value)} placeholder="Nyeri" />
                </div>
              </div>
              <div className="research-row">
                <label>Additional keywords</label>
                <textarea value={keywords} onChange={e => setKeywords(e.target.value)} rows={3} placeholder="occupation, notes..." />
              </div>
              <label className="research-check">
                <input type="checkbox" checked={exact} onChange={e => setExact(e.target.checked)} />
                Match all terms exactly
              </label>
              <div className="research-actions">
                <button type="submit" className="btn btn-primary">Search</button>
                <button type="button" className="btn" onClick={handleClear}>Clear form</button>
              </div>
            </form>
          </section>

          <section className="research-card research-info-card">
            <div className="research-info-img" aria-hidden="true">
              <i className="fas fa-scroll"></i>
            </div>
            <h2>Census &amp; Voter Lists</h2>
            <p>
              Census records capture snapshots of families at a moment in time — names, ages, occupations and residences.
              Use the search to find matching individuals in your family tree and discover new relatives.
            </p>
            <a href="#" className="research-readmore" onClick={e => e.preventDefault()}>Read more</a>
          </section>
        </div>

        {submitted && (
          <section className="research-results">
            <h3>Results ({results.length})</h3>
            {results.length === 0 ? (
              <p className="research-empty">No matching records found.</p>
            ) : (
              <div className="research-result-list">
                {results.map(p => (
                  <div key={p.id} className="research-result" onClick={() => onSelectPerson(p.id)}>
                    <PersonAvatar person={p} className="research-avatar" />
                    <div className="research-result-info">
                      <strong>{cleanName(p.name)}</strong>
                      <span>{p.birthDate ? `Born ${p.birthDate}` : ''}{p.birthPlace ? ` in ${p.birthPlace}` : ''}</span>
                      {p.occupation && <span className="research-occ">{p.occupation}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

export default ResearchView