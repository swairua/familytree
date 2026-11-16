import React, { useState, useRef, useEffect, useMemo } from 'react'

function Header({ currentView, onSwitchView, onImportClick, hasData, onSyncClick, syncing, onLogout, currentUser, unreadCount = 0 }) {
  const [openMenu, setOpenMenu] = useState(null)
  const navRef = useRef(null)
  const isAdmin = currentUser?.role === 'admin'

  useEffect(() => {
    const onClick = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const navItems = useMemo(() => [
    { id: 'home', label: 'Home', icon: 'fa-home', children: [
        { id: 'home', label: 'Overview' },
        { id: 'events', label: 'Family events' },
        { id: 'stats', label: 'Family statistics' },
        ...(isAdmin ? [{ id: 'members', label: 'Site members' }] : []),
        ...(isAdmin ? [{ id: 'settings', label: 'Settings' }] : []),
        { id: 'messages', label: 'Messages' },
    ]},
    { id: 'tree', label: 'Family tree', icon: 'fa-sitemap', children: [
        { id: 'tree', label: 'My family tree' },
        { id: 'gallery', label: 'My photos' },
        { id: 'trees', label: 'Manage trees' },
        { id: 'print', label: 'Print charts & books' },
        { id: 'more', label: 'More…' },
    ]},
    { id: 'discoveries', label: 'Discoveries', icon: 'fa-compass', children: [
        { id: 'matchesByPeople', label: 'Matches by people' },
        { id: 'matchesBySource', label: 'Matches by source' },
    ]},
    { id: 'gallery', label: 'Photos', icon: 'fa-images', children: [
        { id: 'gallery', label: 'My photos' },
        { id: 'colorize', label: 'Colorize photos' },
        { id: 'enhance', label: 'Enhance photos' },
        { id: 'nostalgia', label: 'Deep Nostalgia™' },
        { id: 'livememory', label: 'LiveMemory™' },
        { id: 'scribeai', label: 'Scribe AI' },
    ]},
    { id: 'research', label: 'DNA', icon: 'fa-dna' },
    { id: 'research', label: 'Research', icon: 'fa-book' },
  ], [isAdmin])



  return (
    <header className="mh-header">
      {/* Utility bar */}
      <div className="mh-utility">
        <div className="mh-utility-left">
          <button className="mh-site-name" onClick={() => onSwitchView('home')}>
            TheWairuaHeritage
            <i className="fas fa-caret-down"></i>
          </button>
          <button className="mh-util-btn" onClick={onSyncClick} title="Sync from TheWairuaHeritage">
            <i className={`fas ${syncing ? 'fa-spinner fa-spin' : 'fa-sync'}`}></i>
          </button>
          <button className="mh-util-btn" onClick={() => onSwitchView('messages')} title={`Messages${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`} aria-label={`Messages${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}>
            <i className="fas fa-envelope"></i>
            {unreadCount > 0 && <span className="mh-util-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>
          <button className="mh-util-btn" onClick={onImportClick} title="Import GEDCOM">
            <i className="fas fa-file-import"></i>
          </button>
          {isAdmin && (
            <button className="mh-util-btn" onClick={() => onSwitchView('settings')} title="Site settings">
              <i className="fas fa-cog"></i>
            </button>
          )}
        </div>
        <div className="mh-utility-right">
          <button className="mh-premium">Go PremiumPlus</button>
          <button className="mh-util-btn mh-cart" title="Cart">
            <i className="fas fa-shopping-cart"></i>
            <span className="mh-cart-badge">1</span>
          </button>
          <button className="mh-user" onClick={() => onSwitchView('account')} title="My account">
            <i className="fas fa-user-circle"></i>
            <span>{currentUser?.display_name || 'Account'}</span>
            <i className="fas fa-caret-down"></i>
          </button>
          <button className="mh-util-btn" title="Help">
            <i className="fas fa-question-circle"></i>
            <span className="mh-help-label">Help</span>
            <i className="fas fa-caret-down"></i>
          </button>
          <button className="mh-util-btn" title="English">
            <i className="fas fa-globe"></i>
            <span className="mh-help-label">English</span>
          </button>
          <button className="mh-util-btn" title="Sign out" onClick={onLogout}>
            <i className="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </div>

      {/* Nav row */}
      <div className="mh-nav-row">
        <div className="mh-logo">
          <span className="mh-logo-icon"></span>
          <span className="mh-logo-text">TheWairuaHeritage</span>
        </div>
        <nav className="mh-nav" ref={navRef}>
          {navItems.map(item => (
            item.children ? (
              <div
                key={item.id}
                className="mh-nav-item mh-nav-dropdown"
                onMouseEnter={() => setOpenMenu(item.id)}
                onMouseLeave={() => setOpenMenu(null)}
              >
                <button
                  className={`mh-nav-link ${item.children && item.children.some(child => child.id === currentView) ? 'active' : ''}`}
                  onClick={(e) => { e.preventDefault(); onSwitchView(item.id); setOpenMenu(openMenu === item.id ? null : item.id) }}
                >
                  {item.label}
                </button>
                <div className={`mh-dropdown ${openMenu === item.id ? 'open' : ''}`}>
                  {item.children.map(child => (
                    <button
                      key={child.id}
                      className={`mh-dropdown-item ${currentView === child.id ? 'active' : ''}`}
                      onClick={() => { onSwitchView(child.id); setOpenMenu(null) }}
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div key={item.id} className="mh-nav-item">
                <button
                  className={`mh-nav-link ${currentView === item.id ? 'active' : ''}`}
                  onClick={() => onSwitchView(item.id)}
                >
                  {item.label}
                </button>
              </div>
            )
          ))}
        </nav>
      </div>
    </header>
  )
}

export default Header
