import React, { useState } from 'react'
import { forgotPassword } from '../utils/api'
import '../styles/login.css'

export default function ForgotPasswordView({ onBackToLogin }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('') // '' | 'sending' | 'success' | 'error'
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('sending')
    setError('')
    try {
      const res = await forgotPassword(email.trim())
      if (res.ok) {
        setStatus('success')
        setMessage(res.message || 'If an account exists for this email, a reset link has been sent.')
      } else {
        setStatus('error')
        setError(res.error || 'Could not request a reset link')
      }
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Could not request a reset link')
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="mh-mark" aria-hidden="true" />
          <span className="login-wordmark">TheWairuaHeritage</span>
        </div>

        <h1 className="login-title">Forgot your password?</h1>
        <p className="login-sub">
          Enter your email and we&apos;ll send you a link to reset it.
        </p>

        {status === 'success' ? (
          <>
            <p className="login-error" role="status">{message}</p>
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
              placeholder="you@example.com"
            />

            {error && <p className="login-error" role="alert">{error}</p>}

            <div className="login-actions">
              <button
                className="login-submit"
                type="submit"
                disabled={status === 'sending'}
                aria-busy={status === 'sending'}
              >
                {status === 'sending' ? 'Sending...' : 'Send reset link'}
              </button>
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
