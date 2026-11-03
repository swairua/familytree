import React, { useMemo, useState, useCallback } from 'react'
import SidebarTree from './SidebarTree'

function Sidebar({
  individuals, families, currentView, onSwitchView, onSelectPerson,
  selectedPersonId, isCollapsed, onToggleCollapse, isMobileOpen, onCloseMobile,
  onSyncClick, syncing,
}) {
  const navItems = [
    { id: 'tree', label: 'Family Tree', icon: 'fa-sitemap' },
    { id: 'people', label: 'People', icon: 'fa-users' },
    { id: 'search', label: 'Search', icon: 'fa-search' },
    { id: 'import', label: 'Import GEDCOM', icon: 'fa-file-import' },
    { id: 'gallery', label: 'Photo Gallery', icon: 'fa-images' },
  ]

  const photoCount = useMemo(() => {
    let count = 0
    for (const p of individuals.values()) {
      if (p.photo) count++
    }
    return count
  }, [individuals])

  const personCount = individuals.size

  return (
    <>
      <div
        className={`sidebar-backdrop ${isMobileOpen ? 'visible' : ''}`}
        onClick={onCloseMobile}
      />
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <h3>Navigation</h3>
          <button className="sidebar-toggle" onClick={onToggleCollapse} title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <i className={`fas ${isCollapsed ? 'fa-angles-right' : 'fa-angles-left'}`}></i>
          </button>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            <i className="fas fa-user"></i>
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">Family Tree Owner</div>
            <div className="sidebar-user-site">{personCount} people{photoCount > 0 ? ` \u00B7 ${photoCount} photos` : ''}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`sidebar-nav-item ${currentView === item.id ? 'active' : ''}`}
              onClick={() => onSwitchView(item.id)}
            >
              <i className={`fas ${item.icon}`}></i>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-tree">
          <div className="sidebar-tree-header">Family Drill-Down</div>
          <SidebarTree
            individuals={individuals}
            families={families}
            onSelectPerson={onSelectPerson}
            selectedPersonId={selectedPersonId}
          />
        </div>

        <div className="sidebar-footer">
          <button
            className={`btn btn-sync ${syncing ? 'syncing' : ''}`}
            onClick={onSyncClick}
            disabled={syncing}
          >
            <i className={`fas ${syncing ? 'fa-sync fa-spin' : 'fa-sync'}`}></i>
            <span>{syncing ? 'Syncing...' : 'Sync MyHeritage'}</span>
          </button>
        </div>
      </aside>
    </>
  )
}

export default React.memo(Sidebar)
