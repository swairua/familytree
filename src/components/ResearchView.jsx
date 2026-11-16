import React, { useState, useMemo, useEffect, useCallback } from 'react'
import PersonAvatar from './PersonAvatar'
import { cleanName } from '../utils/cleanName'
import { aiSearch, fetchFsStatus, fsConnectUrl, fsDisconnect, fsSearch } from '../utils/api'
import '../styles/research.css'

function ResearchView({ individuals, onSelectPerson }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [place, setPlace] = useState('')
  const [keywords, setKeywords] = useState('')
  const [exact, setExact] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [aiQuery, setAiQuery] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiText, setAiText] = useState('')

  // FamilySearch link (per member OAuth) + search mode toggle
  const [fsStatus, setFsStatus] = useState(null)
  const [fsLoaded, setFsLoaded] = useState(false)
  const [fsMode, setFsMode] = useState(false)
  const [fsResults, setFsResults] = useState([])
  const [fsLoading, setFsLoading] = useState(false)
  const [fsError, setFsError] = useState('')
  const [fsNotice, setFsNotice] = useState('')

  const loadFsStatus = useCallback(async () => {
    try {
      const res = await fetchFsStatus()
      setFsStatus(res && res.ok ? res : null)
    } catch {
      setFsStatus(null)
    } finally {
      setFsLoaded(true)
    }
  }, [])

  useEffect(() => { loadFsStatus() }, [loadFsStatus])

  // Handle OAuth return: /?view=research&fs=connected and ?fs=error&msg=...
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      if (p.get('fs') === 'connected') setFsNotice('FamilySearch account linked.')
      if (p.get('fs') === 'error') setFsError(p.get('msg') || 'FamilySearch sign-in failed.')
    } catch { /* ignore */ }
  }, [])

  const handleFsDisconnect = async () => {
    setFsError('')
    setFsNotice('')
    try {
      await fsDisconnect()
      setFsNotice('FamilySearch account unlinked.')
      setFsMode(false)
      setFsResults([])
      loadFsStatus()
    } catch {
      setFsError('Could not unlink — try again.')
    }
  }

  const runFsSearch = useCallback(async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    setFsLoading(true)
    setFsError('')
    setFsNotice('')
    setFsResults([])
    try {
      const res = await fsSearch({
        given: firstName.trim(),
        surname: lastName.trim(),
        birthYear: birthYear.trim(),
        place: place.trim(),
        count: 20,
      })
      if (res.ok) {
        setFsResults(res.results || [])
        setSubmitted(true)
      } else if (res.error === 'expired' || res.error === 'not_connected') {
        setFsError(res.message || 'Connect your FamilySearch account to search.')
        loadFsStatus()
      } else {
        setFsError(res.message || res.error || 'FamilySearch search failed.')
      }
    } catch (err) {
      setFsError(err.message || 'FamilySearch search failed.')
    } finally {
      setFsLoading(false)
    }
  }, [firstName, lastName, birthYear, place, loadFsStatus])

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
      if (fn && !(exact ? given === fn : given.includes(fn) || name.includes(fn))) continue
      if (ln && !(exact ? surname === ln : surname.includes(ln) || name.includes(ln))) continue
      if (by) {
        const y = String(p.birthYear ?? ((p.birthDate || '').match(/\d{4}/) || [''])[0] ?? '')
        if (!y.includes(by)) continue
      }
      if (pl) {
        const bp = (p.birthPlace || '').toLowerCase()
        if (!(exact ? bp === pl : bp.includes(pl))) continue
      }
      if (kw) {
        const hay = `${p.name} ${p.birthPlace} ${p.occupation} ${p.notes || ''}`.toLowerCase()
        if (!(exact ? hay.includes(kw) : hay.includes(kw))) continue
      }
      out.push(p)
    }
    return out.slice(0, 80)
  }, [individuals, firstName, lastName, birthYear, place, keywords, exact, submitted])

  const handleAiSearch = async (e) => {
    e.preventDefault()
    if (!aiQuery.trim()) return
    setAiLoading(true)
    setAiError('')
    setAiText('')
    try {
      const prompt = `Extract search filters from this request: "${aiQuery}". Reply ONLY with JSON: {"firstName":"","lastName":"","birthYear":"","place":"","keywords":""}.`
      const res = await aiSearch(prompt)
      let parsed = null
      try {
        const m = (res.text || '').match(/\{[\s\S]*\}/)
        parsed = m ? JSON.parse(m[0]) : null
      } catch {}
      if (parsed) {
        setFirstName(String(parsed.firstName || ''))
        setLastName(String(parsed.lastName || ''))
        setBirthYear(parsed.birthYear != null ? String(parsed.birthYear) : '')
        setPlace(String(parsed.place || ''))
        setKeywords(Array.isArray(parsed.keywords) ? parsed.keywords.filter(Boolean).join(' ') : String(parsed.keywords || ''))
        setSubmitted(true)
      } else {
        setAiText(res.text || 'No filters extracted.')
      }
    } catch (err) {
      setAiError(err.message)
    } finally {
      setAiLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    if (fsMode) {
      runFsSearch()
      return
    }
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
            <h2>Search the family tree</h2>
            <p className="research-sub">Find people in your records — birth, marriage, death and census notes from the tree</p>
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
              <div className="research-mode-row" role="tablist" aria-label="Search source">
                <button
                  type="button"
                  role="tab"
                  aria-selected={!fsMode}
                  className={`research-mode-btn ${!fsMode ? 'active' : ''}`}
                  onClick={() => setFsMode(false)}
                >
                  <i className="fas fa-sitemap" aria-hidden="true"></i> My tree
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={fsMode}
                  className={`research-mode-btn ${fsMode ? 'active' : ''}`}
                  onClick={() => setFsMode(true)}
                  disabled={!fsStatus?.connected}
                  title={fsStatus?.connected ? 'Search the FamilySearch tree' : (fsStatus?.configured ? 'Link your FamilySearch account first (see the FamilySearch panel below)' : 'FamilySearch is not enabled on this site yet')}
                >
                  <i className="fas fa-globe" aria-hidden="true"></i> FamilySearch
                </button>
              </div>
              <div className="research-actions">
                <button type="submit" className="btn btn-primary" disabled={fsMode && fsLoading}>
                  {fsMode ? (fsLoading ? 'Searching...' : 'Search FamilySearch') : 'Search'}
                </button>
                <button type="button" className="btn" onClick={handleClear}>Clear form</button>
              </div>
            </form>

            <div className="research-ai">
              <h3>AI assistant (Groq)</h3>
              <form onSubmit={handleAiSearch} className="research-ai-form">
                <input
                  value={aiQuery}
                  onChange={e => setAiQuery(e.target.value)}
                  placeholder='e.g. "find people born in Nyeri in 1978"'
                />
                <button type="submit" className="btn btn-accent" disabled={aiLoading}>
                  {aiLoading ? 'Thinking...' : 'Ask AI'}
                </button>
              </form>
              {aiError && <p className="research-ai-error">{aiError}</p>}
              {aiText && <p className="research-ai-text">{aiText}</p>}
              <p className="research-ai-hint">
                AI fills the search form for you. Set your Groq key in api/config.local.php.
              </p>
            </div>

            <div className="research-fs">
              <h3>FamilySearch records</h3>
              {!fsLoaded && <p className="research-ai-hint">Checking FamilySearch...</p>}
              {fsLoaded && !fsStatus?.configured && (
                <p className="research-ai-hint">Not enabled on this site yet. The administrator can request a free FamilySearch app key and register the callback URL — see <code>docs/familysearch.md</code>.</p>
              )}
              {fsLoaded && fsStatus?.configured && !fsStatus?.connected && (
                <>
                  <p className="research-ai-hint">Link your FamilySearch account — read-only search of the shared family tree using your own consent and your own account.</p>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => { window.location.href = fsConnectUrl() }}>
                    <i className="fas fa-link" aria-hidden="true"></i> Connect FamilySearch
                  </button>
                </>
              )}
              {fsLoaded && fsStatus?.connected && (
                <div className="fs-connected">
                  <span className="fs-badge"><i className="fas fa-circle-check" aria-hidden="true"></i> Linked{fsStatus.env === 'beta' ? ' (beta)' : ''}</span>
                  <button type="button" className="btn btn-sm btn-outline" onClick={handleFsDisconnect}>
                    <i className="fas fa-link-slash" aria-hidden="true"></i> Unlink
                  </button>
                </div>
              )}
              {fsNotice && <p className="research-fs-notice" role="status">{fsNotice}</p>}
              {fsError && <p className="research-ai-error" role="alert">{fsError}</p>}
            </div>
          </section>

          <section className="research-card research-info-card">
            <div className="research-info-img" aria-hidden="true">
              <i className="fas fa-scroll"></i>
            </div>
            <h2>Family records</h2>
            <p>
              Search everyone we have on file — names, birth years, places, occupations and notes.
              Filters run against the people in your tree; use the AI assistant to fill the form from a
              plain-English request like &quot;everyone born in Nyeri before 1960&quot;.
            </p>
            <p className="research-ai-hint" style={{ marginTop: 12 }}>
              Historical record collections (census, voter registers, BMD) are not connected yet.
              Ask the site administrator about linking a FamilySearch account.
            </p>
          </section>
        </div>

        {submitted && fsMode && (
          <section className="research-results">
            <h3>FamilySearch results ({fsResults.length})</h3>
            {fsLoading ? (
              <div className="sm-empty"><i className="fas fa-spinner fa-spin"></i> Searching FamilySearch...</div>
            ) : fsResults.length === 0 ? (
              <p className="research-empty">No matches in the FamilySearch tree — try broader terms or fewer filters.</p>
            ) : (
              <div className="research-result-list">
                {fsResults.map(p => {
                  const male = /male/i.test(p.gender) && !/female/i.test(p.gender)
                  const female = /female/i.test(p.gender)
                  return (
                    <a
                      key={p.id || p.name}
                      className="research-result fs-result"
                      href={p.ark ? `${p.ark}?context=details` : '#'}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className={`fs-gender ${male ? 'm' : female ? 'f' : 'u'}`} aria-hidden="true">
                        <i className={`fas ${male ? 'fa-mars' : female ? 'fa-venus' : 'fa-user'}`}></i>
                      </span>
                      <div className="research-result-info">
                        <strong>{p.name}</strong>
                        <span>
                          {p.birthDate ? `Born ${p.birthDate}` : (p.birthYear ? `Born ${p.birthYear}` : 'Birth unknown')}
                          {p.birthPlace ? ` in ${p.birthPlace}` : ''}
                          {p.deathYear ? ` · died ${p.deathYear}` : ''}
                        </span>
                        {p.ark && <span className="fs-ark-link">View in FamilySearch <i className="fas fa-arrow-up-right-from-square"></i></span>}
                      </div>
                    </a>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {submitted && !fsMode && (
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
