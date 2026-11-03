import React, { useState, useRef, useEffect } from 'react'

function Header({ currentView, onSwitchView, onImportClick, hasData, onSyncClick, syncing, onToggleMobileSidebar }) {
  const [openMenu, setOpenMenu] = useState(null)
  const navRef = useRef(null)
  useEffect(() => {
    const onClick = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const navItems = [
    { id: 'home', label: 'Home', icon: 'fa-home', children: [
        { id: 'home', label: 'Overview' },
        { id: 'events', label: 'Family Events' },
        { id: 'stats', label: 'Family Statistics' },
        { id: 'members', label: 'Site Members' },
    ]},
    { id: 'tree', label: 'Family tree', icon: 'fa-sitemap' },
    { id: 'discoveries', label: 'Discoveries', icon: 'fa-compass' },
    { id: 'gallery', label: 'Photos', icon: 'fa-images' },
    { id: 'search', label: 'DNA', icon: 'fa-dna' },
    { id: 'research', label: 'Research', icon: 'fa-book' },
  ]

  return (
    <header className="main-header">
      <div className="header-left">
        <button className="mobile-menu-btn" onClick={onToggleMobileSidebar} title="Open menu">
          <i className="fas fa-bars"></i>
        </button>
        <div className="logo">
          <span className="logo-mark" aria-hidden="true">
            <i className="fas fa-tree"></i>
          </span>
          <span className="logo-wordmark">Wairua</span>
          <span className="logo-context">Family site</span>
        </div>
      </div>
      <nav className="main-nav">
        {navItems.map(item => (
          item.children ? (
            <div key={item.id} className="nav-dropdown" ref={navRef}>
              <a
                href="#"
                className={`nav-link nav-home ${['home','events','stats','members'].includes(currentView) ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); onSwitchView(item.id); setOpenMenu(openMenu === item.id ? null : item.id) }}
              >
                <span>{item.label}</span>
                <i
                  className="fas fa-caret-down nav-caret"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenMenu(openMenu === item.id ? null : item.id) }}
                ></i>
              </a>
              <div className={`nav-dropdown-menu ${openMenu === item.id ? 'open' : ''}`}>
                {item.children.map(child => (
                  <a
                    key={child.id}
                    href="#"
                    className={`nav-dropdown-item ${currentView === child.id ? 'active' : ''}`}
                    onClick={(e) => { e.preventDefault(); onSwitchView(child.id); setOpenMenu(null) }}
                  >
                    {child.label}
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <a
              key={item.id}
              href="#"
              className={`nav-link ${currentView === item.id ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault()
                onSwitchView(item.id)
              }}
            >
              <span>{item.label}</span>
            </a>
          )
        ))}
      </nav>
      <div className="header-actions">
        <button
          className="btn btn-sync"
          onClick={onSyncClick}
          disabled={syncing}
          title="Re-pull the latest data from MyHeritage and update the database"
        >
          <i className={`fas ${syncing ? 'fa-spinner fa-spin' : 'fa-sync'}`}></i>
          <span>{syncing ? 'Syncing...' : 'Sync'}</span>
        </button>
        <button className="btn btn-primary" onClick={onImportClick}>
          <i className="fas fa-file-import"></i>
          <span>Import GEDCOM</span>
        </button>
      </div>
    </header>
  )
}

export default Header
