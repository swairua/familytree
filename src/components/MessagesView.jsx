import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { fetchInbox, fetchSent, fetchMessage, sendMessage, markMessageRead, markAllMessagesRead, fetchDirectory } from '../utils/api'
import '../styles/messages.css'

const TABS = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'sent', label: 'Sent' },
  { id: 'compose', label: 'Compose' },
]

function MessagesView({ currentUser, onSwitchView, onUnreadRecount }) {
  const [tab, setTab] = useState('inbox')
  const [folder, setFolder] = useState('inbox')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [currentMessage, setCurrentMessage] = useState(null)
  const [composing, setComposing] = useState(false)
  const [recipients, setRecipients] = useState([])

  const [toUserId, setToUserId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [sendOk, setSendOk] = useState('')

  const loadFolder = useCallback(async (which) => {
    setLoading(true)
    setError('')
    try {
      const res = which === 'inbox' ? await fetchInbox() : await fetchSent()
      if (res.ok) setMessages(res.messages || [])
      else setError(res.error || 'Could not load messages')
    } catch (err) {
      setError(err.message || 'Could not load messages')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadFolder(folder) }, [folder, loadFolder])

  const loadCurrentMessage = useCallback(async (id) => {
    setSelectedId(id)
    setComposing(false)
    setCurrentMessage(null)
    try {
      const res = await fetchMessage(id)
      if (res.ok) {
        setCurrentMessage(res.message)
        if (folder === 'inbox') onUnreadRecount?.()
      } else {
        setError(res.error || 'Could not load message')
      }
    } catch (err) {
      setError(err.message || 'Could not load message')
    }
  }, [folder, onUnreadRecount])

  const startCompose = async (prefillSubject = '', prefillBody = '', toId = '') => {
    setTab('compose')
    setSelectedId(null)
    setCurrentMessage(null)
    setComposing(true)
    setSendError('')
    setSendOk('')
    setSubject(prefillSubject)
    setBody(prefillBody)
    setToUserId(toId || '')
    if (recipients.length === 0) {
      try {
        const res = await fetchDirectory()
        if (res.ok) setRecipients((res.users || []).filter(u => u.id !== currentUser?.id))
      } catch { /* ignore */ }
    }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    setSending(true)
    setSendError('')
    setSendOk('')
    try {
      const res = await sendMessage({ toUserId: Number(toUserId), subject: subject.trim(), body: body.trim() })
      if (res.ok) {
        setSendOk('Message sent.')
        setComposing(false)
        setSubject('')
        setBody('')
        setToUserId('')
        // Re-focus inbox after send
        setFolder('sent')
      } else {
        setSendError(res.error || 'Send failed')
      }
    } catch (err) {
      setSendError(err.message || 'Send failed')
    } finally {
      setSending(false)
    }
  }

  const selected = useMemo(() => messages.find(m => m.id === selectedId) || null, [messages, selectedId])

  return (
    <div className="view-page messages-page">
      <div className="messages-shell">
        {/* Left rail: list */}
        <aside className="messages-rail">
          <div className="messages-rail-header">
            <h1>Messages</h1>
            <button className="btn btn-primary btn-sm" onClick={() => startCompose()}><i className="fas fa-pen"></i> Compose</button>
          </div>
          <div className="messages-tabs" role="tablist">
            <button className={`messages-tab ${folder === 'inbox' ? 'active' : ''}`} role="tab" onClick={() => setFolder('inbox')}>
              <i className="fas fa-inbox"></i> Inbox
            </button>
            <button className={`messages-tab ${folder === 'sent' ? 'active' : ''}`} role="tab" onClick={() => setFolder('sent')}>
              <i className="fas fa-paper-plane"></i> Sent
            </button>
          </div>
          <div className="messages-list" role="list">
            {loading && <div className="sm-empty"><i className="fas fa-spinner fa-spin"></i> Loading...</div>}
            {error && <p className="account-error">{error}</p>}
            {!loading && messages.length === 0 && <p className="messages-empty"><i className="fas fa-envelope-open-text"></i> No messages yet.</p>}
            {!loading && messages.map(m => (
              <button
                key={m.id}
                className={`messages-item ${selectedId === m.id ? 'active' : ''} ${folder === 'inbox' && !m.is_read ? 'unread' : ''}`}
                onClick={() => loadCurrentMessage(m.id)}
              >
                <div className="messages-item-top">
                  <strong>{m.from_name || m.to_name || 'Unknown'}</strong>
                  <span className="messages-date">{new Date(m.created_at).toLocaleDateString()}</span>
                </div>
                <div className="messages-item-subject">{m.subject || '(no subject)'}</div>
                <div className="messages-item-preview">{(m.body || '').slice(0, 80)}</div>
              </button>
            ))}
            {folder === 'inbox' && messages.some(m => !m.is_read) && (
              <div className="messages-mark-all">
                <button className="btn btn-sm btn-outline" onClick={async () => { await markAllMessagesRead(); loadFolder('inbox') }}>
                  <i className="fas fa-check-double"></i> Mark all as read
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Right pane: content */}
        <main className="messages-pane">
          {composing && (
            <form className="messages-compose" onSubmit={handleSend}>
              <h2>New message</h2>
              <div className="account-form">
                <label className="account-label" htmlFor="to_user_id">Send to</label>
                <select id="to_user_id" value={toUserId} onChange={e => setToUserId(e.target.value)} required>
                  <option value="">Select recipient...</option>
                  {recipients.map(u => (
                    <option key={u.id} value={u.id}>{u.display_name || u.email || `User #${u.id}`}</option>
                  ))}
                </select>
                <label className="account-label" htmlFor="subject">Subject</label>
                <input id="subject" type="text" value={subject} onChange={e => setSubject(e.target.value)} maxLength={255} placeholder="Subject" />
                <label className="account-label" htmlFor="body">Message</label>
                <textarea id="body" rows="8" value={body} onChange={e => setBody(e.target.value)} required placeholder="Write your message..." />
                {sendError && <p className="account-error" role="alert">{sendError}</p>}
                {sendOk && <p className="account-success" role="status">{sendOk}</p>}
                <div className="account-actions">
                  <button type="submit" className="btn btn-primary" disabled={sending} aria-busy={sending}>
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => composing && setComposing(false)}>Cancel</button>
                </div>
              </div>
            </form>
          )}

          {!composing && currentMessage && (
            <article className="messages-view">
              <div className="messages-view-header">
                <h2>{currentMessage.subject || '(no subject)'}</h2>
                <div className="messages-view-meta">
                  <div><strong>From:</strong> {currentMessage.from_name}</div>
                  <div><strong>To:</strong> {currentMessage.to_name}</div>
                  <div><strong>Date:</strong> {new Date(currentMessage.created_at).toLocaleString()}</div>
                </div>
                <div className="messages-view-actions">
                  <button className="btn btn-outline" onClick={() => startCompose(currentMessage.subject ? `Re: ${currentMessage.subject}` : '', `\n\n---\n${currentMessage.body}`, currentMessage.from_user_id)}>
                    <i className="fas fa-reply"></i> Reply
                  </button>
                </div>
              </div>
              <div className="messages-view-body">
                {currentMessage.body}
              </div>
            </article>
          )}

          {!composing && !currentMessage && (
            <div className="messages-pane-placeholder">
              <i className="fas fa-envelope fa-3x"></i>
              <h2>Your messages</h2>
              <p>Inbox for site members. Click any message to read it.</p>
              <button className="btn btn-primary" onClick={() => startCompose()}><i className="fas fa-pen"></i> Compose</button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default MessagesView
