import React, { useState } from 'react'
import { resetPassword } from '../utils/api'
import '../styles/login.css'

export default function ResetPasswordView({ token, onBackToLogin }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState('') // '' | 'saving' | 'success' | 'error'
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setStatus('saving')
    try {
      const res = await resetPassword(token, password)
      if (res.ok) {
        setStatus('success')
        // Clear the token from the URL so refreshing doesn't re-open this page
        try { window.history.replaceState({}, '', '/') } catch {}
      } else {
        setStatus('error')
        setError(res.error || 'This reset link is invalid or has expired')
      }
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Reset failed')
    }
  }

  if (!token) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">
            <div className="mh-mark" aria-hidden="true" />
            <span className="login-wordmark">TheWairuaHeritage</span>
          </div>
          <h1 className="login-title">Invalid reset link</h1>
          <p className="login-sub">This link is missing a token.</p>
          <div className="login-actions">
            <button className="login-submit" type="button" onClick={onBackToLogin}>Back to sign in</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="mh-mark" aria-hidden="true" />
          <span className="login-wordmark">TheWairuaHeritage</span>
        </div>

        <h1 className="login-title">Choose a new password</h1>

        {status === 'success' ? (
          <>
            <p className="login-error" role="status">Your password has been updated.</p>
            <div className="login-actions">
              <button className="login-submit" type="button" onClick={onBackToLogin}>Sign in</button>
            </div>
          </>
        ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-label" htmlFor="reset-password">New password</label>
            <div className="login-password-wrap">
              <input
                id="reset-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                className="login-toggle"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true" />
              </button>
            </div>

            <label className="login-label" htmlFor="reset-confirm">Confirm password</label>
            <input
              id="reset-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Repeat your new password"
            />

            {error && <p className="login-error" role="alert">{error}</p>}

            <div className="login-actions">
              <button
                className="login-submit"
                type="submit"
                disabled={status === 'saving'}
                aria-busy={status === 'saving'}
              >
                {status === 'saving' ? 'Saving...' : 'Set new password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
