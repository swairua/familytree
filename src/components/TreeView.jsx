import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { photoUrl } from '../utils/photoUrl'
import PersonAvatar from './PersonAvatar'

const NODE_WIDTH = 184
const NODE_HEIGHT = 72
const H_GAP = 32
const V_GAP = 52
const ZOOM_MIN = 0.04
const ZOOM_MAX = 2.5
const GENDER_ICONS = { male: '\u2642', female: '\u2640', unknown: '\u25CB' }

function TreeView({ data, individuals, families, onSelectPerson }) {
  const containerRef = useRef(null)
  // zoom/pan start null => effective view is auto-computed (fit-to-screen on first load)
  const [zoom, setZoom] = useState(null)
  const [pan, setPan] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  const [showLegend, setShowLegend] = useState(true)
  const isPanning = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })
  const dragStart = useRef(null)
  const suppressClick = useRef(false)
  const pinchRef = useRef(null)

  const personCount = individuals.size
  const familyCount = families.size
  const selectedPerson = selectedId ? individuals.get(selectedId) : null

  // Track container size
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect
      setViewport({ w: rect.width, h: rect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Calculate tree layout
  const treeLayout = useMemo(() => {
    if (individuals.size === 0) return { nodes: [], links: [], posMap: new Map(), width: 0, height: 0 }

    // ---- structural pass: build descendant subtrees bottom-up ----
    const memo = new Map()
    function build(id, path) {
      if (memo.has(id)) return memo.get(id)
      const person = individuals.get(id)
      if (!person || path.has(id)) return null

      const spouses = (person.spouses || []).filter(s => individuals.has(s) && !path.has(s))
      const kids = (person.children || []).filter(c => individuals.has(c) && !path.has(c))

      const coupleCount = 1 + spouses.length
      const coupleW = coupleCount * NODE_WIDTH + (coupleCount - 1) * H_GAP

      const newPath = new Set(path)
      newPath.add(id)
      const childStructs = kids.map(k => build(k, newPath)).filter(Boolean)
      const kidsW = childStructs.length
        ? childStructs.reduce((s, c) => s + c.width, 0) + (childStructs.length - 1) * H_GAP
        : 0

      const struct = {
        id,
        spouses,
        children: childStructs,
        width: Math.max(coupleW, kidsW),
        height: NODE_HEIGHT + (childStructs.length ? V_GAP + Math.max(...childStructs.map(c => c.height)) : 0),
      }
      memo.set(id, struct)
      return struct
    }

    // roots: people with no recorded parents
    let roots = []
    for (const [id, person] of individuals) {
      if ((!person.parents || person.parents.length === 0)) roots.push(id)
    }
    if (roots.length === 0) roots = Array.from(individuals.keys())

    // Anchor the tree on the oldest generation first
    roots.sort((a, b) => {
      const yearOf = (x) => {
        const m = (x.birthYear || '').match(/\d{4}/)
        return m ? +m[0] : 9999
      }
      const d = yearOf(individuals.get(a)) - yearOf(individuals.get(b))
      return d !== 0 ? d : (a < b ? -1 : 1)
    })

    const components = []
    for (const r of roots) {
      if (memo.has(r)) continue
      const st = build(r, new Set())
      if (st) components.push(st)
    }

    // ---- placement pass: assign absolute coordinates top-down ----
    const nodes = []
    const links = []
    const pos = new Map()
    const placedGlobal = new Set()

    function place(st, left, top) {
      if (placedGlobal.has(st.id)) return null
      const spouses = st.spouses.filter(s => !placedGlobal.has(s))
      const coupleC = 1 + spouses.length
      const coupleW = coupleC * NODE_WIDTH + (coupleC - 1) * H_GAP

      placedGlobal.add(st.id)
      spouses.forEach(s => placedGlobal.add(s))

      const kidsW = st.children.length
        ? st.children.reduce((s, c) => s + c.width, 0) + (st.children.length - 1) * H_GAP
        : 0

      const coupleX = left + (st.width - coupleW) / 2
      const kidsX = left + (st.width - kidsW) / 2

      pos.set(st.id, { x: coupleX, y: top })
      spouses.forEach((s, i) => pos.set(s, { x: coupleX + (i + 1) * (NODE_WIDTH + H_GAP), y: top }))

      // marriage link between partners
      const midX = coupleX + coupleW / 2
      spouses.forEach((s) => {
        const p = pos.get(st.id)
        const sp = pos.get(s)
        const y = top + NODE_HEIGHT / 2
        links.push({ type: 'marriage', x1: p.x + NODE_WIDTH, y1: y, x2: sp.x, y2: y })
      })

      // children subtrees + parent-child links
      const childTop = top + NODE_HEIGHT + V_GAP
      const fromX = midX
      const fromY = top + NODE_HEIGHT
      let cx = kidsX
      for (const cs of st.children) {
        const childCx = place(cs, cx, childTop)
        if (childCx != null) {
          links.push({ type: 'child', x1: fromX, y1: fromY, x2: childCx, y2: childTop })
        }
        cx += cs.width + H_GAP
      }

      return midX
    }

    let top = 0
    let maxWidth = 0
    for (const st of components) {
      const before = placedGlobal.size
      place(st, 0, top)
      if (placedGlobal.size > before) {
        maxWidth = Math.max(maxWidth, st.width)
        top += st.height + V_GAP
      }
    }

    // Orphan pass
    const orphanIslands = []
    const used = new Set()
    for (const [id, person] of individuals) {
      if (pos.has(id) || used.has(id)) continue
      const members = [id]
      for (const sib of person.siblings || []) {
        if (pos.has(sib) || used.has(sib)) continue
        members.push(sib)
        used.add(sib)
      }
      used.add(id)
      orphanIslands.push(members)
    }
    for (const members of orphanIslands) {
      const w = members.length * NODE_WIDTH + (members.length - 1) * H_GAP
      let x = 0
      for (const mid of members) {
        pos.set(mid, { x, y: top })
        x += NODE_WIDTH + H_GAP
      }
      maxWidth = Math.max(maxWidth, w)
      top += NODE_HEIGHT + V_GAP
    }

    for (const [id, p] of pos) {
      nodes.push({ id, x: p.x, y: p.y })
    }
    const height = components.length || orphanIslands.length ? top + NODE_HEIGHT : NODE_HEIGHT

    return { nodes, links, posMap: pos, width: maxWidth, height }
  }, [individuals])

  // ---- view computation (all pan/zoom is expressed through the SVG viewBox) ----
  const fitRect = useCallback((box, vw, vh, pad, minZ, maxZ) => {
    if (!vw || !vh || !box || !box.w || !box.h) return null
    const z = Math.min((vw - pad * 2) / box.w, (vh - pad * 2) / box.h)
    const clamped = Math.max(minZ, Math.min(maxZ, z))
    return {
      zoom: clamped,
      pan: {
        x: (vw - box.w * clamped) / 2 - box.x * clamped,
        y: (vh - box.h * clamped) / 2 - box.y * clamped,
      },
    }
  }, [])

  const fitAll = useCallback(() => {
    return fitRect(
      { x: 0, y: 0, w: treeLayout.width, h: treeLayout.height },
      viewport.w, viewport.h, 40, 0.006, 1
    )
  }, [treeLayout, viewport, fitRect])

  // Default (unengaged) view: anchored to the top-left (oldest generation roots)
  // at a legible zoom so names/dates are readable on open. Zoom 1 = layout units
  // map 1:1 to screen pixels (22px photo, ~12px text).
  const legibleDefault = useCallback(() => {
    return { zoom: 1, pan: { x: 20, y: 20 } }
  }, [])

  // Effective view: user-controlled once they interact, otherwise the legible default.
  // The SVG is only rendered once the viewport is known, so the first paint is
  // already correct => no flash/jump.
  const view = useMemo(() => {
    if (zoom !== null && pan !== null) return { zoom, pan }
    if (!viewport.w || !viewport.h) return null
    return legibleDefault()
  }, [zoom, pan, viewport, legibleDefault])

  const viewRef = useRef({ zoom: 1, pan: { x: 20, y: 20 } })
  if (view) viewRef.current = view

  const engage = useCallback(() => {
    setZoom(prev => (prev !== null ? prev : viewRef.current.zoom))
  }, [])

  const handleZoom = useCallback((delta) => {
    setZoom(prev => {
      const base = prev !== null ? prev : viewRef.current.zoom
      return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, base + delta))
    })
  }, [])

  // Native wheel listener so preventDefault actually works (React wheel is passive by default)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e) => {
      if (e.ctrlKey) return
      e.preventDefault()
      const factor = e.deltaY > 0 ? -0.08 : 0.08
      handleZoom(factor)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [handleZoom])

  // ---- pan (mouse) ----
  const handleMouseDown = useCallback((e) => {
    engage()
    isPanning.current = true
    dragStart.current = { x: e.clientX, y: e.clientY }
    const v = viewRef.current
    startPos.current = { x: e.clientX - v.pan.x, y: e.clientY - v.pan.y }
  }, [engage])

  const handleMouseMove = useCallback((e) => {
    if (!isPanning.current) return
    if (dragStart.current && (Math.abs(e.clientX - dragStart.current.x) > 4 || Math.abs(e.clientY - dragStart.current.y) > 4)) {
      suppressClick.current = true
    }
    setPan({ x: e.clientX - startPos.current.x, y: e.clientY - startPos.current.y })
  }, [])

  const handleMouseUp = useCallback(() => {
    isPanning.current = false
  }, [])

  // ---- touch: single-finger pan, two-finger pinch zoom + pan ----
  const handleTouchStart = useCallback((e) => {
    const touches = e.touches
    if (touches.length === 1) {
      engage()
      isPanning.current = true
      const v = viewRef.current
      startPos.current = { x: touches[0].clientX - v.pan.x, y: touches[0].clientY - v.pan.y }
      pinchRef.current = null
    } else if (touches.length === 2) {
      engage()
      isPanning.current = false
      const [a, b] = touches
      const v = viewRef.current
      pinchRef.current = {
        distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        zoom: v.zoom,
        midX: (a.clientX + b.clientX) / 2,
        midY: (a.clientY + b.clientY) / 2,
        panX: v.pan.x,
        panY: v.pan.y,
      }
    }
  }, [engage])

  const handleTouchMove = useCallback((e) => {
    const touches = e.touches
    if (pinchRef.current && touches.length === 2) {
      const [a, b] = touches
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      const midX = (a.clientX + b.clientX) / 2
      const midY = (a.clientY + b.clientY) / 2
      const start = pinchRef.current
      const ratio = dist / start.distance
      const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, start.zoom * ratio))
      const zoomRatio = nextZoom / start.zoom
      setPan({
        x: midX - (start.midX - start.panX) * zoomRatio,
        y: midY - (start.midY - start.panY) * zoomRatio,
      })
      setZoom(nextZoom)
      e.preventDefault()
    } else if (isPanning.current && touches.length === 1) {
      setPan({ x: touches[0].clientX - startPos.current.x, y: touches[0].clientY - startPos.current.y })
    }
  }, [])

  const handleTouchEnd = useCallback((e) => {
    if (e.touches.length === 0) {
      isPanning.current = false
      pinchRef.current = null
    } else if (e.touches.length === 1) {
      // one finger remains -> resume panning from current position
      isPanning.current = true
      const v = viewRef.current
      startPos.current = { x: e.touches[0].clientX - v.pan.x, y: e.touches[0].clientY - v.pan.y }
      pinchRef.current = null
    }
  }, [])

  const fitView = useCallback(() => {
    const v = fitAll()
    if (v) {
      setZoom(v.zoom)
      setPan(v.pan)
    }
  }, [fitAll])

  const resetView = useCallback(() => {
    setZoom(null)
    setPan(null)
  }, [])

  // Drill down: zoom the view onto a person and their descendants
  const drillTo = useCallback((id) => {
    const posMap = treeLayout.posMap
    const p = posMap.get(id)
    if (!p || !viewport.w || !viewport.h) return
    const visited = new Set()
    const stack = [id]
    let x0 = p.x, y0 = p.y, x1 = p.x + NODE_WIDTH, y1 = p.y + NODE_HEIGHT
    while (stack.length) {
      const cur = stack.pop()
      if (visited.has(cur)) continue
      visited.add(cur)
      const curP = posMap.get(cur)
      if (!curP) continue
      x0 = Math.min(x0, curP.x)
      y0 = Math.min(y0, curP.y)
      x1 = Math.max(x1, curP.x + NODE_WIDTH)
      y1 = Math.max(y1, curP.y + NODE_HEIGHT)
      const person = individuals.get(cur)
      for (const s of person?.spouses || []) {
        if (posMap.has(s) && !visited.has(s)) stack.push(s)
      }
      for (const c of person?.children || []) {
        if (posMap.has(c) && !visited.has(c)) stack.push(c)
      }
    }
    const v = fitRect({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, viewport.w, viewport.h, 30, 0.12, 1.6)
    if (v) {
      setZoom(v.zoom)
      setPan(v.pan)
    }
  }, [treeLayout, viewport, individuals, fitRect])

  const handlePersonClick = useCallback((id) => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    setSelectedId(id)
    onSelectPerson(id)
  }, [onSelectPerson])

  const formatDates = useCallback((person) => {
    const extractYear = (date) => {
      const match = date.match(/\d{4}/)
      return match ? match[0] : date
    }
    const birth = person.birthDate ? extractYear(person.birthDate) : '?'
    const death = person.deathDate ? extractYear(person.deathDate) : ''
    return death ? `${birth} - ${death}` : `${birth}`
  }, [])

  const renderToolbar = (hasData) => (
    <div className="tree-toolbar">
      <div className="toolbar-left">
        <span className="toolbar-label">Tree view</span>
        <button className="btn btn-icon" onClick={() => handleZoom(0.1)} title="Zoom In">
          <i className="fas fa-plus"></i>
        </button>
        <button className="btn btn-icon" onClick={() => handleZoom(-0.1)} title="Zoom Out">
          <i className="fas fa-minus"></i>
        </button>
        <span className="toolbar-zoom">{Math.round((view ? view.zoom : 1) * 100)}%</span>
        {hasData && (
          <button className="btn btn-icon" onClick={fitView} title="Fit to Screen">
            <i className="fas fa-expand"></i>
          </button>
        )}
        <button className="btn btn-icon" onClick={resetView} title="Reset View">
          <i className="fas fa-home"></i>
        </button>
      </div>
      <div className="toolbar-center">
        {hasData ? (
          <span>{personCount} people • {familyCount} families • double-click a person to zoom in</span>
        ) : (
          <span>No family tree loaded</span>
        )}
      </div>
      <div className="toolbar-right">
        {hasData && showLegend && (
          <div className="tree-legend">
            <span className="legend-dot male"></span> Male
            <span className="legend-dot female"></span> Female
            <span className="legend-dot unknown"></span> Unknown
            <span className="legend-dot deceased"></span> Deceased
          </div>
        )}
        <button
          className={`btn btn-icon ${showLegend ? 'active' : ''}`}
          onClick={() => setShowLegend(s => !s)}
          title="Toggle Legend"
        >
          <i className="fas fa-list-ul"></i>
        </button>
      </div>
    </div>
  )

  if (personCount === 0) {
    return (
      <div className="tree-container">
        {renderToolbar(false)}
        <div className="tree-canvas" ref={containerRef}>
          <div className="empty-state tree-empty-state">
            <i className="fas fa-tree"></i>
            <h2>Your Family Tree</h2>
            <p>Import a GEDCOM file to visualize your family tree</p>
            <button className="btn btn-primary btn-lg" onClick={() => onSelectPerson('__import__')}>
              <i className="fas fa-file-import"></i> Import GEDCOM File
            </button>
          </div>
        </div>
      </div>
    )
  }

  const linkPath = (link) => {
    if (link.type === 'marriage') {
      const my = link.y1
      return `M ${link.x1} ${my} L ${link.x2} ${my}`
    }
    const dx = link.x2 - link.x1
    const dy = link.y2 - link.y1
    const midY = link.y1 + dy / 2
    return `M ${link.x1} ${link.y1} C ${link.x1 + dx * 0.25} ${midY}, ${link.x2 - dx * 0.25} ${midY}, ${link.x2} ${link.y2}`
  }

  return (
    <div className="tree-container">
      {renderToolbar(true)}
      <div
        className="tree-canvas"
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {view && (
          <svg
            id="tree-svg"
            width="100%"
            height="100%"
            viewBox={`${-view.pan.x / view.zoom} ${-view.pan.y / view.zoom} ${viewport.w / view.zoom} ${viewport.h / view.zoom}`}
          >
            <defs>
              <filter id="tree-glow" x="-30%" y="-40%" width="160%" height="180%">
                <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="rgba(76, 63, 56, 0.22)" />
              </filter>
              <filter id="tree-glow-hover" x="-30%" y="-40%" width="160%" height="180%">
                <feDropShadow dx="0" dy="4" stdDeviation="7" floodColor="rgba(76, 63, 56, 0.3)" />
              </filter>
            </defs>

            {/* Links */}
            {treeLayout.links.map((link, i) => (
              <path
                key={`link-${i}`}
                d={linkPath(link)}
                className={`tree-link ${link.type || ''}`}
              />
            ))}

            {/* Nodes */}
            {treeLayout.nodes.map(node => {
              const person = individuals.get(node.id)
              if (!person) return null
              const isSelected = selectedId === node.id
              const deceased = !!(person.deathDate || person.deathYear)
              const safeId = node.id.replace(/[^a-zA-Z0-9_-]/g, '')
              return (
                <g
                  key={node.id}
                  className={`tree-node gender-${person.gender || 'unknown'} ${deceased ? 'deceased' : ''} ${isSelected ? 'selected' : ''}`}
                  data-id={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePersonClick(node.id)
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    drillTo(node.id)
                  }}
                >
                  <clipPath id={`node-card-clip-${safeId}`}>
                    <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx="8" ry="8" />
                  </clipPath>
                  <rect
                    className="node-card"
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx="8"
                    ry="8"
                  />
                  <rect
                    className="node-accent"
                    width="5"
                    height={NODE_HEIGHT}
                    rx="2.5"
                    ry="2.5"
                  />
                  <rect
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx="8"
                    ry="8"
                    className="node-shine"
                  />
                  {person.photo ? (
                    <g>
                      <clipPath id={`node-clip-${safeId}`}>
                        <circle cx={NODE_HEIGHT / 2} cy={NODE_HEIGHT / 2} r="22" />
                      </clipPath>
                      <circle className="node-photo-ring" cx={NODE_HEIGHT / 2} cy={NODE_HEIGHT / 2} r="21" />
                      <image
                        href={photoUrl(person)}
                        x={NODE_HEIGHT / 2 - 20}
                        y={NODE_HEIGHT / 2 - 20}
                        width="40"
                        height="40"
                        clipPath={`url(#node-clip-${safeId})`}
                        preserveAspectRatio="xMidYMid slice"
                        onError={(e) => { e.currentTarget.classList.add('node-photo-failed') }}
                      />
                    </g>
                  ) : (
                    <circle
                      cx={NODE_HEIGHT / 2}
                      cy={NODE_HEIGHT / 2}
                      r="19"
                      className="node-avatar-placeholder"
                    />
                  )}
                  <text className="node-name" x={NODE_HEIGHT + 12} y={NODE_HEIGHT / 2 - 7}>
                    {truncateText(person.name, 16)}
                  </text>
                  <text className="node-dates" x={NODE_HEIGHT + 12} y={NODE_HEIGHT / 2 + 13}>
                    {formatDates(person)}
                  </text>
                  <text className="node-gender-icon" x={NODE_WIDTH - 15} y={NODE_HEIGHT / 2 - 5}>
                    {GENDER_ICONS[person.gender] || GENDER_ICONS.unknown}
                  </text>
                  {deceased && <circle className="deceased-marker" cx={NODE_WIDTH - 15} cy="14" r="4" />}
                </g>
              )
            })}
          </svg>
        )}
        {selectedPerson && (
          <aside
            className="tree-profile-panel"
            aria-label="Selected person"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="tree-profile-heading">
              <span className="tree-profile-kicker">Selected person</span>
              <i className="fas fa-user-circle" aria-hidden="true"></i>
            </div>
            <PersonAvatar person={selectedPerson} className="tree-profile-avatar" />
            <h2>{selectedPerson.name}</h2>
            <p className="tree-profile-dates">
              {formatDates(selectedPerson)}
              {selectedPerson.birthPlace && <span>{selectedPerson.birthPlace}</span>}
            </p>
            <div className="tree-profile-summary">
              <span><strong>{(selectedPerson.parents || []).length}</strong> parents</span>
              <span><strong>{(selectedPerson.children || []).length}</strong> children</span>
            </div>
            <p className="tree-profile-hint">Click the card again to open full details.</p>
          </aside>
        )}
      </div>
    </div>
  )
}

function truncateText(text, maxLength) {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

export default TreeView
