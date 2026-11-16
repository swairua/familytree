import React, { useEffect, useMemo, useState } from 'react'
import PersonAvatar from './PersonAvatar'
import { fetchUsers, userAction, userSetPassword, userSetEmail } from '../utils/api'
import '../styles/sitemembers.css'

const PAGE_SIZE = 10
const isPlaceholderEmail = (email) => (email || '').endsWith('@placeholder.invalid')

function SiteMembersView({ currentUser, onSelectPerson }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [sort, setSort] = useState('status')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchUsers()
      if (res.ok) {
        setUsers(res.users || [])
      } else {
        setError(res.error || 'Could not load members')
      }
    } catch (err) {
      setError(err.message || 'Could not load members')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const setEmail = async (u) => {
    const next = window.prompt(`Set a real email for ${u.display_name || u.email}\nLeave it as-is or type the member's address:`, u.email)
    if (next === null) return
    const trimmed = next.trim()
    if (trimmed === u.email) return
    setBusyId(u.id)
    setError('')
    try {
      const res = await userSetEmail(u.id, trimmed)
      if (res.ok) {
        await load()
      } else {
        setError(res.error || 'Could not set email')
      }
    } catch (err) {
      setError(err.message || 'Could not set email')
    } finally {
      setBusyId(null)
    }
  }

  const setPassword = async (u) => {
    const pw = window.prompt(`Set a new password for ${u.email}\n(at least 8 characters, share it with the member privately):`)
    if (pw === null) return
    if (pw.length < 8) {
      window.alert('Password must be at least 8 characters.')
      return
    }
    setBusyId(u.id)
    setError('')
    try {
      const res = await userSetPassword(u.id, pw)
      if (!res.ok) setError(res.error || 'Could not set password')
    } catch (err) {
      setError(err.message || 'Could not set password')
    } finally {
      setBusyId(null)
    }
  }

  const act = async (action, id) => {
    setBusyId(id)
    setError('')
    try {
      const res = await userAction(action, id)
      if (res.ok) {
        await load()
      } else {
        setError(res.error || 'Action failed')
      }
    } catch (err) {
      setError(err.message || 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  const filtered = useMemo(() => {
    let arr = users
    const q = query.trim().toLowerCase()
    if (q) {
      arr = arr.filter(u =>
        (u.display_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      )
    }
    const sorted = [...arr]
    if (sort === 'name') sorted.sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''))
    else if (sort === 'email') sorted.sort((a, b) => (a.email || '').localeCompare(b.email || ''))
    else if (sort === 'created') sorted.sort((a, b) => (a.id || 0) - (b.id || 0))
    else sorted.sort((a, b) => (String(a.status) === 'pending' ? -1 : 1) - (String(b.status) === 'pending' ? -1 : 1) || (a.id || 0) - (b.id || 0))
    return sorted
  }, [users, query, sort])

  // Reset to first page when the filter/sort changes
  useEffect(() => { setPage(1) }, [query, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  )

  const pendingCount = users.filter(u => u.status === 'pending').length
  const myId = currentUser?.id

  return (
    <div className="sm-view">
      <div className="sm-container">
        <div className="sm-header">
          <h1>Site members</h1>
          <span className="sm-count">
            {users.length} member{users.length === 1 ? '' : 's'}
            {pendingCount > 0 ? ` · ${pendingCount} pending approval` : ''}
          </span>
        </div>

        <div className="sm-controls">
          <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort members">
            <option value="status">Sort by status</option>
            <option value="name">Sort by name</option>
            <option value="email">Sort by email</option>
            <option value="created">Sort by registered</option>
          </select>
          <input
            placeholder="Find a member"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search members"
          />
          <button className="btn btn-sm" onClick={load} disabled={loading}>
            <i className={`fas fa-rotate-right ${loading ? 'fa-spin' : ''}`}></i> Refresh
          </button>
        </div>

        {error && <p className="sm-error" role="alert">{error}</p>}

        {loading ? (
          <div className="sm-empty"><i className="fas fa-spinner fa-spin"></i> Loading members...</div>
        ) : filtered.length === 0 ? (
          <div className="sm-empty">
            <i className="fas fa-users"></i>
            <p>{users.length === 0 ? 'No registered members yet.' : 'No members match your search.'}</p>
          </div>
        ) : (
          <div className="sm-table-wrap">
            <table className="sm-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Linked person</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((u, i) => {
                  const self = myId != null && String(u.id) === String(myId)
                  return (
                    <tr key={u.id} className={u.status === 'pending' ? 'sm-row-pending' : ''}>
                      <td>{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                      <td className="sm-name">
                        <PersonAvatar
                          person={{
                            name: u.individual_name || u.display_name || '',
                            photo: u.photo || u.individual_photo || '',
                            gender: u.individual_gender || 'unknown',
                          }}
                          className="sm-avatar"
                        />
                        <div>
                          <span>{u.display_name || 'Unnamed'}</span>
                          {self && <span className="sm-you-badge">you</span>}
                        </div>
                      </td>
                      <td>{isPlaceholderEmail(u.email)
                        ? <span className="sm-muted" title="Placeholder — real address not set yet">— not set</span>
                        : u.email}</td>
                      <td>
                        {u.individual_id ? (
                          <button className="sm-link" onClick={() => onSelectPerson && onSelectPerson(u.individual_id)}>
                            {u.individual_name || u.individual_id}
                          </button>
                        ) : (
                          <span className="sm-muted">Not linked</span>
                        )}
                      </td>
                      <td><span className={`sm-badge sm-role-${u.role}`}>{u.role}</span></td>
                      <td><span className={`sm-badge sm-status-${u.status}`}>{u.status}</span></td>
                      <td>
                        <div className="sm-actions">
                          {u.status !== 'active' && (
                            <button
                              className="btn btn-sm btn-approve"
                              disabled={busyId === u.id}
                              onClick={() => act('user-approve', u.id)}
                              title="Approve account"
                            >
                              <i className="fas fa-check"></i> Approve
                            </button>
                          )}
                          {u.status !== 'rejected' && (
                            <button
                              className="btn btn-sm btn-reject"
                              disabled={busyId === u.id}
                              onClick={() => act('user-reject', u.id)}
                              title="Reject account"
                            >
                              <i className="fas fa-ban"></i> Reject
                            </button>
                          )}
                          <button
                            className="btn btn-sm btn-setemail"
                            disabled={busyId === u.id}
                            onClick={() => setEmail(u)}
                            title="Set the member's email"
                          >
                            <i className="fas fa-envelope"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-setpw"
                            disabled={busyId === u.id}
                            onClick={() => setPassword(u)}
                            title="Set a password for this member"
                          >
                            <i className="fas fa-key"></i>
                          </button>
                          {!self && u.id !== 1 && (
                            <button
                              className="btn btn-sm btn-delete"
                              disabled={busyId === u.id}
                              onClick={() => {
                                if (window.confirm(`Delete account for ${u.email}? This cannot be undone.`)) {
                                  act('user-delete', u.id)
                                }
                              }}
                              title="Delete account"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="sm-pagination">
              <span className="sm-pagination-info">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="sm-pagination-controls">
                <button
                  className="btn btn-sm btn-page"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  aria-label="Previous page"
                >
                  <i className="fas fa-chevron-left"></i>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    className={`btn btn-sm btn-page ${n === currentPage ? 'active' : ''}`}
                    onClick={() => setPage(n)}
                    aria-current={n === currentPage ? 'page' : undefined}
                  >
                    {n}
                  </button>
                ))}
                <button
                  className="btn btn-sm btn-page"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  aria-label="Next page"
                >
                  <i className="fas fa-chevron-right"></i>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SiteMembersView
