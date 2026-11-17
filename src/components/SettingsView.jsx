import React, { useEffect, useState } from 'react'
import { fetchSettings, updateSettings, sendTestEmail, fetchUpcomingBirthdays, sendBirthdayReminders, fetchTreeSummary } from '../utils/api'
import '../styles/viewpages.css'
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
  const [publicUrl, setPublicUrl] = useState('http://localhost:3000')
  const [saveMsg, setSaveMsg] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)

  const [testTo, setTestTo] = useState('')
  const [testMsg, setTestMsg] = useState('')
  const [testError, setTestError] = useState('')
  const [testing, setTesting] = useState(false)

  const [birthdayEnabled, setBirthdayEnabled] = useState(true)
  const [birthdayLeadDays, setBirthdayLeadDays] = useState('14')
  const [upcoming, setUpcoming] = useState([])
  const [treeStats, setTreeStats] = useState(null)
  const [treeLoading, setTreeLoading] = useState(false)
  const [treeError, setTreeError] = useState('')
  const [upcomingLoading, setUpcomingLoading] = useState(false)
  const [sendState, setSendState] = useState('')
  const [sendError, setSendError] = useState('')
  const [sendingBirthday, setSendingBirthday] = useState(false)

  const isAdmin = currentUser?.role === 'admin'

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
        setPublicUrl(s.app_public_url || 'http://localhost:3000')
        setBirthdayEnabled(s.birthday_enabled !== '0')
        setBirthdayLeadDays(s.birthday_lead_days || '14')
        if (res.adminEmail) setTestTo(prev => prev || res.adminEmail)
      } else {
        setLoadError(res.error || 'Could not load settings')
      }
    } catch (err) {
      setLoadError(err.message || 'Could not load settings')
    } finally {
      setLoading(false)
      loadUpcoming()
      loadTreeStats()
    }
  }

  const loadTreeStats = async () => {
    setTreeLoading(true)
    setTreeError('')
    try {
      const res = await fetchTreeSummary()
      if (res.ok) setTreeStats(res)
      else setTreeError(res.error || 'Could not load tree stats')
    } catch (err) {
      setTreeError(err.message || 'Could not load tree stats')
    } finally {
      setTreeLoading(false)
    }
  }

  const loadUpcoming = async () => {
    setUpcomingLoading(true)
    try {
      const res = await fetchUpcomingBirthdays(30)
      if (res.ok) setUpcoming(res.birthdays || [])
    } catch {
      // silently ignore — email tests still render
    } finally {
      setUpcomingLoading(false)
    }
  }

  const handleSendBirthdaysNow = async () => {
    setSendState('')
    setSendError('')
    setSendingBirthday(true)
    try {
      const res = await sendBirthdayReminders(parseInt(birthdayLeadDays, 10) || 14)
      if (res.ok) {
        setSendState(`Sent to ${res.sent} member${res.sent === 1 ? '' : 's'} (${res.skipped} skipped).`)
        await loadUpcoming()
      } else {
        setSendError(res.error || 'Send failed')
      }
    } catch (err) {
      setSendError(err.message || 'Send failed')
    } finally {
      setSendingBirthday(false)
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
      app_public_url: publicUrl.trim(),
      birthday_enabled: birthdayEnabled ? '1' : '0',
      birthday_lead_days: String(parseInt(birthdayLeadDays, 10) || 14),
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

  const [tab, setTab] = useState('email')

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

  const isEmail = tab === 'email'
  const isAlerts = tab === 'notifications'

  return (
    <div className="view-page">
      <div className="settings-shell">
        <aside className="settings-rail" aria-label="Settings sections">
          <div className="settings-rail-title">
            <h1>Settings</h1>
            <p>Configure TheWairuaHeritage</p>
          </div>

          <nav className="settings-rail-nav">
            <button
              className={`settings-rail-item ${isEmail ? 'active' : ''}`}
              onClick={() => setTab('email')}
              aria-current={isEmail ? 'page' : undefined}
            >
              <i className="fas fa-envelope" aria-hidden="true"></i>
              <span>
                <strong>Email (SMTP)</strong>
                <em>Server, credentials & links</em>
              </span>
            </button>
            <button
              className={`settings-rail-item ${isAlerts ? 'active' : ''}`}
              onClick={() => setTab('notifications')}
              aria-current={isAlerts ? 'page' : undefined}
            >
              <i className="fas fa-bell" aria-hidden="true"></i>
              <span>
                <strong>Notifications</strong>
                <em>Birthday emails</em>
              </span>
            </button>
          </nav>

          <div className="settings-rail-footer">
            <button className="settings-rail-link" onClick={() => onSwitchView('members')}>
              <i className="fas fa-users" aria-hidden="true"></i> Site members
            </button>
            <button className="settings-rail-link" onClick={() => onSwitchView('account')}>
              <i className="fas fa-user-circle" aria-hidden="true"></i> My account
            </button>
          </div>
        </aside>

        <main className="settings-panel">
          {isEmail && (
            <section className="settings-section">
              <div className="settings-section-header">
                <h2><i className="fas fa-envelope" aria-hidden="true"></i> Email (SMTP)</h2>
                <p>Outgoing server, email account credentials, and where links go.</p>
              </div>

              <div className="settings-data-health">
                <div className="settings-data-health-header">
                  <h3><i className="fas fa-tree" aria-hidden="true"></i> Data health</h3>
                  {treeLoading && <span className="view-sub">Loading…</span>}
                </div>
                {treeError && <p className="account-error" role="alert">{treeError}</p>}
                {treeStats && treeStats.stats && (
                  <dl className="settings-data-grid">
                    <div><dt>Individuals in tree</dt><dd>{treeStats.stats.individualCount}</dd></div>
                    <div><dt>Families</dt><dd>{treeStats.stats.familyCount}</dd></div>
                    <div><dt>Living / deceased</dt><dd>{treeStats.living} / {treeStats.deceased}</dd></div>
                    <div><dt>Birthdays with dates</dt><dd>{treeStats.stats.eventCount ?? '—'} events</dd></div>
                    <div><dt>Known male / female / unknown</dt><dd>{treeStats.gender?.male ?? '—'} / {treeStats.gender?.female ?? '—'} / {treeStats.gender?.unknown ?? '—'}</dd></div>
                    <div><dt>Individuals with a birth year</dt><dd>{treeStats.withBirthYear}</dd></div>
                  </dl>
                )}
              </div>

              <form className="account-form settings-form" onSubmit={handleSave}>
                <div className="settings-toggle-row">
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => setEnabled(e.target.checked)}
                    />
                    <span>Enable email delivery</span>
                  </label>
                  {enabled
                    ? <span className="settings-pill settings-pill-on"><i className="fas fa-check"></i> ON</span>
                    : <span className="settings-pill settings-pill-off"><i className="fas fa-pause"></i> OFF</span>}
                </div>

                <fieldset className="settings-fieldset">
                  <legend>Server</legend>
                  <div className="settings-row">
                    <div className="settings-span-2">
                      <label className="account-label" htmlFor="smtp_host">SMTP host</label>
                      <input
                        id="smtp_host"
                        type="text"
                        value={host}
                        onChange={(e) => setHost(e.target.value)}
                        placeholder="smtp.gmail.com"
                        autoComplete="off"
                      />
                    </div>
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
                </fieldset>

                <fieldset className="settings-fieldset">
                  <legend>Credentials</legend>
                  <label className="account-label" htmlFor="smtp_user">Username / email</label>
                  <input
                    id="smtp_user"
                    type="text"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="off"
                  />

                  <label className="account-label" htmlFor="smtp_pass">
                    Password {passConfigured && <em>(leave blank to keep, or clear)</em>}
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
                </fieldset>

                <fieldset className="settings-fieldset">
                  <legend>Sender &amp; links</legend>
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

                  <label className="account-label" htmlFor="app_public_url">Public URL</label>
                  <input
                    id="app_public_url"
                    type="url"
                    value={publicUrl}
                    onChange={(e) => setPublicUrl(e.target.value)}
                    placeholder="https://thewairuaheritage.example.com"
                    autoComplete="off"
                  />
                  <p className="settings-hint">
                    Reset-password and invite links point at this URL — set it before going live.
                  </p>
                </fieldset>

                {saveError && <p className="account-error" role="alert">{saveError}</p>}
                {saveMsg && <p className="account-success" role="status">{saveMsg}</p>}

                <div className="account-actions settings-actions">
                  <button type="submit" className="btn btn-primary" disabled={saving} aria-busy={saving}>
                    {saving ? 'Saving...' : 'Save settings'}
                  </button>
                </div>
              </form>

              <div className="settings-test-box">
                <div className="settings-test-header">
                  <h3><i className="fas fa-paper-plane" aria-hidden="true"></i> Test delivery</h3>
                  <p>Use the SMTP details above to prove delivery.</p>
                </div>
                <form
                  className="settings-test-form"
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

                  <button
                    type="submit"
                    className="btn btn-outline"
                    disabled={testing}
                    aria-busy={testing}
                  >
                    {testing ? 'Sending...' : 'Send test email'}
                  </button>
                </form>
                <p className="settings-note">
                  Gmail: use an <strong>App password</strong> with 2-Step Verification and <strong>STARTTLS 587</strong>.
                  Outlook/Microsoft 365: <strong>smtp.office365.com</strong> port 587.
                </p>
              </div>
            </section>
          )}

          {isAlerts && (
            <section className="settings-section">
              <div className="settings-section-header">
                <h2><i className="fas fa-bell" aria-hidden="true"></i> Notifications</h2>
                <p>Birthday reminders for site members.</p>
              </div>
              <div className="settings-toggle-row">
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={birthdayEnabled}
                    onChange={(e) => setBirthdayEnabled(e.target.checked)}
                  />
                  <span>Send birthday emails to active members</span>
                </label>
                <span className={`settings-pill ${birthdayEnabled ? 'settings-pill-on' : 'settings-pill-off'}`}>
                  <i className={`fas ${birthdayEnabled ? 'fa-check' : 'fa-pause'}`}></i> {birthdayEnabled ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="settings-hint">
                Members get a branded email listing family birthdays for the next window of days. Lead days controls the window.
                <em> Send now</em> sends to every active, non-placeholder account immediately.
              </p>

              <div className="settings-row settings-row-tall">
                <div>
                  <label className="account-label" htmlFor="birthday_lead_days">Remind me how many days ahead</label>
                  <input
                    id="birthday_lead_days"
                    type="number"
                    min="1"
                    max="365"
                    value={birthdayLeadDays}
                    onChange={(e) => setBirthdayLeadDays(e.target.value)}
                  />
                </div>
                <div>
                  <label className="account-label">Immediate test</label>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={sendingBirthday || !birthdayEnabled}
                    aria-busy={sendingBirthday}
                    onClick={handleSendBirthdaysNow}
                  >
                    {sendingBirthday ? 'Sending...' : 'Send now'}
                  </button>
                </div>
              </div>

              <div className="settings-upcoming-head">
                <h3>Upcoming birthdays <span className="sm-muted">({upcoming.length})</span></h3>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={loadUpcoming}
                  disabled={upcomingLoading}
                  aria-label="Refresh list"
                >
                  <i className={`fas fa-sync-alt ${upcomingLoading ? 'fa-spin' : ''}`}></i> Refresh
                </button>
              </div>

              {upcomingLoading ? (
                <p className="settings-hint"><i className="fas fa-spinner fa-spin"></i> Loading...</p>
              ) : upcoming.length === 0 ? (
                <p className="settings-hint">No birthdays in the next 30 days.</p>
              ) : (
                <div className="sm-table-wrap">
                  <table className="sm-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Date</th>
                        <th>Age</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcoming.slice(0, 12).map((b, i) => (
                        <tr key={`${b.id}-${i}`}>
                          <td><strong>{b.name}</strong></td>
                          <td>{b.date} <span className="sm-muted">({b.birth_date})</span></td>
                          <td>{b.age ?? '–'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {sendError && <p className="account-error" role="alert">{sendError}</p>}
              {sendState && <p className="account-success" role="status">{sendState}</p>}
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
