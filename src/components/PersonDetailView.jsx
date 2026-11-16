import React, { useCallback, useEffect, useRef, useState } from 'react'
import PersonAvatar from './PersonAvatar'
import { uploadPhoto } from '../utils/api'
import { cleanName } from '../utils/cleanName'
import '../styles/viewpages.css'

const EVENT_LABELS = {
  BIRT: 'Birth', DEAT: 'Death', MARR: 'Marriage', DIV: 'Divorce', CENS: 'Census',
  RESI: 'Residence', IMMI: 'Immigration', EMIG: 'Emigration', CHR: 'Christening',
  BAPM: 'Baptism', CONF: 'Confirmation', GRAD: 'Graduation', NATU: 'Naturalization',
  PROB: 'Probate', WILL: 'Will', RETI: 'Retirement', EVEN: 'Event', BURI: 'Burial', OCCU: 'Occupation',
}

function PersonDetailView({ person, individuals, families, onSelectPerson, onBack, onUpdatePerson }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const getP = useCallback((id) => (id ? individuals?.get?.(id) : null), [individuals])

  useEffect(() => {
    setEditing(false)
    setSaveError(null)
    setForm({})
  }, [person?.id])

  if (!person) {
    return (
      <div className="view-page">
        <div className="account-container">
          <div className="view-card">
            <h2 className="account-card-title">Person not found</h2>
            <p className="settings-hint">Select another member to view details.</p>
            <button className="btn btn-primary" onClick={onBack}><i className="fas fa-arrow-left"></i> Back</button>
          </div>
        </div>
      </div>
    )
  }

  const parents = (person.parents || []).map(getP).filter(Boolean)
  const spouses = (person.spouses || []).map(getP).filter(Boolean)
  const children = (person.children || []).map(getP).filter(Boolean)
  const siblings = (person.siblings || []).map(getP).filter(Boolean)
  const events = person.events || []
  const notesArr = Array.isArray(person.notes) ? person.notes : (person.notes ? [person.notes] : [])

  const handleField = (name) => (e) => setForm(f => ({ ...f, [name]: e.target.value }))
  const startEdit = () => {
    setForm({
      givenName: person.givenName || '',
      surname: person.surname || '',
      nickname: person.nickname || '',
      gender: person.gender || 'unknown',
      birthDate: person.birthDate || '',
      birthPlace: person.birthPlace || '',
      deathDate: person.deathDate || '',
      deathPlace: person.deathPlace || '',
      burialDate: person.burialDate || '',
      burialPlace: person.burialPlace || '',
      occupation: person.occupation || '',
      education: person.education || '',
      religion: person.religion || '',
      notes: notesArr.join('\n'),
    })
    setSaveError(null)
    setEditing(true)
  }
  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await onUpdatePerson(person.id, {
        givenName: form.givenName?.trim() ?? '',
        surname: form.surname?.trim() ?? '',
        nickname: form.nickname?.trim() ?? '',
        gender: form.gender,
        birthDate: form.birthDate?.trim() ?? '',
        birthPlace: form.birthPlace?.trim() ?? '',
        deathDate: form.deathDate?.trim() ?? '',
        deathPlace: form.deathPlace?.trim() ?? '',
        burialDate: form.burialDate?.trim() ?? '',
        burialPlace: form.burialPlace?.trim() ?? '',
        occupation: form.occupation?.trim() ?? '',
        education: form.education?.trim() ?? '',
        religion: form.religion?.trim() ?? '',
        notes: (form.notes || '').split('\n').map(s => s.trim()).filter(Boolean),
      })
      setEditing(false)
    } catch (err) {
      setSaveError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleUploadPhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setSaveError(null)
    try {
      const res = await uploadPhoto(person.id, file)
      await onUpdatePerson(person.id, { photo: res.file })
    } catch (err) {
      setSaveError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      if (e.target) e.target.value = ''
    }
  }

  const renderRelationList = (title, icon, members, label) => {
    if (!members.length) return null
    return (
      <div className="profile-section">
        <h3><i className={`fas ${icon}`}></i> {title}</h3>
        <div className="family-list">
          {members.map(m => (
            <button key={m.id} className="family-member" onClick={() => onSelectPerson(m.id)}>
              <PersonAvatar person={m} className="mini-avatar" />
              <span className="member-name">{cleanName(m.name)}</span>
              <span className="member-relation">{label}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const editFields = [
    { key: 'givenName', label: 'Given name' },
    { key: 'surname', label: 'Surname' },
    { key: 'nickname', label: 'Nickname (a.k.a.)' },
    { key: 'gender', label: 'Gender', type: 'select', options: ['unknown', 'male', 'female'] },
    { key: 'birthDate', label: 'Birth date' },
    { key: 'birthPlace', label: 'Birth place' },
    { key: 'deathDate', label: 'Death date' },
    { key: 'deathPlace', label: 'Death place' },
    { key: 'burialDate', label: 'Burial date' },
    { key: 'burialPlace', label: 'Burial place' },
    { key: 'occupation', label: 'Occupation' },
    { key: 'education', label: 'Education' },
    { key: 'religion', label: 'Religion' },
  ]

  return (
    <div className="view-page">
      <div className="view-container">
        <div className="detail-topbar">
          <button className="link-button" onClick={onBack}>
            <i className="fas fa-arrow-left"></i> Back
          </button>
          <div className="detail-actions">
            {!editing && (
              <>
                <button className="btn btn-icon" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <i className="fas fa-camera"></i> {uploading ? 'Uploading…' : 'Add / change photo'}
                </button>
                <button className="btn btn-icon" onClick={startEdit} title="Edit person">
                  <i className="fas fa-pen"></i> Edit
                </button>
              </>
            )}
            {editing && (
              <button className="btn btn-icon" onClick={() => setEditing(false)} disabled={saving}>
                <i className="fas fa-times"></i> Cancel
              </button>
            )}
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleUploadPhoto} />

        {/* Hero */}
        <section className="view-card person-hero">
          <div className="person-hero-avatar-wrap">
            <PersonAvatar person={person} className="person-hero-avatar" />
          </div>
          <div className="person-hero-body">
            <h1>{editing ? 'Edit Person' : cleanName(person.name)}</h1>
            {!editing && (
              <div className="person-hero-meta">
                {person.birthDate && (
                  <span><i className="fas fa-birthday-cake"></i> Born {person.birthDate}{person.birthPlace && ` in ${person.birthPlace}`}</span>
                )}
                {person.deathDate && (
                  <span className="person-death"><i className="fas fa-cross"></i> Died {person.deathDate}{person.deathPlace && ` in ${person.deathPlace}`}</span>
                )}
                {person.gender && <span><i className="fas fa-venus-mars"></i> {person.gender[0].toUpperCase() + person.gender.slice(1)}</span>}
              </div>
            )}
          </div>
        </section>

        {editing ? (
          <section className="view-card">
            <h2 className="account-card-title">Edit details for {cleanName(person.name)}</h2>
            <div className="edit-form">
              {editFields.map(f => (
                <div className="edit-field" key={f.key}>
                  <label htmlFor={`edit-${f.key}`}>{f.label}</label>
                  {f.type === 'select' ? (
                    <select id={`edit-${f.key}`} value={form[f.key] || 'unknown'} onChange={handleField(f.key)}>
                      {f.options.map(o => <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option>)}
                    </select>
                  ) : (
                    <input id={`edit-${f.key}`} type="text" value={form[f.key] || ''} onChange={handleField(f.key)} />
                  )}
                </div>
              ))}
              <div className="edit-field edit-field-wide">
                <label htmlFor="edit-notes">Notes (one per line)</label>
                <textarea id="edit-notes" rows="4" value={form.notes || ''} onChange={handleField('notes')} />
              </div>
            </div>
            {saveError && <p className="account-error" role="alert">{saveError}</p>}
            <div className="edit-actions">
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <i className="fas fa-save"></i> {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </section>
        ) : (
          <>
            {(person.gender !== 'unknown' || person.occupation || person.education || person.religion) && (
              <section className="view-card">
                <h2 className="account-card-title"><i className="fas fa-info-circle"></i> Basic information</h2>
                <div className="profile-info-grid">
                  {person.gender !== 'unknown' && (
                    <div className="profile-info-item"><div className="label">Gender</div><div className="value">{person.gender}</div></div>
                  )}
                  {person.occupation && (
                    <div className="profile-info-item"><div className="label">Occupation</div><div className="value">{person.occupation}</div></div>
                  )}
                  {person.education && (
                    <div className="profile-info-item"><div className="label">Education</div><div className="value">{person.education}</div></div>
                  )}
                  {person.religion && (
                    <div className="profile-info-item"><div className="label">Religion</div><div className="value">{person.religion}</div></div>
                  )}
                </div>
              </section>
            )}

            {(parents.length > 0 || spouses.length > 0 || children.length > 0 || siblings.length > 0) && (
              <section className="view-card">
                <h2 className="account-card-title"><i className="fas fa-users"></i> Family</h2>
                {renderRelationList('Parents', 'fa-user-friends', parents, 'Parent')}
                {renderRelationList('Spouses', 'fa-heart', spouses, 'Spouse')}
                {renderRelationList('Children', 'fa-child', children, 'Child')}
                {renderRelationList('Siblings', 'fa-users', siblings, 'Sibling')}
              </section>
            )}

            {events.length > 0 && (
              <section className="view-card">
                <h2 className="account-card-title"><i className="fas fa-calendar-alt"></i> Life events</h2>
                <div className="event-list">
                  {events.map((event, i) => (
                    <div className="event-item" key={i}>
                      <span className="event-label">{EVENT_LABELS[event.type] || event.type}</span>
                      {event.date && <span className="event-date">{event.date}</span>}
                      {event.place && <span className="event-place"><i className="fas fa-map-marker-alt"></i> {event.place}</span>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {notesArr.length > 0 && (
              <section className="view-card">
                <h2 className="account-card-title"><i className="fas fa-sticky-note"></i> Notes</h2>
                {notesArr.map((note, i) => (
                  <div key={i} className="profile-note-inline">{note}</div>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default PersonDetailView
