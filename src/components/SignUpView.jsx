import React, { useState } from 'react'
import { registerAccount } from '../utils/api'
import '../styles/login.css'

export default function SignUpView({ onBackToLogin }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const res = await registerAccount({ name: name.trim(), email: email.trim(), password })
      if (res.ok) {
        setStatus('pending')
      } else {
        setError(res.error || 'Registration failed')
      }
    } catch (err) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="mh-mark" aria-hidden="true" />
          <span className="login-wordmark">TheWairuaHeritage</span>
        </div>

        <h1 className="login-title">Create your account</h1>
        <p className="login-sub">
          New accounts are created by the site administrator and activated for you.
        </p>

        {status === 'pending' ? (
          <>
            <p className="login-error" role="status">
              Your account has been created and is pending approval. You will be able to sign in once the site administrator activates it.
            </p>
            <div className="login-actions">
              <button className="login-submit" type="button" onClick={onBackToLogin}>Back to sign in</button>
            </div>
          </>
        ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-label" htmlFor="signup-name">Your name</label>
            <input
              id="signup-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
              placeholder="Simon Gichuki Wairua"
            />

            <label className="login-label" htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              placeholder="gichukisimon@gmail.com"
            />

            <label className="login-label" htmlFor="signup-password">Password</label>
            <div className="login-password-wrap">
              <input
                id="signup-password"
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

            <label className="login-label" htmlFor="signup-confirm">Confirm password</label>
            <input
              id="signup-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Repeat your password"
            />

            {error && <p className="login-error" role="alert">{error}</p>}

            <div className="login-actions">
              <button className="login-submit" type="submit" disabled={loading} aria-busy={loading}>
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </div>
            <p className="login-help">
              Already have an account?{' '}
              <button className="link-button" type="button" onClick={onBackToLogin}>Sign in</button>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
