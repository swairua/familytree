import React, { useState, useCallback } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import SplitPane from './SplitPane'

function AppLayout({
  currentView, onSwitchView,
  individuals, families,
  onSelectPerson, onOpenPersonModal,
  selectedPersonId,
  data, onImportClick,
  onSyncClick, syncing,
  layoutMode, onLayoutModeChange,
  syncState, serverStatus,
  children,
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false)

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(c => !c)
  }, [])

  const openMobileSidebar = useCallback(() => {
    setSidebarMobileOpen(true)
  }, [])

  const closeMobileSidebar = useCallback(() => {
    setSidebarMobileOpen(false)
  }, [])

  const handleNavClick = useCallback((view) => {
    onSwitchView(view)
    setSidebarMobileOpen(false)
  }, [onSwitchView])

  const handleSelectFromSidebar = useCallback((id) => {
    onSelectPerson(id)
    setSidebarMobileOpen(false)
  }, [onSelectPerson])

  return (
    <div className="app">
      <Header
        currentView={currentView}
        onSwitchView={handleNavClick}
        onImportClick={onImportClick}
        hasData={!!data}
        onSyncClick={onSyncClick}
        syncing={syncing}
        onToggleMobileSidebar={openMobileSidebar}
      />
      <div className="app-body">
        <Sidebar
          individuals={individuals}
          families={families}
          currentView={currentView}
          onSwitchView={handleNavClick}
          onSelectPerson={handleSelectFromSidebar}
          selectedPersonId={selectedPersonId}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          isMobileOpen={sidebarMobileOpen}
          onCloseMobile={closeMobileSidebar}
          onSyncClick={onSyncClick}
          syncing={syncing}
        />
        <main className="main-content">
          <div className="status-stack">
            {syncState.active && (
              <div className="server-banner info sync-banner">
                <i className="fas fa-sync fa-spin"></i>
                <span>{syncState.message}</span>
                {syncState.progress > 0 && (
                  <div className="sync-progress">
                    <progress className="sync-progress-bar" value={syncState.progress} max="100">
                      {syncState.progress}%
                    </progress>
                  </div>
                )}
              </div>
            )}
            {serverStatus.type === 'loading' && (
              <div className="server-banner loading"><i className="fas fa-spinner fa-spin"></i> {serverStatus.message}</div>
            )}
            {serverStatus.type === 'success' && (
              <div className="server-banner success"><i className="fas fa-database"></i> {serverStatus.message}</div>
            )}
            {serverStatus.type === 'info' && (
              <div className="server-banner info"><i className="fas fa-info-circle"></i> {serverStatus.message}</div>
            )}
            {serverStatus.type === 'error' && (
              <div className="server-banner error"><i className="fas fa-exclamation-triangle"></i> {serverStatus.message}</div>
            )}
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}

export default AppLayout
