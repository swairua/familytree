import React, { useState, useEffect, useRef } from 'react'
import { uploadPhoto } from '../utils/api'
import { cleanName, getInitials } from '../utils/cleanName'

export default function PersonSidebar({
  person,
  individuals,
  families,
  onClose,
  onSelectPerson,
  onUpdatePerson,
  initialMode = 'profile',
}) {
  const [mode, setMode] = useState(initialMode)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const resetForm = () => {
    if (!person) return
    setForm({
      givenName: person.givenName || '',
      surname: person.surname || '',
      prefix: person.prefix || '',
      suffix: person.suffix || '',
      nickname: person.nickname || '',
      gender: person.gender || 'unknown',
      birthDate: person.birthDate || '',
      birthPlace: person.birthPlace || '',
      deathDate: person.deathDate || '',
      deathPlace: person.deathPlace || '',
      occupation: person.occupation || '',
      education: person.education || '',
      religion: person.religion || '',
      photo: person.photo || '',
      notes: Array.isArray(person.notes) ? person.notes.join('\n') : (person.notes || ''),
    })
    setError(null)
  }

  useEffect(() => {
    resetForm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person?.id])

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode, person?.id])

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const res = await uploadPhoto(person.id, file)
      setForm(f => ({ ...f, photo: res.file }))
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await onUpdatePerson(person.id, {
        givenName: form.givenName.trim(),
        surname: form.surname.trim(),
        prefix: form.prefix.trim(),
        suffix: form.suffix.trim(),
        nickname: form.nickname.trim(),
        gender: form.gender,
        birthDate: form.birthDate.trim(),
        birthPlace: form.birthPlace.trim(),
        deathDate: form.deathDate.trim(),
        deathPlace: form.deathPlace.trim(),
        occupation: form.occupation.trim(),
        education: form.education.trim(),
        religion: form.religion.trim(),
        photo: form.photo.trim(),
        notes: form.notes.split('\n').map(s => s.trim()).filter(Boolean),
      })
      setMode('profile')
    } catch (err) {
      setError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const fullName = cleanName(person?.name || `${form.givenName || ''} ${form.surname || ''}`)
  const initials = getInitials(fullName || '?')

  const renderAvatar = () => {
    if (person?.photo) {
      return (
        <img
          className="sidepanel-avatar-img"
          src={fullName ? `/api/photo.php?file=${encodeURIComponent(person.photo)}` : '/api/photo.php'}
          alt={fullName}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      )
    }
    return <div className="sidepanel-avatar-initials">{initials}</div>
  }

  return (
    <aside className="tree-sidepanel" aria-label="Selected person">
      <div className="sidepanel-topbar">
        <button className="sidepanel-close" onClick={onClose} title="Close">
          <i className="fas fa-chevron-left"></i>
        </button>
      </div>

      <div className="sidepanel-header">
        <div className="sidepanel-avatar">
          {renderAvatar()}
          <button className="sidepanel-avatar-edit" onClick={() => fileRef.current?.click()} title="Add photo">
            <i className="fas fa-camera"></i>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="sidepanel-file" onChange={handleUpload} />
        </div>
        <div className="sidepanel-heading">
          <h2>{fullName || 'Unknown'}</h2>
          <p>{person?.birthDate ? person.birthDate : 'Unknown date'}</p>
          {person?.deathDate && <p className="sidepanel-death">Deceased {person.deathDate}</p>}
        </div>
      </div>

      <div className="sidepanel-actions">
        <button className={`sidepanel-action ${mode === 'profile' ? 'active' : ''}`} onClick={() => setMode('profile')}>
          <i className="fas fa-address-card"></i>
          <span>Profile</span>
        </button>
        <button className={`sidepanel-action ${mode === 'edit' ? 'active' : ''}`} onClick={() => setMode('edit')}>
          <i className="fas fa-pen"></i>
          <span>Edit</span>
        </button>
        <button className="sidepanel-action" onClick={() => setMode('facts')}>
          <i className="fas fa-list-ul"></i>
          <span>Facts</span>
        </button>
        <a className="sidepanel-action" href="#" onClick={e => e.preventDefault()}>
          <i className="fas fa-search"></i>
          <span>Discover</span>
        </a>
      </div>

      {mode === 'profile' && (
        <div className="sidepanel-body">
          <div className="detail-row"><span className="detail-label">Given name</span><span>{person?.givenName || '—'}</span></div>
          <div className="detail-row"><span className="detail-label">Surname</span><span>{person?.surname || '—'}</span></div>
          <div className="detail-row"><span className="detail-label">Gender</span><span>{person?.gender || '—'}</span></div>
          <div className="detail-row"><span className="detail-label">Birth</span><span>{person?.birthDate || '—'}</span></div>
          <div className="detail-row"><span className="detail-label">Birth place</span><span>{person?.birthPlace || '—'}</span></div>
          {person?.deathDate && <div className="detail-row"><span className="detail-label">Death</span><span>{person.deathDate}</span></div>}
          {person?.deathPlace && <div className="detail-row"><span className="detail-label">Death place</span><span>{person.deathPlace}</span></div>}
          {person?.occupation && <div className="detail-row"><span className="detail-label">Occupation</span><span>{person.occupation}</span></div>}
          {person?.education && <div className="detail-row"><span className="detail-label">Education</span><span>{person.education}</span></div>}
          {person?.religion && <div className="detail-row"><span className="detail-label">Religion</span><span>{person.religion}</span></div>}

          {families && families.size > 0 && (
            <div className="sidepanel-section">
              <h3>Family</h3>
              <ul className="sidepanel-family-list">
                {(person?.parents || []).map(pid => {
                  const p = individuals.get(pid)
                  if (!p) return null
                  return (
                    <li key={pid}>
                      <i className="fas fa-male"></i>
                      <button className="sidepanel-family-link" onClick={() => onSelectPerson(pid)}>{cleanName(p.name)}</button>
                    </li>
                  )
                })}
                {(person?.spouses || []).map(sid => {
                  const p = individuals.get(sid)
                  if (!p) return null
                  return (
                    <li key={sid}>
                      <i className="fas fa-heart"></i>
                      <button className="sidepanel-family-link" onClick={() => onSelectPerson(sid)}>{cleanName(p.name)}</button>
                    </li>
                  )
                })}
                {(person?.children || []).map(cid => {
                  const p = individuals.get(cid)
                  if (!p) return null
                  return (
                    <li key={cid}>
                      <i className="fas fa-child"></i>
                      <button className="sidepanel-family-link" onClick={() => onSelectPerson(cid)}>{cleanName(p.name)}</button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {mode === 'edit' && (
        <form className="sidepanel-body sidepanel-form" onSubmit={handleSave}>
          <div className="edit-field"><label htmlFor="edit-givenName">Given name</label><input id="edit-givenName" value={form.givenName} onChange={e => update('givenName', e.target.value)} /></div>
          <div className="edit-field"><label htmlFor="edit-surname">Surname</label><input id="edit-surname" value={form.surname} onChange={e => update('surname', e.target.value)} /></div>
          <div className="edit-field"><label htmlFor="edit-prefix">Prefix</label><input id="edit-prefix" value={form.prefix} onChange={e => update('prefix', e.target.value)} /></div>
          <div className="edit-field"><label htmlFor="edit-suffix">Suffix</label><input id="edit-suffix" value={form.suffix} onChange={e => update('suffix', e.target.value)} /></div>
          <div className="edit-field"><label htmlFor="edit-nickname">Nickname</label><input id="edit-nickname" value={form.nickname} onChange={e => update('nickname', e.target.value)} /></div>
          <div className="edit-field"><label htmlFor="edit-gender">Gender</label><select id="edit-gender" value={form.gender} onChange={e => update('gender', e.target.value)}><option value="male">Male</option><option value="female">Female</option><option value="unknown">Unknown</option></select></div>
          <div className="edit-field"><label htmlFor="edit-birthDate">Birth date</label><input id="edit-birthDate" value={form.birthDate} onChange={e => update('birthDate', e.target.value)} /></div>
          <div className="edit-field"><label htmlFor="edit-birthPlace">Birth place</label><input id="edit-birthPlace" value={form.birthPlace} onChange={e => update('birthPlace', e.target.value)} /></div>
          <div className="edit-field"><label htmlFor="edit-deathDate">Death date</label><input id="edit-deathDate" value={form.deathDate} onChange={e => update('deathDate', e.target.value)} /></div>
          <div className="edit-field"><label htmlFor="edit-deathPlace">Death place</label><input id="edit-deathPlace" value={form.deathPlace} onChange={e => update('deathPlace', e.target.value)} /></div>
          <div className="edit-field"><label htmlFor="edit-occupation">Occupation</label><input id="edit-occupation" value={form.occupation} onChange={e => update('occupation', e.target.value)} /></div>
          <div className="edit-field"><label htmlFor="edit-education">Education</label><input id="edit-education" value={form.education} onChange={e => update('education', e.target.value)} /></div>
          <div className="edit-field"><label htmlFor="edit-religion">Religion</label><input id="edit-religion" value={form.religion} onChange={e => update('religion', e.target.value)} /></div>
          <div className="edit-field"><label htmlFor="edit-photo">Photo file</label><input id="edit-photo" value={form.photo} placeholder="e.g. 2000158.jpg" onChange={e => update('photo', e.target.value)} /></div>
          <div className="edit-field"><label htmlFor="edit-notes">Notes (one per line)</label><textarea id="edit-notes" value={form.notes} onChange={e => update('notes', e.target.value)} rows={3} /></div>

          {error && <p className="sidepanel-error">{error}</p>}

          <div className="sidepanel-form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setMode('profile')}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      )}

      {mode === 'facts' && (
        <div className="sidepanel-body">
          <h3 className="sidepanel-section-title">Facts</h3>
          <ul className="sidepanel-facts">
            <li><span className="fact-label">Name</span>{fullName}</li>
            <li><span className="fact-label">Born</span>{person?.birthDate || '—'}</li>
            {person?.birthPlace && <li><span className="fact-label">Place</span>{person.birthPlace}</li>}
            {person?.deathDate && <li><span className="fact-label">Died</span>{person.deathDate}</li>}
            {person?.deathPlace && <li><span className="fact-label">Place</span>{person.deathPlace}</li>}
            {person?.occupation && <li><span className="fact-label">Occupation</span>{person.occupation}</li>}
          </ul>
        </div>
      )}
    </aside>
  )
}
