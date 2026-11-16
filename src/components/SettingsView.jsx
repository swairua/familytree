import React, { useEffect, useState } from 'react'
import { fetchSettings, updateSettings, sendTestEmail } from '../utils/api'
import '../styles/account.css'
import '../styles/settings.css'

export default function SettingsView({ currentUser, onSwitchView }) {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [enabled, setEnabled] = useState(false)
  const [host, setHost] = useState('')
  const [port, setPort] = useState('587')
  const [scheme, setScheme] = useState('tls')
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [clearPass, setClearPass] = useState(false)
  const [passConfigured, setPassConfigured] = useState(false)
  const [fromEmail, setFromEmail] = useState('')
  const [fromName, setFromName] = useState('TheWairuaHeritage')
  const [saveMsg, setSaveMsg] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)

  const [testTo, setTestTo] = useState('')
  const [testMsg, setTestMsg] = useState('')
  const [testError, setTestError] = useState('')
  const [testing, setTesting] = useState(false)

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetchSettings()
      if (res.ok && res.settings) {
        const s = res.settings
        setEnabled(s.smtp_enabled === '1')
        setHost(s.smtp_host || '')
        setPort(s.smtp_port || '587')
        setScheme(s.smtp_scheme || 'tls')
        setUser(s.smtp_user || '')
        setPassConfigured(s.smtp_pass === 'SET')
        setFromEmail(s.smtp_from_email || '')
        setFromName(s.smtp_from_name || 'TheWairuaHeritage')
        if (res.adminEmail) setTestTo(prev => prev || res.adminEmail)
      } else {
        setLoadError(res.error || 'Could not load settings')
      }
    } catch (err) {
      setLoadError(err.message || 'Could not load settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaveMsg('')
    setSaveError('')
    setSaving(true)
    const patch = {
      smtp_enabled: enabled,
      smtp_host: host.trim(),
      smtp_port: parseInt(port, 10) || 587,
      smtp_scheme: scheme,
      smtp_user: user.trim(),
      smtp_from_email: fromEmail.trim(),
      smtp_from_name: fromName.trim(),
    }
    if (clearPass) patch.smtp_pass = ''
    else if (pass !== '') patch.smtp_pass = pass
    try {
      const res = await updateSettings(patch)
      if (res.ok) {
        setSaveMsg('Settings saved.')
        setPass('')
        setClearPass(false)
        await load()
      } else {
        setSaveError(res.error || 'Save failed')
      }
    } catch (err) {
      setSaveError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTestMsg('')
    setTestError('')
    setTesting(true)
    try {
      const res = await sendTestEmail(testTo.trim())
      if (res.ok) {
        setTestMsg(`Test email sent to ${testTo.trim()} — check the inbox.`)
      } else {
        setTestError(res.error || 'Test failed')
      }
    } catch (err) {
      setTestError(err.message || 'Test failed')
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="view-page">
        <div className="account-container"><div className="sm-empty"><i className="fas fa-spinner fa-spin"></i> Loading settings...</div></div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="view-page">
        <div className="account-container">
          <div className="view-card">
            <h2 className="account-card-title">Settings</h2>
            <p className="account-error" role="alert">{loadError}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="view-page">
      <div className="account-container">
        <div className="view-header">
          <div>
            <h1>Settings</h1>
            <p className="view-sub">Site configuration (administrators only)</p>
          </div>
        </div>

        <div className="account-grid">
          {/* SMTP configuration */}
          <section className="view-card account-card">
            <h2 className="account-card-title">SMTP email</h2>
            <form className="account-form" onSubmit={handleSave}>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                <span>Enable email delivery</span>
              </label>
              <p className="settings-hint">
                Used to send member invites and password-reset emails. Without a working SMTP server, the site cannot email members.
              </p>

              <label className="account-label" htmlFor="smtp_host">SMTP host</label>
              <input
                id="smtp_host"
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="smtp.gmail.com"
                autoComplete="off"
              />

              <div className="settings-row">
                <div>
                  <label className="account-label" htmlFor="smtp_port">Port</label>
                  <input id="smtp_port" type="number" min="1" max="65535" value={port} onChange={(e) => setPort(e.target.value)} />
                </div>
                <div>
                  <label className="account-label" htmlFor="smtp_scheme">Encryption</label>
                  <select id="smtp_scheme" value={scheme} onChange={(e) => setScheme(e.target.value)}>
                    <option value="tls">STARTTLS (587)</option>
                    <option value="ssl">SSL/TLS (465)</option>
                    <option value="none">None (25)</option>
                  </select>
                </div>
              </div>

              <label className="account-label" htmlFor="smtp_user">Username</label>
              <input
                id="smtp_user"
                type="text"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="you@gmail.com"
                autoComplete="off"
              />

              <label className="account-label" htmlFor="smtp_pass">
                Password {passConfigured && <em>(leave blank to keep current, or check Clear)</em>}
              </label>
              <input
                id="smtp_pass"
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder={passConfigured ? '••••••••••••' : 'App password / SMTP password'}
                autoComplete="new-password"
              />
              {passConfigured && (
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={clearPass}
                    onChange={(e) => setClearPass(e.target.checked)}
                  />
                  <span>Clear stored password</span>
                </label>
              )}

              <label className="account-label" htmlFor="smtp_from_email">From email</label>
              <input
                id="smtp_from_email"
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="site@example.com"
                autoComplete="off"
              />

              <label className="account-label" htmlFor="smtp_from_name">From name</label>
              <input
                id="smtp_from_name"
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="TheWairuaHeritage"
                autoComplete="off"
              />

              {saveError && <p className="account-error" role="alert">{saveError}</p>}
              {saveMsg && <p className="account-success" role="status">{saveMsg}</p>}

              <div className="account-actions">
                <button type="submit" className="btn btn-primary" disabled={saving} aria-busy={saving}>
                  {saving ? 'Saving...' : 'Save settings'}
                </button>
              </div>
            </form>
          </section>

          {/* Test delivery */}
          <section className="view-card account-card">
            <h2 className="account-card-title">Test delivery</h2>
            <p className="settings-hint">
              Send a test email using the SMTP details on the left. Great way to verify Gmail “app passwords”, Outlook, and self-hosted servers.
            </p>
            <form
              className="account-form"
              onSubmit={(e) => { e.preventDefault(); handleTest() }}
            >
              <label className="account-label" htmlFor="smtp_test_to">Send test to</label>
              <input
                id="smtp_test_to"
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="you@example.com"
                required
              />

              {testError && <p className="account-error" role="alert">{testError}</p>}
              {testMsg && <p className="account-success" role="status">{testMsg}</p>}

              <div className="account-actions">
                <button type="submit" className="btn btn-primary" disabled={testing} aria-busy={testing}>
                  {testing ? 'Sending...' : 'Send test email'}
                </button>
              </div>
            </form>
            <p className="settings-note">
              Gmail: turn on 2-Step Verification and create an <strong>App password</strong>, use it here with <strong>STARTTLS</strong> port 587.
              Outlook/Microsoft 365: use <strong>smtp.office365.com</strong> port 587 STARTTLS.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
