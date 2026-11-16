import React, { useState } from 'react'
import { login, verifyMfa } from '../utils/api'
import '../styles/login.css'

export default function LoginView({ onLoggedIn, onSwitchView }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Two-factor step, shown after a correct password when 2FA is enabled
  const [mfaToken, setMfaToken] = useState(null)
  const [mfaCode, setMfaCode] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await login(email, password)
      if (res.ok && res.mfaRequired) {
        setMfaToken(res.pendingToken)
        return
      }
      if (res.ok && res.user) {
        onLoggedIn(res.user)
      } else {
        setError(res.error || 'Login failed')
      }
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleMfaSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await verifyMfa(mfaToken, mfaCode.trim())
      if (res.ok && res.user) {
        onLoggedIn(res.user)
      } else {
        setError(res.error || 'That code did not work')
      }
    } catch (err) {
      setError(err.message || 'That code did not work')
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

        <h1 className="login-title">{mfaToken ? 'Two-factor authentication' : 'Welcome back'}</h1>
        <p className="login-sub">{mfaToken ? 'Enter the 6-digit code from your authenticator app' : 'Sign in to view your family tree'}</p>

        {mfaToken ? (
          <form className="login-form" onSubmit={handleMfaSubmit}>
            <label className="login-label" htmlFor="mfa_code">Authenticator code</label>
            <input
              id="mfa_code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9-]{6,12}"
              maxLength={12}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              autoFocus
              required
              placeholder="123456 (or a backup code)"
            />

            {error && <p className="login-error" role="alert">{error}</p>}

            <button type="submit" className="login-submit" disabled={loading} aria-busy={loading}>
              {loading ? 'Verifying...' : 'Verify and sign in'}
            </button>
            <button type="button" className="link-button" onClick={() => { setMfaToken(null); setMfaCode(''); setError('') }}>
              Back to password
            </button>
          </form>
        ) : (

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            placeholder="gichukisimon@gmail.com"
          />

          <label className="login-label" htmlFor="password">Password</label>
          <div className="login-password-wrap">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              placeholder="Enter your password"
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

          <div className="login-row">
            <label className="login-remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Remember me
            </label>
            <button
              type="button"
              className="link-button"
              onClick={() => onSwitchView('forgot-password')}
            >
              Forgot password?
            </button>
          </div>

          {error && <p className="login-error" role="alert">{error}</p>}

          <button
            type="submit"
            className="login-submit"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        )}

        <p className="login-help">
          Don’t have an account?{' '}
          <button type="button" className="link-button" onClick={() => onSwitchView('signup')}>
            Sign up
          </button>
        </p>
      </div>
    </div>
  )
}
