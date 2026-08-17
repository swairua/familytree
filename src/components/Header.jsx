import React from 'react'

function Header({ currentView, onSwitchView, onImportClick, hasData, onSyncClick, syncing }) {
  const navItems = [
    { id: 'tree', label: 'Family Tree', icon: 'fa-sitemap' },
    { id: 'people', label: 'People', icon: 'fa-users' },
    { id: 'search', label: 'Search', icon: 'fa-search' },
    { id: 'import', label: 'Import', icon: 'fa-file-import' }
  ]

  return (
    <header className="main-header">
      <div className="logo">
        <i className="fas fa-tree"></i>
        <span>Family Tree</span>
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
          {syncing ? ' Syncing...' : ' Sync'}
        </button>
        <button className="btn btn-primary" onClick={onImportClick}>
          <i className="fas fa-file-import"></i> Import GEDCOM
        </button>
      </div>
    </header>
  )
}

export default Header