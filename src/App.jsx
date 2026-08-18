import React, { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import TreeView from './components/TreeView'
import PeopleView from './components/PeopleView'
import SearchView from './components/SearchView'
import ImportView from './components/ImportView'
import PersonModal from './components/PersonModal'
import { parseGEDCOM } from './utils/gedcomParser'
import { fetchExport, importGedcom, syncStatus, startSync, abortSync, updateIndividual } from './utils/api'

function App() {
  const [data, setData] = useState(null)
  const [individuals, setIndividuals] = useState(new Map())
  const [families, setFamilies] = useState(new Map())
  const [currentView, setCurrentView] = useState('tree')
  const [selectedPersonId, setSelectedPersonId] = useState(null)
  const [layoutMode, setLayoutMode] = useState('flat')
  const [importStatus, setImportStatus] = useState(null)
  const [serverStatus, setServerStatus] = useState({ type: 'loading', message: 'Connecting to server...' })
  const [syncState, setSyncState] = useState({ active: false, state: 'idle', message: '', progress: 0 })

  // Load data: server (MySQL via PHP API) is the source of truth,
  // localStorage acts as an offline cache/fallback.
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
          // Empty server DB — fall back to cached local data if any
          const saved = localStorage.getItem('familyTreeData')
          if (saved) {
            applyData(JSON.parse(saved))
            setServerStatus({ type: 'info', message: 'Server has no data yet — showing cached data. Use Import to load from database.' })
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
            setServerStatus({ type: 'error', message: `Server unavailable (${err.message}) — showing cached data.` })
          } catch {
            setServerStatus({ type: 'error', message: `Server unavailable (${err.message}).` })
          }
        } else {
          setServerStatus({ type: 'error', message: `Server unavailable (${err.message}).` })
        }
      })

    return () => { cancelled = true }
  }, [])

  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (data) {
      try {
        localStorage.setItem('familyTreeData', JSON.stringify(data))
      } catch (e) {
        console.error('Error saving data:', e)
      }
    }
  }, [data])

  // Poll sync status while a sync is running
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
            // Reload tree data from the freshly-synced database
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
          setSyncState({
            active: false,
            state: 'error',
            message: res.error || 'Sync could not start',
            progress: 0,
          })
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

                setImportStatus({
                  type: 'success',
                  message: `Imported ${result.individuals.length} people and ${result.families.length} families to the database!`
                })

                setTimeout(() => {
                  setCurrentView('tree')
                  setImportStatus(null)
                }, 1500)
              })
              .catch((dbErr) => {
                console.error('DB import error:', dbErr)
                // Server may be down — keep local-only import as fallback
                setData(result)
                const indMap = new Map()
                result.individuals.forEach(p => indMap.set(p.id, p))
                setIndividuals(indMap)
                const famMap = new Map()
                result.families.forEach(f => famMap.set(f.id, f))
                setFamilies(famMap)
                localStorage.setItem('familyTreeData', JSON.stringify(result))
                setImportStatus({
                  type: 'success',
                  message: `Imported ${result.individuals.length} people locally (database save failed: ${dbErr.message}).`
                })
                setTimeout(() => {
                  setCurrentView('tree')
                  setImportStatus(null)
                }, 1500)
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
  }, [])

  const handleCloseModal = useCallback(() => {
    setSelectedPersonId(null)
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

  const selectedPerson = selectedPersonId ? individuals.get(selectedPersonId) : null

  return (
    <div className="app">
      <Header
        currentView={currentView}
        onSwitchView={handleSwitchView}
        onImportClick={() => setCurrentView('import')}
        hasData={!!data}
        onSyncClick={handleSync}
        syncing={syncState.active}
      />

      <main className="main-content">
        <div className="status-stack">
          {syncState.active && (
            <div className="server-banner info sync-banner">
            <i className="fas fa-sync fa-spin"></i>
            <span>{syncState.message}</span>
            {syncState.progress > 0 && (
              <div className="sync-progress">
                <progress className="sync-progress-bar" value={syncState.progress} max="100" aria-label="Sync progress">
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

        {currentView === 'tree' && (
          <TreeView
            data={data}
            individuals={individuals}
            families={families}
            onSelectPerson={handleSelectPerson}
            layoutMode={layoutMode}
            onLayoutModeChange={setLayoutMode}
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
      </main>

      {selectedPerson && (
        <PersonModal
          person={selectedPerson}
          individuals={individuals}
          families={families}
          onClose={handleCloseModal}
          onSelectPerson={handleSelectPerson}
          onUpdatePerson={handleUpdatePerson}
        />
      )}
    </div>
  )
}

export default App
