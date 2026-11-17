import React, { useEffect, useState } from 'react'
import PersonAvatar from './PersonAvatar'
import { acceptInvitation, verifyInvitation } from '../utils/api'
import '../styles/login.css'
import '../styles/account.css'

function EnrollView({ onLoggedIn }) {
  const [token, setToken] = useState('')
  const [invitation, setInvitation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      const t = (p.get('token') || '').trim()
      setToken(t)
      if (!t) {
        setError('This invitation link is missing a token. Ask the site administrator for a new one.')
        setLoading(false)
        return
      }
      verifyInvitation(t)
        .then(res => {
          if (!res.ok) {
            setError(res.error || 'This invitation is not valid.')
          } else {
            setInvitation(res.invitation)
            if (res.invitation?.email) setEmail(res.invitation.email)
          }
        })
        .catch(err => setError(err.message || 'Could not load invitation'))
        .finally(() => setLoading(false))
    } catch (err) {
      setError('Could not read invitation link')
      setLoading(false)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (!email && !invitation?.email) {
      setError('Enter the email address you use')
      return
    }
    setSubmitting(true)
    try {
      const res = await acceptInvitation({ token, email, password })
      if (res.ok) {
        setDone(true)
        if (res.user && onLoggedIn) {
          onLoggedIn(res.user)
        }
      } else {
        setError(res.error || 'Could not accept invitation')
      }
    } catch (err) {
      setError(err.message || 'Could not accept invitation')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card">
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '1.6rem', color: '#e08c2e' }} />
          <p className="login-sub">Loading your invitation…</p>
        </div>
      </div>
    )
  }

  if (error && !invitation) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1 className="login-title">Invitation</h1>
          <p className="login-error">{error}</p>
        </div>
      </div>
    )
  }

  if (!invitation) return null

  const name = invitation.individual_name || invitation.name || 'New member'
  const person = {
    name,
    photo: invitation.individual_photo || '',
    gender: invitation.individual_gender || 'unknown',
    birthYear: invitation.individual_birth_date ? (invitation.individual_birth_date.match(/\d{4}/) || [''])[0] : '',
    deathDate: invitation.individual_death_date || '',
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="mh-mark" aria-hidden="true" />
          <span className="login-wordmark">TheWairuaHeritage</span>
        </div>

        <h1 className="login-title">Join the family tree</h1>
        <p className="login-sub">You've been invited to TheWairuaHeritage. Complete your sign-up below.</p>

        <div className="account-card" style={{ background: '#faf8f5', border: '1px solid #eee7dc', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
          <PersonAvatar person={person} className="sm-avatar" />
          <div>
            <strong style={{ fontSize: '1.05rem', color: '#2f2b27' }}>{name}</strong>
            <div className="view-sub" style={{ marginTop: 4 }}>
              {invitation.individual_email ? `Email on file: ${invitation.individual_email}` : 'No email on file yet'}
            </div>
            {invitation.individual_birth_date && <div className="view-sub">Born {invitation.individual_birth_date}</div>}
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-label" htmlFor="enroll-password">Choose a password</label>
          <div className="login-password-wrap">
            <input
              id="enroll-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              placeholder="At least 8 characters"
            />
          </div>

          <label className="login-label" htmlFor="enroll-confirm">Confirm password</label>
          <div className="login-password-wrap">
            <input
              id="enroll-confirm"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              placeholder="Repeat your password"
            />
          </div>

          {!invitation.email && (
            <>
              <label className="login-label" htmlFor="enroll-email">Your email</label>
              <input
                id="enroll-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </>
          )}

          {error && <p className="login-error" role="alert">{error}</p>}

          <button type="submit" className="login-submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Accept invitation'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default EnrollView
