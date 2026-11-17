import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react'
import AppLayout from './components/AppLayout'
import { parseGEDCOM } from './utils/gedcomParser'
import { fetchExport, fetchMe, fetchRecentActivity, importGedcom, logout, syncStatus, startSync, abortSync, updateIndividual, fetchUnreadCount } from './utils/api'
import LoginView from './components/LoginView'
import './styles/home.css'

const HomeView = lazy(() => import('./components/HomeView'))
const TreeView = lazy(() => import('./components/TreeView'))
const DiscoveriesView = lazy(() => import('./components/DiscoveriesView'))
const MatchesByPeopleView = lazy(() => import('./components/MatchesByPeopleView'))
const MatchesBySourceView = lazy(() => import('./components/MatchesBySourceView'))
const FamilyEventsView = lazy(() => import('./components/FamilyEventsView'))
const FamilyStatsView = lazy(() => import('./components/FamilyStatsView'))
const SiteMembersView = lazy(() => import('./components/SiteMembersView'))
const ResearchView = lazy(() => import('./components/ResearchView'))
const PeopleView = lazy(() => import('./components/PeopleView'))
const SearchView = lazy(() => import('./components/SearchView'))
const ImportView = lazy(() => import('./components/ImportView'))
const GalleryView = lazy(() => import('./components/GalleryView'))
const TreesView = lazy(() => import('./components/TreesView'))
const PrintView = lazy(() => import('./components/PrintView'))
const MoreView = lazy(() => import('./components/MoreView'))
const FeatureView = lazy(() => import('./components/FeatureView'))
const DnaLearnView = lazy(() => import('./components/DnaLearnView'))
const DnaMatchesView = lazy(() => import('./components/DnaMatchesView'))
const AccountView = lazy(() => import('./components/AccountView'))
const SettingsView = lazy(() => import('./components/SettingsView'))
const ForgotPasswordView = lazy(() => import('./components/ForgotPasswordView'))
const ResetPasswordView = lazy(() => import('./components/ResetPasswordView'))
const PersonDetailView = lazy(() => import('./components/PersonDetailView'))
const SignUpView = lazy(() => import('./components/SignUpView'))
const EnrollView = lazy(() => import('./components/EnrollView'))
const MessagesView = lazy(() => import('./components/MessagesView'))

function App() {
  const [data, setData] = useState(null)
  const [individuals, setIndividuals] = useState(new Map())
  const [families, setFamilies] = useState(new Map())
  const [currentView, setCurrentView] = useState('home')
  const [selectedPersonId, setSelectedPersonId] = useState(null)
  const [layoutMode, setLayoutMode] = useState('pedigree')
  const [importStatus, setImportStatus] = useState(null)
  const [serverStatus, setServerStatus] = useState({ type: 'loading', message: 'Connecting to server...' })
  const [currentUser, setCurrentUser] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [initialThreadId, setInitialThreadId] = useState(null)
  const [resetToken, setResetToken] = useState(null)
  const [enrollToken, setEnrollToken] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [syncState, setSyncState] = useState({ active: false, state: 'idle', message: '', progress: 0 })
  const [recentActivity, setRecentActivity] = useState({ entries: [], syncedAt: null })
  // Poll unread message count every 30s while signed in
  useEffect(() => {
    if (!currentUser) return
    let cancelled = false
    const tick = async () => {
      try {
        const res = await fetchUnreadCount()
        if (!cancelled && res?.ok) setUnreadCount(res.count || 0)
      } catch { /* ignore */ }
    }
    tick()
    const t = setInterval(tick, 30000)
    return () => { cancelled = true; clearInterval(t) }
  }, [currentUser])

  // Refresh unread count when switching views (cheap)
  useEffect(() => {
    if (!currentUser) return
    fetchUnreadCount().then(r => { if (r?.ok) setUnreadCount(r.count || 0) }).catch(() => {})
  }, [currentView, currentUser])

  // Refetch unread count after auth-related actions
  const refreshUnread = useCallback(async () => {
    try {
      const res = await fetchUnreadCount()
      if (res?.ok) setUnreadCount(res.count || 0)
    } catch { /* ignore */ }
  }, [])


  // Deep link: /?view=reset-password&token=... opens the reset flow directly;
  // /?view=messages&thread=N opens that message thread.
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      if (p.get('view') === 'reset-password' && p.get('token')) {
        setResetToken(p.get('token'))
        setCurrentView('reset-password')
      }
      if (p.get('view') === 'messages' && p.get('thread')) {
        setInitialThreadId(Number(p.get('thread')))
        setCurrentView('messages')
      }
      if (p.get('view') === 'research') {
        setCurrentView('research')
      }
      if (p.get('view') === 'dna-learn') {
        setCurrentView('dna-learn')
      }
      if (p.get('view') === 'dna-matches') {
        setCurrentView('dna-matches')
      }
      if (p.get('view') === 'enroll' && p.get('token')) {
        setEnrollToken(p.get('token'))
        setCurrentView('enroll')
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    const applyData = (parsed) => {
      if (cancelled) return
      setData(parsed)
      const indMap = new Map()
      parsed.individuals.forEach(p => indMap.set(p.id, p))
      setIndividuals(indMap)
      const famMap = new Map()
      parsed.families.forEach(f => famMap.set(f.id, f))
      setFamilies(famMap)
    }

    fetchExport()
      .then((res) => {
        if (cancelled) return
        if (res.ok && res.individuals.length > 0) {
          applyData(res)
          localStorage.setItem('familyTreeData', JSON.stringify(res))
          setServerStatus({ type: 'success', message: `Loaded ${res.individuals.length} people from server.` })
        } else {
          const saved = localStorage.getItem('familyTreeData')
          if (saved) {
            applyData(JSON.parse(saved))
            setServerStatus({ type: 'info', message: 'Server has no data yet â€” showing cached data. Use Import to load from database.' })
          } else {
            setServerStatus({ type: 'info', message: 'Server is ready. Import a GEDCOM file to begin.' })
          }
        }
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Server load failed:', err)
        const saved = localStorage.getItem('familyTreeData')
        if (saved) {
          try {
            applyData(JSON.parse(saved))
            setServerStatus({ type: 'error', message: `Server unavailable (${err.message}) â€” showing cached data.` })
          } catch {
            setServerStatus({ type: 'error', message: `Server unavailable (${err.message}).` })
          }
        } else {
          setServerStatus({ type: 'error', message: `Server unavailable (${err.message}).` })
        }
      })

    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchMe()
      .then(res => { if (!cancelled) setCurrentUser(res?.user ?? null) })
      .catch(() => { if (!cancelled) setCurrentUser(null) })
      .finally(() => { if (!cancelled) setAuthLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchRecentActivity()
      .then(res => { if (!cancelled && res.ok) setRecentActivity(res) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (data) {
      try {
        localStorage.setItem('familyTreeData', JSON.stringify(data))
      } catch (e) {
        console.error('Error saving data:', e)
      }
    }
  }, [data])

  useEffect(() => {
    if (!syncState.active) return
    let cancelled = false
    const poll = () => {
      syncStatus()
        .then((res) => {
          if (cancelled) return
          const s = res.status || {}
          setSyncState({
            active: s.state === 'running' || s.state === 'starting',
            state: s.state || 'idle',
            message: s.message || '',
            progress: Number(s.progress) || 0,
          })
          if (s.state === 'done') {
            fetchExport()
              .then((exp) => {
                if (cancelled || !(exp.ok && exp.individuals.length > 0)) return
                const indMap = new Map()
                exp.individuals.forEach(p => indMap.set(p.id, p))
                setIndividuals(indMap)
                const famMap = new Map()
                exp.families.forEach(f => famMap.set(f.id, f))
                setFamilies(famMap)
                setData(exp)
                localStorage.setItem('familyTreeData', JSON.stringify(exp))
              })
              .catch((err) => {
                if (!cancelled) console.error('Reload after sync failed:', err)
              })
          }
        })
        .catch((err) => {
          if (cancelled) return
          setSyncState({ active: false, state: 'error', message: `Sync error: ${err.message}`, progress: 0 })
        })
    }
    poll()
    const timer = setInterval(poll, 2000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [syncState.active])

  const handleSync = useCallback(() => {
    if (syncState.active) {
      abortSync().catch(err => console.error('Abort failed:', err))
      return
    }
    setSyncState({ active: true, state: 'starting', message: 'Starting sync...', progress: 0 })
    startSync()
      .then((res) => {
        if (!res.ok) {
          setSyncState({ active: false, state: 'error', message: res.error || 'Sync could not start', progress: 0 })
        }
      })
      .catch((err) => {
        setSyncState({ active: false, state: 'error', message: `Sync failed to start: ${err.message}`, progress: 0 })
      })
  }, [syncState.active])

  const handleImport = useCallback((file) => {
    setImportStatus({ type: 'info', message: `Reading ${file.name}...` })

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target.result
        setImportStatus({ type: 'info', message: 'Parsing GEDCOM data...' })

        setTimeout(() => {
          try {
            const result = parseGEDCOM(content)

            if (result.individuals.length === 0) {
              setImportStatus({ type: 'error', message: 'No individuals found in the GEDCOM file. Please check the file format.' })
              return
            }

            setImportStatus({ type: 'info', message: `Saving ${result.individuals.length} people to database...` })

            importGedcom(content)
              .then((serverRes) => {
                setData(result)
                const indMap = new Map()
                result.individuals.forEach(p => indMap.set(p.id, p))
                setIndividuals(indMap)
                const famMap = new Map()
                result.families.forEach(f => famMap.set(f.id, f))
                setFamilies(famMap)
                localStorage.setItem('familyTreeData', JSON.stringify(result))
                setImportStatus({ type: 'success', message: `Imported ${result.individuals.length} people and ${result.families.length} families to the database!` })
                setTimeout(() => { setCurrentView('tree'); setImportStatus(null) }, 1500)
              })
              .catch((dbErr) => {
                console.error('DB import error:', dbErr)
                setData(result)
                const indMap = new Map()
                result.individuals.forEach(p => indMap.set(p.id, p))
                setIndividuals(indMap)
                const famMap = new Map()
                result.families.forEach(f => famMap.set(f.id, f))
                setFamilies(famMap)
                localStorage.setItem('familyTreeData', JSON.stringify(result))
                setImportStatus({ type: 'success', message: `Imported ${result.individuals.length} people locally (database save failed: ${dbErr.message}).` })
                setTimeout(() => { setCurrentView('tree'); setImportStatus(null) }, 1500)
              })
          } catch (parseError) {
            console.error('Parse error:', parseError)
            setImportStatus({ type: 'error', message: `Error parsing GEDCOM file: ${parseError.message}` })
          }
        }, 100)
      } catch (readError) {
        console.error('Read error:', readError)
        setImportStatus({ type: 'error', message: `Error reading file: ${readError.message}` })
      }
    }

    reader.onerror = () => {
      setImportStatus({ type: 'error', message: 'Error reading the file. Please try again.' })
    }

    reader.readAsText(file)
  }, [])

  const handleSelectPerson = useCallback((id) => {
    setSelectedPersonId(id)
    setCurrentView('person')
  }, [])

  const handleUpdatePerson = useCallback(async (id, fields) => {
    setServerStatus({ type: 'info', message: 'Saving person...' })
    try {
      const res = await updateIndividual(id, fields)
      const updated = res.individual
      setIndividuals(prev => {
        const next = new Map(prev)
        next.set(id, updated)
        return next
      })
      setData(prev => {
        if (!prev) return prev
        const individuals = prev.individuals.map(p => (p.id === id ? updated : p))
        return { ...prev, individuals }
      })
      setServerStatus({ type: 'success', message: 'Person updated.' })
      return updated
    } catch (err) {
      setServerStatus({ type: 'error', message: `Update failed: ${err.message}` })
      throw err
    }
  }, [])

  const handleSwitchView = useCallback((view) => {
    setCurrentView(view)
  }, [])

  const handleLogout = useCallback(() => {
    logout().finally(() => {
      setCurrentUser(null)
      setCurrentView('home')
    })
  }, [])

  const selectedPerson = selectedPersonId ? individuals.get(selectedPersonId) : null

  if (authLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f3ef', color: '#8b7355' }}>
        <div><i className="fas fa-spinner fa-spin"></i> Loadingâ€¦</div>
      </div>
    )
  }

  if (!currentUser) {
    const authFallback = (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f3ef', color: '#8b7355' }}>
        <div><i className="fas fa-spinner fa-spin"></i> Loadingâ€¦</div>
      </div>
    )
    if (currentView === 'forgot-password') {
      return (
        <Suspense fallback={authFallback}>
          <ForgotPasswordView onBackToLogin={() => setCurrentView('home')} />
        </Suspense>
      )
    }
    if (currentView === 'reset-password') {
      return (
        <Suspense fallback={authFallback}>
          <ResetPasswordView token={resetToken} onBackToLogin={() => setCurrentView('home')} />
        </Suspense>
      )
    }
    if (currentView === 'signup') {
      return (
        <Suspense fallback={authFallback}>
          <SignUpView onBackToLogin={() => setCurrentView('home')} />
        </Suspense>
      )
    }
    if (currentView === 'enroll') {
      return (
        <Suspense fallback={authFallback}>
          <EnrollView onLoggedIn={(user) => { setCurrentUser(user); setCurrentView('home'); }} />
        </Suspense>
      )
    }
    return (
      <LoginView
        onLoggedIn={(u) => {
          setCurrentUser(u)
          setCurrentView('tree')
        }}
        onSwitchView={handleSwitchView}
      />
    )
  }

  return (
    <AppLayout
      currentView={currentView}
      onSwitchView={handleSwitchView}
      unreadCount={unreadCount}
      currentUser={currentUser}
      onImportClick={() => setCurrentView('import')}
      individuals={individuals}
      families={families}
      onSelectPerson={handleSelectPerson}
      selectedPersonId={selectedPersonId}
      data={data}
      onSyncClick={handleSync}
      syncing={syncState.active}
      layoutMode={layoutMode}
      onLayoutModeChange={setLayoutMode}
      syncState={syncState}
      serverStatus={serverStatus}
      onLogout={handleLogout}
    >
      <Suspense fallback={<div style={{ padding: 48, textAlign: 'center', color: '#8b7355' }}><i className="fas fa-spinner fa-spin"></i> Loadingâ€¦</div>}>
      {currentView === 'home' && (
        <HomeView
          individuals={individuals}
          families={families}
          onSelectPerson={handleSelectPerson}
          onSwitchView={handleSwitchView}
          recentActivity={recentActivity}
          creatorId={currentUser?.individual_id || null}
        />
      )}

      {currentView === 'research' && (
        <ResearchView
          individuals={individuals}
          onSelectPerson={handleSelectPerson}
        />
      )}

      {currentView === 'events' && (
        <FamilyEventsView individuals={individuals} families={families} onSelectPerson={handleSelectPerson} />
      )}

      {currentView === 'stats' && (
        <FamilyStatsView individuals={individuals} families={families} />
      )}

      {currentView === 'members' && (
        <SiteMembersView
          currentUser={currentUser}
          onSelectPerson={handleSelectPerson}
        />
      )}

      {currentView === 'settings' && (
        currentUser?.role === 'admin' ? (
          <SettingsView
            currentUser={currentUser}
            onSwitchView={handleSwitchView}
          />
        ) : (
          <div className="view-page">
            <div className="account-container">
              <div className="view-card">
                <h2 className="account-card-title">Settings</h2>
                <p className="account-error" role="alert">Administrator access required.</p>
              </div>
            </div>
          </div>
        )
      )}

      {currentView === 'account' && (
        <AccountView
          currentUser={currentUser}
          onProfileUpdated={(u) => setCurrentUser(u)}
          onSwitchView={handleSwitchView}
          individuals={individuals}
        />
      )}

      {currentView === 'discoveries' && (
        <DiscoveriesView
          individuals={individuals}
          onSelectPerson={handleSelectPerson}
          onSwitchView={handleSwitchView}
        />
      )}

      {currentView === 'matchesByPeople' && (
        <MatchesByPeopleView
          individuals={individuals}
          onSelectPerson={handleSelectPerson}
          onSwitchView={handleSwitchView}
        />
      )}

      {currentView === 'matchesBySource' && (
        <MatchesBySourceView
          individuals={individuals}
          onSelectPerson={handleSelectPerson}
          onSwitchView={handleSwitchView}
        />
      )}

      {['colorize', 'enhance', 'nostalgia', 'livememory', 'scribeai', 'dna'].includes(currentView) && (
        <FeatureView
          featureKey={currentView}
          onSwitchView={handleSwitchView}
        />
      )}

      {currentView === 'dna-learn' && (
        <DnaLearnView onSwitchView={handleSwitchView} />
      )}

      {currentView === 'dna-matches' && (
        <DnaMatchesView currentUser={currentUser} onSwitchView={handleSwitchView} />
      )}

      {currentView === 'tree' && (
        <TreeView
          data={data}
          individuals={individuals}
          families={families}
          onSelectPerson={handleSelectPerson}
          layoutMode={layoutMode}
          onLayoutModeChange={setLayoutMode}
          anchorId={currentUser?.individual_id || null}
          onUpdatePerson={handleUpdatePerson}
        />
      )}

      {currentView === 'people' && (
        <PeopleView
          individuals={individuals}
          onSelectPerson={handleSelectPerson}
        />
      )}

      {currentView === 'search' && (
        <SearchView
          individuals={individuals}
          onSelectPerson={handleSelectPerson}
        />
      )}

      {currentView === 'import' && (
        <ImportView
          onImport={handleImport}
          status={importStatus}
        />
      )}

      {currentView === 'gallery' && (
        <GalleryView
          individuals={individuals}
          onSelectPerson={handleSelectPerson}
        />
      )}

      {currentView === 'trees' && (
        <TreesView
          individuals={individuals}
          onSwitchView={handleSwitchView}
        />
      )}

      {currentView === 'print' && (
        <PrintView
          individuals={individuals}
          families={families}
          onSwitchView={handleSwitchView}
          currentUser={currentUser}
        />
      )}

      {currentView === 'more' && (
        <MoreView
          individuals={individuals}
          onSwitchView={handleSwitchView}
          onSyncClick={handleSync}
          syncing={syncState.active}
        />
      )}

      {currentView === 'person' && selectedPerson && (
        <PersonDetailView
          person={selectedPerson}
          individuals={individuals}
          families={families}
          onSelectPerson={handleSelectPerson}
          onBack={() => setCurrentView('tree')}
          onUpdatePerson={handleUpdatePerson}
        />
      )}

      {currentView === 'messages' && (
        <MessagesView
          currentUser={currentUser}
          onSwitchView={handleSwitchView}
          onUnreadRecount={refreshUnread}
          initialThreadId={initialThreadId}
        />
      )}
      </Suspense>
    </AppLayout>
  )
}

export default App


