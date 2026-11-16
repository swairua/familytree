import React, { useState } from 'react'
import '../styles/login.css'

export default function ForgotPasswordView({ onBackToLogin }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('success')
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="mh-mark" aria-hidden="true" />
          <span className="login-wordmark">MyHeritage</span>
        </div>

        <h1 className="login-title">Forgot your password?</h1>
        <p className="login-sub">
          Enter your email and the site administrator will send you a reset link.
        </p>

        {status === 'success' ? (
          <>
            <p className="login-error" role="status">
              If an account exists for <strong>{email.trim()}</strong>, an administrator has been notified.
            </p>
            <div className="login-actions">
              <button className="login-submit" type="button" onClick={onBackToLogin}>
                Back to sign in
              </button>
            </div>
          </>
        ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-label" htmlFor="forgot-email">Email</label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              placeholder="gichukisimon@gmail.com"
            />

            <div className="login-actions">
              <button className="login-submit" type="submit">Request reset link</button>
            </div>
            <p className="login-help">
              <button className="link-button" type="button" onClick={onBackToLogin}>Back to sign in</button>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}