import React from 'react'

function Header({ currentView, onSwitchView, onImportClick, hasData, onSyncClick, syncing, onToggleMobileSidebar }) {
  const navItems = [
    { id: 'tree', label: 'Family Tree', icon: 'fa-sitemap' },
    { id: 'people', label: 'People', icon: 'fa-users' },
    { id: 'search', label: 'Search', icon: 'fa-search' },
    { id: 'import', label: 'Import', icon: 'fa-file-import' },
    { id: 'gallery', label: 'Gallery', icon: 'fa-images' },
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
          <span className="logo-wordmark">MyHeritage</span>
          <span className="logo-context">Family tree</span>
        </div>
      </div>
      <nav className="main-nav">
        {navItems.map(item => (
          <a
            key={item.id}
            href="#"
            className={`nav-link ${currentView === item.id ? 'active' : ''}`}
            onClick={(e) => {
              e.preventDefault()
              onSwitchView(item.id)
            }}
          >
            <i className={`fas ${item.icon}`}></i>
            <span>{item.label}</span>
          </a>
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
