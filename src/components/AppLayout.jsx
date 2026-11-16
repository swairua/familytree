import React from 'react'
import Header from './Header'

function AppLayout({
  currentView, onSwitchView,
  individuals, families,
  onSelectPerson, onOpenPersonModal,
  selectedPersonId,
  data, onImportClick,
  onSyncClick, syncing,
  layoutMode, onLayoutModeChange,
  syncState, serverStatus,
  onLogout,
  currentUser,
  children,
}) {
  return (
    <div className="app">
      <Header
        currentView={currentView}
        onSwitchView={onSwitchView}
        onImportClick={onImportClick}
        hasData={!!data}
        onSyncClick={onSyncClick}
        syncing={syncing}
        onLogout={onLogout}
        currentUser={currentUser}
      />
      <div className="app-body">
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
