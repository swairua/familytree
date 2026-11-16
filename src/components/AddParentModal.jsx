import React, { useState } from 'react'
import { createIndividual } from '../utils/api'
import '../styles/modal.css'

export default function AddParentModal({ childId, role, onClose }) {
  const [form, setForm] = useState({
    givenName: '',
    surname: '',
    gender: role === 'father' ? 'male' : 'female',
    birthDate: '',
    birthPlace: '',
    deathDate: '',
    deathPlace: '',
    occupation: '',
    education: '',
    religion: '',
    photo: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await createIndividual(childId, role, {
        givenName: form.givenName.trim(),
        surname: form.surname.trim(),
        gender: form.gender,
        birthDate: form.birthDate.trim(),
        birthPlace: form.birthPlace.trim(),
        deathDate: form.deathDate.trim(),
        deathPlace: form.deathPlace.trim(),
        occupation: form.occupation.trim(),
        education: form.education.trim(),
        religion: form.religion.trim(),
        photo: form.photo.trim(),
        notes: form.notes.trim(),
      })
      window.location.reload()
    } catch (err) {
      setError(err.message || 'Failed to create family member')
      setSaving(false)
    }
  }

  const label = role === 'father' ? 'Add father' : 'Add mother'

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <form className="modal add-parent-modal" onSubmit={handleSubmit}>
        <div className="modal-header">
          <h2>{label}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="modal-body">
          <div className="edit-form">
            <div className="edit-field">
              <label htmlFor="givenName">Given name</label>
              <input id="givenName" autoFocus value={form.givenName} onChange={e => update('givenName', e.target.value)} />
            </div>
            <div className="edit-field">
              <label htmlFor="surname">Surname</label>
              <input id="surname" value={form.surname} onChange={e => update('surname', e.target.value)} />
            </div>
            <div className="edit-field">
              <label htmlFor="gender">Gender</label>
              <select id="gender" value={form.gender} onChange={e => update('gender', e.target.value)}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
            <div className="edit-field">
              <label htmlFor="birthDate">Birth date</label>
              <input id="birthDate" value={form.birthDate} placeholder="e.g. Dec 25 1978" onChange={e => update('birthDate', e.target.value)} />
            </div>
            <div className="edit-field">
              <label htmlFor="birthPlace">Birth place</label>
              <input id="birthPlace" value={form.birthPlace} onChange={e => update('birthPlace', e.target.value)} />
            </div>
            <div className="edit-field">
              <label htmlFor="occupation">Occupation</label>
              <input id="occupation" value={form.occupation} onChange={e => update('occupation', e.target.value)} />
            </div>
            <div className="edit-field">
              <label htmlFor="photo">Photo filename</label>
              <input id="photo" value={form.photo} placeholder="e.g. 2000158.jpg" onChange={e => update('photo', e.target.value)} />
            </div>
          </div>
          {error && <p className="modal-error">{error}</p>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : label}
          </button>
        </div>
      </form>
    </div>
  )
}
