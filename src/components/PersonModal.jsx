import React, { useCallback, useEffect, useState } from 'react'
import PersonAvatar from './PersonAvatar'

function PersonModal({ person, individuals, families, onClose, onSelectPerson, onUpdatePerson }) {
  const getPerson = useCallback((id) => {
    return id ? individuals.get(id) : null
  }, [individuals])

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const formatDate = useCallback((date) => {
    if (!date) return 'Unknown'
    return date
  }, [])

  useEffect(() => {
    setEditing(false)
    setSaveError(null)
  }, [person.id])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (editing) {
          setEditing(false)
        } else {
          onClose()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, editing])

  // Close on overlay click
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      if (editing) return
      onClose()
    }
  }

  const startEdit = () => {
    setForm({
      givenName: person.givenName || '',
      surname: person.surname || '',
      nickname: person.nickname || '',
      gender: person.gender && person.gender !== 'unknown' ? person.gender : 'unknown',
      birthDate: person.birthDate || '',
      birthPlace: person.birthPlace || '',
      deathDate: person.deathDate || '',
      deathPlace: person.deathPlace || '',
      burialDate: person.burialDate || '',
      burialPlace: person.burialPlace || '',
      occupation: person.occupation || '',
      education: person.education || '',
      religion: person.religion || '',
      notes: (person.notes || []).join('\n'),
    })
    setSaveError(null)
    setEditing(true)
  }

  const handleField = (name) => (e) => {
    setForm(f => ({ ...f, [name]: e.target.value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await onUpdatePerson(person.id, {
        givenName: form.givenName,
        surname: form.surname,
        nickname: form.nickname,
        gender: form.gender,
        birthDate: form.birthDate,
        birthPlace: form.birthPlace,
        deathDate: form.deathDate,
        deathPlace: form.deathPlace,
        burialDate: form.burialDate,
        burialPlace: form.burialPlace,
        occupation: form.occupation,
        education: form.education,
        religion: form.religion,
        notes: form.notes.split('\n').map(n => n.trim()).filter(Boolean),
      })
      setEditing(false)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const parents = person.parents.map(id => getPerson(id)).filter(Boolean)
  const spouses = person.spouses.map(id => getPerson(id)).filter(Boolean)
  const children = person.children.map(id => getPerson(id)).filter(Boolean)
  const siblings = person.siblings.map(id => getPerson(id)).filter(Boolean)

  const eventLabels = {
    BIRT: 'Birth', DEAT: 'Death', MARR: 'Marriage', DIV: 'Divorce', CENS: 'Census',
    RESI: 'Residence', IMMI: 'Immigration', EMIG: 'Emigration', CHR: 'Christening',
    BAPM: 'Baptism', CONF: 'Confirmation', GRAD: 'Graduation', NATU: 'Naturalization',
    PROB: 'Probate', WILL: 'Will', RETI: 'Retirement', EVEN: 'Event', BURI: 'Burial', OCCU: 'Occupation',
  }

  const renderFamilyMember = (member, relation) => {
    if (!member) return null
    return (
      <div
        key={member.id}
        className="family-member"
        onClick={() => onSelectPerson(member.id)}
      >
        <PersonAvatar person={member} className="mini-avatar" />
        <span className="member-name">{member.name}</span>
        <span className="member-relation">{relation}</span>
      </div>
    )
  }

  const editFields = [
    { key: 'givenName', label: 'Given name' },
    { key: 'surname', label: 'Surname' },
    { key: 'nickname', label: 'Nickname' },
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
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal">
        <button className="modal-close" onClick={editing ? () => setEditing(false) : onClose}>
          <i className="fas fa-times"></i>
        </button>
        {!editing && (
          <button className="btn btn-icon modal-edit" onClick={startEdit} title="Edit person">
            <i className="fas fa-pen"></i> Edit
          </button>
        )}
        <div className="modal-content">
          <div className="profile-header">
            <PersonAvatar person={person} className="profile-avatar" />
            <h2>{editing ? 'Edit Person' : person.name}</h2>
            {!editing && (
              <div className="profile-dates">
                {person.birthDate && (
                  <span>
                    <i className="fas fa-birthday-cake"></i> {formatDate(person.birthDate)}
                    {person.birthPlace && ` • ${person.birthPlace}`}
                  </span>
                )}
                {person.deathDate && (
                  <span className="profile-date-separator">
                    <i className="fas fa-cross"></i> {formatDate(person.deathDate)}
                    {person.deathPlace && ` • ${person.deathPlace}`}
                  </span>
                )}
              </div>
            )}
          </div>

          {editing ? (
            <div className="profile-section">
              <h3><i className="fas fa-pen"></i> Edit details for {person.name}</h3>
              <div className="edit-form">
                {editFields.map(f => (
                  <div className="edit-field" key={f.key}>
                    <label htmlFor={`edit-${f.key}`}>{f.label}</label>
                    {f.type === 'select' ? (
                      <select id={`edit-${f.key}`} value={form[f.key] || 'unknown'} onChange={handleField(f.key)}>
                        {f.options.map(o => (
                          <option key={o} value={o}>{o === 'unknown' ? 'Unknown' : o[0].toUpperCase() + o.slice(1)}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={`edit-${f.key}`}
                        type="text"
                        value={form[f.key] || ''}
                        onChange={handleField(f.key)}
                      />
                    )}
                  </div>
                ))}
                <div className="edit-field edit-field-wide">
                  <label htmlFor="edit-notes">Notes</label>
                  <textarea id="edit-notes" rows="4" value={form.notes || ''} onChange={handleField('notes')} />
                </div>
              </div>
              {saveError && <div className="edit-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  <i className="fas fa-save"></i> {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="btn btn-icon" onClick={() => setEditing(false)} disabled={saving}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Basic Info */}
              {(person.gender !== 'unknown' || person.occupation || person.education || person.religion) && (
                <div className="profile-section">
                  <h3><i className="fas fa-info-circle"></i> Basic Information</h3>
                  <div className="profile-info-grid">
                    {person.gender !== 'unknown' && (
                      <div className="profile-info-item">
                        <div className="label">Gender</div>
                        <div className="value value-capitalized">{person.gender}</div>
                      </div>
                    )}
                    {person.occupation && (
                      <div className="profile-info-item">
                        <div className="label">Occupation</div>
                        <div className="value">{person.occupation}</div>
                      </div>
                    )}
                    {person.education && (
                      <div className="profile-info-item">
                        <div className="label">Education</div>
                        <div className="value">{person.education}</div>
                      </div>
                    )}
                    {person.religion && (
                      <div className="profile-info-item">
                        <div className="label">Religion</div>
                        <div className="value">{person.religion}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Parents */}
              {parents.length > 0 && (
                <div className="profile-section">
                  <h3><i className="fas fa-user-friends"></i> Parents</h3>
                  <div className="family-list">
                    {parents.map(parent => renderFamilyMember(parent, 'Parent'))}
                  </div>
                </div>
              )}

              {/* Spouses */}
              {spouses.length > 0 && (
                <div className="profile-section">
                  <h3><i className="fas fa-heart"></i> Spouses</h3>
                  <div className="family-list">
                    {spouses.map(spouse => renderFamilyMember(spouse, 'Spouse'))}
                  </div>
                </div>
              )}

              {/* Children */}
              {children.length > 0 && (
                <div className="profile-section">
                  <h3><i className="fas fa-child"></i> Children</h3>
                  <div className="family-list">
                    {children.map(child => renderFamilyMember(child, 'Child'))}
                  </div>
                </div>
              )}

              {/* Siblings */}
              {siblings.length > 0 && (
                <div className="profile-section">
                  <h3><i className="fas fa-users"></i> Siblings</h3>
                  <div className="family-list">
                    {siblings.map(sibling => renderFamilyMember(sibling, 'Sibling'))}
                  </div>
                </div>
              )}

              {/* Events */}
              {person.events.length > 0 && (
                <div className="profile-section">
                  <h3><i className="fas fa-calendar-alt"></i> Life Events</h3>
                  <div className="family-list">
                    {person.events.map((event, i) => (
                      <div key={i} className="family-member">
                        <div className="mini-avatar event-avatar">
                          <i className="fas fa-calendar"></i>
                        </div>
                        <span className="member-name">
                          {eventLabels[event.type] || event.type}
                          {event.date && ` (${event.date})`}
                        </span>
                        {event.place && (
                          <span className="member-relation">
                            <i className="fas fa-map-marker-alt"></i> {event.place}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {person.notes.length > 0 && (
                <div className="profile-section">
                  <h3><i className="fas fa-sticky-note"></i> Notes</h3>
                  {person.notes.map((note, i) => (
                    <div key={i} className="profile-info-item profile-note">
                      <div className="value">{note}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default PersonModal
