import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchDnaList, dnaKitCreate, dnaKitUpdate, dnaKitToggle, dnaKitDelete,
  dnaMatchAdd, dnaMatchDelete,
} from '../utils/api'
import '../styles/dna.css'
import '../styles/viewpages.css'
const PROVIDERS = [
  { id: 'myheritage_dna', label: 'MyHeritage DNA' },
  { id: 'ancestrydna', label: 'AncestryDNA' },
  { id: '23andme', label: '23andMe' },
  { id: 'familytreedna', label: 'FamilyTreeDNA' },
  { id: 'livingdna', label: 'Living DNA' },
  { id: 'other', label: 'Other' },
]
const providerLabel = (id) => (PROVIDERS.find(p => p.id === id) || PROVIDERS[PROVIDERS.length - 1]).label
const providerIcon = (id) => ({
  myheritage_dna: 'fa-home',
  ancestrydna: 'fa-tree',
  '23andme': 'fa-heart-pulse',
  familytreedna: 'fa-people-arrows',
  livingdna: 'fa-leaf',
  other: 'fa-dna',
}[id] || 'fa-dna')

function DnaMatchesView({ currentUser, onSwitchView }) {
  const [kits, setKits] = useState([])
  const [matches, setMatches] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [showKitForm, setShowKitForm] = useState(false)
  const [kitProvider, setKitProvider] = useState('myheritage_dna')
  const [kitDate, setKitDate] = useState('')
  const [kitVisible, setKitVisible] = useState(true)

  const [matchKitId, setMatchKitId] = useState('')
  const [matchName, setMatchName] = useState('')
  const [matchProvider, setMatchProvider] = useState('myheritage_dna')
  const [matchRelationship, setMatchRelationship] = useState('')
  const [matchSurname, setMatchSurname] = useState('')
  const [matchCm, setMatchCm] = useState('')
  const [matchNotes, setMatchNotes] = useState('')
  const [showMatchForm, setShowMatchForm] = useState(false)
  const [busy, setBusy] = useState(false)

  const myId = currentUser?.id
  const myKits = useMemo(() => kits.filter(k => k.owner_id === myId), [kits, myId])
  const canAddMatch = myKits.length > 0 || isAdmin

  const showNotice = useCallback((text) => {
    setNotice(text)
    window.clearTimeout(showNotice._t)
    showNotice._t = window.setTimeout(() => setNotice(''), 4000)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchDnaList()
      if (!res.ok) {
        setError(res.error || 'Could not load the family matches. Are you signed in?')
        return
      }
      setKits(res.kits || [])
      setMatches(res.matches || [])
      setIsAdmin(!!res.isAdmin)
      if (!matchKitId && (res.kits || []).some(k => k.owner_id === currentUser?.id)) {
        setMatchKitId(String((res.kits || []).find(k => k.owner_id === currentUser?.id).id))
      }
    } catch (err) {
      setError(err.message || 'Could not load the family matches.')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id])

  useEffect(() => { load() }, [load])

  const addKit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await dnaKitCreate({ provider: kitProvider, result_date: kitDate || null, visible_to_members: kitVisible })
      if (!res.ok) { setError(res.error || 'Could not add the kit'); return }
      setKitProvider('myheritage_dna')
      setKitDate('')
      setKitVisible(true)
      setShowKitForm(false)
      showNotice('Kit added. Add it to the family list proudly â€” or hide it, it\'s your call.')
      await load()
    } finally { setBusy(false) }
  }

  const toggleKit = async (id) => {
    setBusy(true)
    try { await dnaKitToggle(id); await load() } catch { /* ignore */ } finally { setBusy(false) }
  }

  const removeKit = async (id) => {
    if (!window.confirm('Delete this kit and all of its matches? This cannot be undone.')) return
    setBusy(true)
    try { await dnaKitDelete(id); await load() } catch { /* ignore */ } finally { setBusy(false) }
  }

  const addMatch = async (e) => {
    e.preventDefault()
    if (!matchKitId) { setError('Pick one of your kits first.'); return }
    if (!matchName.trim()) { setError('Give the match a name (e.g. "Unknown Wairua cousin").'); return }
    setBusy(true)
    setError('')
    try {
      const res = await dnaMatchAdd({
        kit_id: Number(matchKitId),
        match_name: matchName.trim(),
        provider: matchProvider,
        predicted_relationship: matchRelationship.trim(),
        shared_surname: matchSurname.trim(),
        shared_cm: matchCm === '' ? null : Number(matchCm),
        notes: matchNotes.trim(),
      })
      if (!res.ok) { setError(res.error || 'Could not add the match'); return }
      setMatchName('')
      setMatchRelationship('')
      setMatchSurname('')
      setMatchCm('')
      setMatchNotes('')
      setShowMatchForm(false)
      showNotice('Match added.')
      await load()
    } finally { setBusy(false) }
  }

  const removeMatch = async (id) => {
    if (!window.confirm('Delete this match?')) return
    setBusy(true)
    try { await dnaMatchDelete(id); await load() } catch { /* ignore */ } finally { setBusy(false) }
  }

  const kitById = useMemo(() => new Map(kits.map(k => [k.id, k])), [kits])
  const grouped = useMemo(() => {
    const byKit = new Map()
    for (const m of matches) {
      const arr = byKit.get(m.kit_id) || []
      arr.push(m)
      byKit.set(m.kit_id, arr)
    }
    return [...byKit.entries()].sort((a, b) => (a[0] || 0) - (b[0] || 0))
  }, [matches])

  return (
    <div className="view-page dna-page">
      <div className="view-container dna-container">
        <div className="view-header">
          <div>
            <h1>Family DNA matches</h1>
            <p className="view-sub">Who has tested, and the matches worth knowing about</p>
          </div>
          <button className="btn btn-primary" onClick={() => onSwitchView && onSwitchView('dna')}>
            <i className="fas fa-dna" aria-hidden="true"></i> DNA overview
          </button>
        </div>

        <div className="dna-privacy-banner" role="note">
          <i className="fas fa-shield-halved" aria-hidden="true"></i>
          <span><strong>Visible to signed-in family members only.</strong> Your raw DNA never enters this site â€” only the notes and match names you type in. Hide any kit or delete it any time.</span>
        </div>

        {error && <p className="album-error" role="alert">{error}</p>}
        {notice && <div className="album-notice" role="status">{notice}</div>}

        {loading ? (
          <div className="sm-empty"><i className="fas fa-spinner fa-spin"></i> Loading the family matches...</div>
        ) : (
          <>
            {/* Kits */}
            <section className="view-card dna-card">
              <div className="dna-card-head">
                <h2><i className="fas fa-vial" aria-hidden="true"></i> Kits in the family <span className="dna-count">{kits.length}</span></h2>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowKitForm(v => !v)}>
                  <i className="fas fa-plus" aria-hidden="true"></i> Add my kit
                </button>
              </div>

              {showKitForm && (
                <form className="album-form dna-inline-form" onSubmit={addKit}>
                  <label>
                    Provider
                    <select value={kitProvider} onChange={e => setKitProvider(e.target.value)}>
                      {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </label>
                  <label>
                    Results received (optional)
                    <input type="date" value={kitDate} onChange={e => setKitDate(e.target.value)} />
                  </label>
                  <label className="dna-check">
                    <input type="checkbox" checked={kitVisible} onChange={e => setKitVisible(e.target.checked)} />
                    Visible to other members (uncheck to keep it hidden)
                  </label>
                  <div className="album-form-actions">
                    <button type="submit" className="btn btn-sm btn-primary" disabled={busy}>Add kit</button>
                    <button type="button" className="btn btn-sm" onClick={() => setShowKitForm(false)}>Cancel</button>
                  </div>
                </form>
              )}

              {kits.length === 0 ? (
                <div className="photos-empty">
                  <i className="fas fa-vial"></i>
                  <h2>No kits yet</h2>
                  <p>Be the first â€” add your kit so cousins know who has been tested.</p>
                </div>
              ) : (
                <div className="dna-kit-list">
                  {kits.map(kit => {
                    const mine = kit.owner_id === myId
                    const canManage = mine || isAdmin
                    return (
                      <div className={`dna-kit ${mine ? 'mine' : ''}`} key={kit.id}>
                        <span className="dna-kit-icon"><i className={`fas ${providerIcon(kit.provider)}`} aria-hidden="true"></i></span>
                        <div className="dna-kit-main">
                          <div className="dna-kit-top">
                            <strong>{kit.owner_name}</strong>
                            <span className="dna-provider">{providerLabel(kit.provider)}</span>
                            {kit.result_date
                              ? <span className="dna-status ok"><i className="fas fa-circle-check"></i> Results {kit.result_date}</span>
                              : <span className="dna-status pending"><i className="fas fa-hourglass-half"></i> Awaiting results</span>}
                          </div>
                          <div className="dna-kit-sub">
                            {kit.visible_to_members ? 'Visible to members' : 'Hidden â€” only you' + (isAdmin ? ' and admins' : '')}
                            {mine && <span className="dna-you"> Â· yours</span>}
                          </div>
                        </div>
                        {canManage && (
                          <div className="dna-kit-actions">
                            <button type="button" className="btn btn-sm" onClick={() => toggleKit(kit.id)} title={kit.visible_to_members ? 'Hide from members' : 'Show to members'}>
                              <i className={`fas ${kit.visible_to_members ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                            <button type="button" className="btn btn-sm btn-delete" onClick={() => removeKit(kit.id)} title="Delete kit and matches">
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Matches */}
            <section className="view-card dna-card">
              <div className="dna-card-head">
                <h2><i className="fas fa-people-arrows" aria-hidden="true"></i> Notable matches <span className="dna-count">{matches.length}</span></h2>
                {canAddMatch && (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowMatchForm(v => !v)}>
                    <i className="fas fa-plus" aria-hidden="true"></i> Add a match
                  </button>
                )}
              </div>

              {showMatchForm && canAddMatch && (
                <form className="album-form dna-inline-form" onSubmit={addMatch}>
                  <label>
                    From kit
                    <select value={matchKitId} onChange={e => { const k = kits.find(x => String(x.id) === e.target.value); setMatchKitId(e.target.value); setMatchProvider(k ? k.provider : 'myheritage_dna') }}>
                      {myKits.map(k => <option key={k.id} value={k.id}>Your kit â€” {providerLabel(k.provider)}</option>)}
                      {isAdmin && kits.filter(k => k.owner_id !== myId).map(k => <option key={k.id} value={k.id}>Admin: {k.owner_name} â€” {providerLabel(k.provider)}</option>)}
                    </select>
                  </label>
                  <label>Match name (as shown in the kit)<input type="text" value={matchName} onChange={e => setMatchName(e.target.value)} maxLength={255} placeholder='e.g. "Unknown Wairua cousin #3"' required /></label>
                  <div className="dna-form-grid">
                    <label>Predicted relationship<input type="text" value={matchRelationship} onChange={e => setMatchRelationship(e.target.value)} maxLength={120} placeholder="e.g. 2nd cousin" /></label>
                    <label>Shared surname(s)<input type="text" value={matchSurname} onChange={e => setMatchSurname(e.target.value)} maxLength={120} placeholder="e.g. Wairua" /></label>
                    <label>Shared DNA (cM)<input type="number" step="0.1" min="0" max="7400" value={matchCm} onChange={e => setMatchCm(e.target.value)} placeholder="e.g. 350" /></label>
                  </div>
                  <label>Notes (optional)<textarea rows={2} value={matchNotes} onChange={e => setMatchNotes(e.target.value)} maxLength={500} placeholder="Only what you'd want cousins to see â€” no private life details" /></label>
                  <div className="album-form-actions">
                    <button type="submit" className="btn btn-sm btn-primary" disabled={busy || !matchName.trim()}>Add match</button>
                    <button type="button" className="btn btn-sm" onClick={() => setShowMatchForm(false)}>Cancel</button>
                  </div>
                </form>
              )}

              {matches.length === 0 ? (
                <div className="photos-empty">
                  <i className="fas fa-people-arrows"></i>
                  <h2>No notable matches yet</h2>
                  <p>{canAddMatch ? 'Add the matches from your kit â€” names, shared surnames, cM â€” so the family can start triangulating.' : 'Add your kit first, then its matches.'}</p>
                </div>
              ) : (
                grouped.map(([kitId, kitMatches]) => (
                  <div className="dna-match-group" key={kitId}>
                    <div className="dna-match-kit-label">
                      <i className={`fas ${providerIcon(kitById.get(kitId)?.provider)}`} aria-hidden="true"></i>
                      <span>{kitById.get(kitId)?.owner_name || 'Unknown'} â€” {providerLabel(kitById.get(kitId)?.provider)}</span>
                    </div>
                    <div className="dna-match-list">
                      {kitMatches.map(m => {
                        const mine = m.owner_id === myId
                        return (
                          <div className="dna-match" key={m.id}>
                            <div className="dna-match-main">
                              <strong>{m.match_name}</strong>
                              <div className="dna-match-meta">
                                {m.predicted_relationship && <span className="dna-tag">{m.predicted_relationship}</span>}
                                {m.shared_surname && <span className="dna-tag orange"><i className="fas fa-tag"></i> {m.shared_surname}</span>}
                                {m.shared_cm != null && <span className="dna-tag green">{m.shared_cm} cM</span>}
                              </div>
                              {m.notes && <p className="dna-match-notes">{m.notes}</p>}
                            </div>
                            {(mine || isAdmin) && (
                              <button type="button" className="btn btn-sm btn-delete dna-match-del" onClick={() => removeMatch(m.id)} title="Delete this match">
                                <i className="fas fa-trash"></i>
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </section>

            <p className="dna-disclaimer">
              Match predictions come from the provider&rsquo;s database and can change; centimorgan amounts are as reported by each kit.
              The best evidence of a shared ancestor is usually several cousins triangulating the same surname line â€” usually across two different providers.
              Verify with records (that&rsquo;s what the family tree is for).
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default DnaMatchesView
