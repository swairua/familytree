import React, { useEffect, useState } from 'react'
import { changeProfile, changePassword } from '../utils/api'
import { cleanName } from '../utils/cleanName'
import '../styles/account.css'

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

  useEffect(() => {
    setDisplayName(currentUser?.display_name || '')
    setEmail(currentUser?.email || '')
  }, [currentUser?.display_name, currentUser?.email])

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
