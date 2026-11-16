import React, { useEffect, useState } from 'react'
import { changeProfile, changePassword, mfaSetup, mfaConfirm, mfaDisable, signOutEverywhere, setDnaTested } from '../utils/api'
import { cleanName } from '../utils/cleanName'
import '../styles/account.css'
import '../styles/viewpages.css'
export default function AccountView({ currentUser, onProfileUpdated, onSwitchView, individuals }) {
  const [displayName, setDisplayName] = useState(currentUser?.display_name || '')
  const [email, setEmail] = useState(currentUser?.email || '')
  const [profileMsg, setProfileMsg] = useState('')
  const [profileError, setProfileError] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const [mfaEnabled, setMfaEnabled] = useState(() => Number(currentUser?.totp_enabled) === 1)
  const [mfaSetupData, setMfaSetupData] = useState(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaMsg, setMfaMsg] = useState('')
  const [mfaError, setMfaError] = useState('')
  const [mfaBusy, setMfaBusy] = useState(false)
  const [backupCodes, setBackupCodes] = useState(null)
  const [disableOpen, setDisableOpen] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [secretCopied, setSecretCopied] = useState(false)
  const [signoutMsg, setSignoutMsg] = useState('')
  const [dnaTested, setDnaTested] = useState(() => Number(currentUser?.dna_tested) === 1)
  const [dnaMsg, setDnaMsg] = useState('')
  const [dnaSaving, setDnaSaving] = useState(false)

  useEffect(() => {
    setDisplayName(currentUser?.display_name || '')
    setEmail(currentUser?.email || '')
    setMfaEnabled(Number(currentUser?.totp_enabled) === 1)
    setDnaTested(Number(currentUser?.dna_tested) === 1)
  }, [currentUser?.display_name, currentUser?.email, currentUser?.totp_enabled, currentUser?.dna_tested])

  const isAdmin = currentUser?.role === 'admin'
  const linkedPerson = currentUser?.individual_id ? individuals?.get?.(currentUser.individual_id) : null
  const linkedPersonName = linkedPerson ? cleanName(linkedPerson.name) : (currentUser?.individual_id || '')

  const handleProfileSave = async (e) => {
    e.preventDefault()
    setProfileMsg('')
    setProfileError('')
    setSavingProfile(true)
    try {
      const res = await changeProfile({ display_name: displayName.trim(), email: email.trim() })
      if (res.ok) {
        setProfileMsg('Profile updated.')
        if (res.user && onProfileUpdated) onProfileUpdated(res.user)
      } else {
        setProfileError(res.error || 'Update failed')
      }
    } catch (err) {
      setProfileError(err.message || 'Update failed')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleMfaSetup = async () => {
    setMfaError('')
    setMfaMsg('')
    setMfaBusy(true)
    try {
      const res = await mfaSetup()
      if (res.enabled) {
        setMfaEnabled(true)
      } else if (res.secret) {
        setMfaSetupData({ secret: res.secret, otpauth: res.otpauth })
      } else {
        setMfaError(res.error || 'Could not start 2FA setup')
      }
    } catch (err) {
      setMfaError(err.message || 'Could not start 2FA setup')
    } finally {
      setMfaBusy(false)
    }
  }

  const handleMfaConfirm = async (e) => {
    e.preventDefault()
    setMfaError('')
    setMfaMsg('')
    setMfaBusy(true)
    try {
      const res = await mfaConfirm(mfaCode.trim())
      if (res.ok && res.backupCodes) {
        setBackupCodes(res.backupCodes)
        setMfaEnabled(true)
        setMfaSetupData(null)
        setMfaCode('')
        setMfaMsg('Two-factor authentication is now enabled.')
      } else {
        setMfaError(res.error || 'That code did not match')
      }
    } catch (err) {
      setMfaError(err.message || 'That code did not match')
    } finally {
      setMfaBusy(false)
    }
  }

  const handleMfaDisable = async (e) => {
    e.preventDefault()
    setMfaError('')
    setMfaMsg('')
    setMfaBusy(true)
    try {
      const res = await mfaDisable(disablePassword, disableCode.trim())
      if (res.ok) {
        setMfaEnabled(false)
        setDisableOpen(false)
        setDisablePassword('')
        setDisableCode('')
        setBackupCodes(null)
        setMfaMsg('Two-factor authentication has been disabled.')
      } else {
        setMfaError(res.error || 'Could not disable 2FA')
      }
    } catch (err) {
      setMfaError(err.message || 'Could not disable 2FA')
    } finally {
      setMfaBusy(false)
    }
  }

  const copySecret = async () => {
    if (!mfaSetupData?.secret) return
    try {
      await navigator.clipboard.writeText(mfaSetupData.secret)
      setSecretCopied(true)
      window.setTimeout(() => setSecretCopied(false), 2000)
    } catch {
      setMfaError('Copy not available â€” select the secret text instead.')
    }
  }

  const copyBackupCodes = async () => {
    if (!backupCodes) return
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'))
      setMfaMsg('Backup codes copied.')
    } catch {
      setMfaError('Copy not available â€” write them down now.')
    }
  }

  const handleSignOutEverywhere = async () => {
    if (!window.confirm('Sign out everywhere except this device?')) return
    setSignoutMsg('')
    try {
      const res = await signOutEverywhere()
      if (res.ok) {
        setSignoutMsg('All other sessions have been signed out. This device stays signed in.')
      } else {
        setSignoutMsg('Could not reach the server â€” nothing changed.')
      }
    } catch {
      setSignoutMsg('Could not reach the server â€” nothing changed.')
    }
  }

  const handleDnaTested = async (e) => {
    const checked = e.target.checked
    setDnaTested(checked)
    setDnaMsg('')
    setDnaSaving(true)
    try {
      const res = await setDnaTested(checked)
      if (res.ok) {
        setDnaMsg(checked ? 'Marked as DNA tested.' : 'Marked as not tested.')
        if (res.user && onProfileUpdated) onProfileUpdated(res.user)
      } else {
        setDnaTested(!checked)
        setDnaMsg(res.error || 'Could not save.')
      }
    } catch (err) {
      setDnaTested(!checked)
      setDnaMsg(err.message || 'Could not save.')
    } finally {
      setDnaSaving(false)
    }
  }

  const handlePasswordSave = async (e) => {
    e.preventDefault()
    setPasswordMsg('')
    setPasswordError('')
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }
    setSavingPassword(true)
    try {
      const res = await changePassword({ current_password: currentPassword, new_password: newPassword })
      if (res.ok) {
        setPasswordMsg('Password changed.')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setPasswordError(res.error || 'Password change failed')
      }
    } catch (err) {
      setPasswordError(err.message || 'Password change failed')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="view-page">
      <div className="account-container">
        <div className="view-header">
          <div>
            <h1>My account</h1>
            <p className="view-sub">Manage your profile and password</p>
          </div>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => onSwitchView('members')}>
              <i className="fas fa-users"></i> Site members
            </button>
          )}
        </div>

        <div className="account-grid">
          {/* Profile */}
          <section className="view-card account-card">
            <h2 className="account-card-title">Profile</h2>
            <form className="account-form" onSubmit={handleProfileSave}>
              <label className="account-label" htmlFor="display_name">Display name</label>
              <input
                id="display_name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
                required
              />

              <label className="account-label" htmlFor="account_email">Email</label>
              <input
                id="account_email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />

              {profileError && <p className="account-error" role="alert">{profileError}</p>}
              {profileMsg && <p className="account-success" role="status">{profileMsg}</p>}

              <div className="account-actions">
                <button type="submit" className="btn btn-primary" disabled={savingProfile} aria-busy={savingProfile}>
                  {savingProfile ? 'Saving...' : 'Save profile'}
                </button>
              </div>
            </form>
          </section>

          {/* Password */}
          <section className="view-card account-card">
            <h2 className="account-card-title">Change password</h2>
            <form className="account-form" onSubmit={handlePasswordSave}>
              <label className="account-label" htmlFor="current_password">Current password</label>
              <input
                id="current_password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />

              <label className="account-label" htmlFor="new_password">New password</label>
              <input
                id="new_password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                placeholder="At least 8 characters"
              />

              <label className="account-label" htmlFor="confirm_password">Confirm new password</label>
              <input
                id="confirm_password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                placeholder="Repeat your new password"
              />

              {passwordError && <p className="account-error" role="alert">{passwordError}</p>}
              {passwordMsg && <p className="account-success" role="status">{passwordMsg}</p>}

              <div className="account-actions">
                <button type="submit" className="btn btn-primary" disabled={savingPassword} aria-busy={savingPassword}>
                  {savingPassword ? 'Changing...' : 'Change password'}
                </button>
              </div>
            </form>
          </section>

          {/* Two-factor authentication */}
          <section className="view-card account-card">
            <h2 className="account-card-title"><i className="fas fa-shield-halved" aria-hidden="true"></i> Two-factor authentication</h2>

            {mfaEnabled ? (
              <>
                <p className="account-success" role="status"><i className="fas fa-circle-check" aria-hidden="true"></i> Two-factor authentication is enabled. You will be asked for a code from your authenticator app each time you sign in.</p>
                {!disableOpen ? (
                  <div className="account-actions">
                    <button type="button" className="btn btn-outline" onClick={() => setDisableOpen(true)}>
                      <i className="fas fa-shield" aria-hidden="true"></i> Disable 2FA
                    </button>
                  </div>
                ) : (
                  <form className="account-form mfa-disable-form" onSubmit={handleMfaDisable}>
                    <p className="account-note">Disabling 2FA makes your account less secure. Enter your password and a current authenticator (or backup) code.</p>
                    <label className="account-label" htmlFor="disable_password">Current password</label>
                    <input id="disable_password" type="password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} autoComplete="current-password" required />
                    <label className="account-label" htmlFor="disable_code">Authenticator code</label>
                    <input id="disable_code" type="text" inputMode="numeric" autoComplete="one-time-code" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} placeholder="123456 or backup code" required />
                    <div className="account-actions">
                      <button type="submit" className="btn btn-reject" disabled={mfaBusy}>{mfaBusy ? 'Disabling...' : 'Disable 2FA'}</button>
                      <button type="button" className="btn btn-sm" onClick={() => setDisableOpen(false)}>Cancel</button>
                    </div>
                  </form>
                )}
              </>
            ) : !mfaSetupData ? (
              <>
                <p className="account-note">Add a one-time code from an authenticator app (Google Authenticator, Authy, Microsoft Authenticator, 1Password) on top of your password.</p>
                {mfaMsg && <p className="account-success" role="status">{mfaMsg}</p>}
                {mfaError && <p className="account-error" role="alert">{mfaError}</p>}
                <div className="account-actions">
                  <button type="button" className="btn btn-primary" onClick={handleMfaSetup} disabled={mfaBusy}>
                    <i className="fas fa-shield-halved" aria-hidden="true"></i> {mfaBusy ? 'Starting...' : 'Set up 2FA'}
                  </button>
                </div>
              </>
            ) : (
              <div className="mfa-setup">
                <ol className="mfa-steps">
                  <li>Open your authenticator app and choose <strong>Add account</strong> (or <strong>Enter a setup key</strong>).</li>
                  <li>Choose account type <strong>Time-based</strong>.</li>
                  <li>Paste or type the setup key below:</li>
                </ol>
                <div className="mfa-secret">
                  <code>{mfaSetupData.secret}</code>
                  <button type="button" className="btn btn-sm" onClick={copySecret}>
                    <i className={`fas ${secretCopied ? 'fa-check' : 'fa-copy'}`} aria-hidden="true"></i> {secretCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <form className="account-form" onSubmit={handleMfaConfirm}>
                  <label className="account-label" htmlFor="mfa_confirm_code">Enter the 6-digit code your app shows</label>
                  <input
                    id="mfa_confirm_code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    placeholder="123456"
                    required
                  />
                  {mfaError && <p className="account-error" role="alert">{mfaError}</p>}
                  <div className="account-actions">
                    <button type="submit" className="btn btn-primary" disabled={mfaBusy || mfaCode.trim().length !== 6}>
                      {mfaBusy ? 'Enabling...' : 'Enable 2FA'}
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => { setMfaSetupData(null); setMfaError('') }}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {mfaEnabled && mfaError && <p className="account-error" role="alert">{mfaError}</p>}
            {mfaEnabled && mfaMsg && <p className="account-success" role="status">{mfaMsg}</p>}

            {backupCodes && (
              <div className="mfa-backup">
                <strong><i className="fas fa-key" aria-hidden="true"></i> Save your 8 backup codes</strong>
                <p>Each code works once, in case you lose your authenticator. They will not be shown again.</p>
                <ul className="mfa-codes">
                  {backupCodes.map((c) => <li key={c}><code>{c}</code></li>)}
                </ul>
                <div className="account-actions">
                  <button type="button" className="btn btn-sm" onClick={copyBackupCodes}><i className="fas fa-copy" aria-hidden="true"></i> Copy all</button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setBackupCodes(null)}>I saved them</button>
                </div>
              </div>
            )}
          </section>

          {/* Sessions */}
          <section className="view-card account-card">
            <h2 className="account-card-title">Sessions</h2>
            <p className="account-note">If you signed in on a shared or lost device, you can sign your account out everywhere else. This device stays signed in.</p>
            <div className="account-actions">
              <button type="button" className="btn btn-outline" onClick={handleSignOutEverywhere}>
                <i className="fas fa-right-from-bracket" aria-hidden="true"></i> Sign out everywhere else
              </button>
            </div>
            {signoutMsg && <p className="account-success" role="status">{signoutMsg}</p>}
          </section>

          {/* Your DNA */}
          <section className="view-card account-card">
            <h2 className="account-card-title"><i className="fas fa-dna" aria-hidden="true"></i> Your DNA</h2>
            <p className="account-note">Have you taken a DNA test? Flip this on and relatives browsing the site will know a kit exists â€” so they ask about shared matches before spending on a second one. It never shares your results.</p>
            <label className="dna-tested-toggle" htmlFor="dna_tested_toggle">
              <input
                id="dna_tested_toggle"
                type="checkbox"
                checked={dnaTested}
                onChange={handleDnaTested}
                disabled={dnaSaving}
              />
              <span>Yes, I&rsquo;ve taken a DNA test</span>
            </label>
            {dnaMsg && <p className="account-success" role="status">{dnaMsg}</p>}
            <div className="account-actions" style={{ marginTop: 10 }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => onSwitchView && onSwitchView('dna-matches')}>
                <i className="fas fa-people-arrows" aria-hidden="true"></i> Family matches page
              </button>
            </div>
          </section>

          {/* Account details */}
          <section className="view-card account-card account-details">
            <h2 className="account-card-title">Account details</h2>
            <dl className="account-details-list">
              <div>
                <dt>Role</dt>
                <dd><span className={`account-badge ${isAdmin ? 'admin' : 'member'}`}>{currentUser?.role || 'member'}</span></dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd><span className={`account-badge status-${currentUser?.status || 'active'}`}>{currentUser?.status || 'active'}</span></dd>
              </div>
              <div>
                <dt>Linked person</dt>
                <dd>{linkedPersonName || 'Not linked'}</dd>
              </div>
            </dl>
            {isAdmin && (
              <p className="account-note">
                You are an administrator. Use <button className="link-button" type="button" onClick={() => onSwitchView('members')}>Site members</button> to approve new registrations.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
