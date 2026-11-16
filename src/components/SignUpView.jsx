import React, { useState } from 'react'
import '../styles/login.css'

export default function SignUpView({ onBackToLogin }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    setStatus('success')
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="mh-mark" aria-hidden="true" />
          <span className="login-wordmark">MyHeritage</span>
        </div>

        <h1 className="login-title">Request an account</h1>
        <p className="login-sub">
          New accounts are created by the site administrator.
        </p>

        {status === 'success' ? (
          <>
            <p className="login-error" role="status">
              Your request has been received. The site administrator will review it.
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

            <label className="login-label" htmlFor="signup-message">Message (optional)</label>
            <textarea
              id="signup-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Why you would like an account..."
              rows={3}
              className="login-textarea"
            />

            <div className="login-actions">
              <button className="login-submit" type="submit">Request account</button>
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