import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'

const NODE_WIDTH = 160
const NODE_HEIGHT = 60
const H_GAP = 40
const V_GAP = 30

function TreeView({ data, individuals, families, onSelectPerson }) {
  const containerRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [selectedId, setSelectedId] = useState(null)
  const [layout, setLayout] = useState('horizontal')
  const isPanning = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })

  const personCount = individuals.size
  const familyCount = families.size

  // Calculate tree layout
  const treeLayout = useMemo(() => {
    if (individuals.size === 0) return { nodes: [], links: [], width: 0, height: 0 }

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

    // Every root builds its own component. placedGlobal dedupes members that
    // were already rendered by an earlier (older) component (e.g. shared kids).
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
        links.push({ d: `M ${p.x + NODE_WIDTH} ${y} L ${sp.x} ${y}`, type: 'marriage' })
      })

      // children subtrees + parent-child links
      const childTop = top + NODE_HEIGHT + V_GAP
      const fromX = midX
      const fromY = top + NODE_HEIGHT
      const midY = (fromY + childTop) / 2
      let cx = kidsX
      for (const cs of st.children) {
        const childCx = place(cs, cx, childTop)
        if (childCx != null) {
          links.push({ d: `M ${fromX} ${fromY} L ${fromX} ${midY} L ${childCx} ${midY} L ${childCx} ${childTop}` })
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

    // Orphan pass: people still not placed (e.g. children whose parent couple
    // was consumed as a spouse row elsewhere) get their own small island rows.
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

    return { nodes, links, width: maxWidth, height }
  }, [individuals])

  // Handle zoom
  const handleZoom = useCallback((delta) => {
    setZoom(prev => Math.min(2, Math.max(0.2, prev + delta)))
  }, [])

  // Handle pan
  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('.tree-node')) return
    isPanning.current = true
    startPos.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }, [pan])

  const handleMouseMove = useCallback((e) => {
    if (!isPanning.current) return
    setPan({ x: e.clientX - startPos.current.x, y: e.clientY - startPos.current.y })
  }, [])

  const handleMouseUp = useCallback(() => {
    isPanning.current = false
  }, [])

  // Handle wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    handleZoom(delta)
  }, [handleZoom])

  // Reset view
  const resetView = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  // Toggle layout
  const toggleLayout = useCallback(() => {
    setLayout(prev => prev === 'horizontal' ? 'vertical' : 'horizontal')
  }, [])

  // Handle person click
  const handlePersonClick = useCallback((id) => {
    setSelectedId(id)
    onSelectPerson(id)
  }, [onSelectPerson])

  // Get gender color
  const getGenderColor = useCallback((gender) => {
    switch (gender) {
      case 'male': return '#4a90d9'
      case 'female': return '#e07a9e'
      default: return '#95a5a6'
    }
  }, [])

  // Format dates
  const formatDates = useCallback((person) => {
    const extractYear = (date) => {
      const match = date.match(/\d{4}/)
      return match ? match[0] : date
    }
    const birth = person.birthDate ? extractYear(person.birthDate) : '?'
    const death = person.deathDate ? extractYear(person.deathDate) : ''
    return death ? `${birth} - ${death}` : `${birth}`
  }, [])

  // Truncate text
  const truncateText = useCallback((text, maxLength) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength - 3) + '...'
  }, [])

  // Render empty state if no data
  if (personCount === 0) {
    return (
      <div className="tree-container">
        <div className="tree-toolbar">
          <div className="toolbar-left">
            <button className="btn btn-icon" onClick={() => handleZoom(0.1)} title="Zoom In">
              <i className="fas fa-plus"></i>
            </button>
            <button className="btn btn-icon" onClick={() => handleZoom(-0.1)} title="Zoom Out">
              <i className="fas fa-minus"></i>
            </button>
            <button className="btn btn-icon" onClick={resetView} title="Reset View">
              <i className="fas fa-expand"></i>
            </button>
          </div>
          <div className="toolbar-center">
            <span>No family tree loaded</span>
          </div>
          <div className="toolbar-right">
            <button className="btn btn-icon" onClick={toggleLayout} title="Toggle Layout">
              <i className="fas fa-arrows-alt-v"></i>
            </button>
          </div>
        </div>
        <div className="tree-canvas">
          <div className="empty-state">
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

  const padding = 50
  const svgWidth = treeLayout.width + padding * 2
  const svgHeight = treeLayout.height + padding * 2

  return (
    <div className="tree-container">
      <div className="tree-toolbar">
        <div className="toolbar-left">
          <button className="btn btn-icon" onClick={() => handleZoom(0.1)} title="Zoom In">
            <i className="fas fa-plus"></i>
          </button>
          <button className="btn btn-icon" onClick={() => handleZoom(-0.1)} title="Zoom Out">
            <i className="fas fa-minus"></i>
          </button>
          <button className="btn btn-icon" onClick={resetView} title="Reset View">
            <i className="fas fa-expand"></i>
          </button>
        </div>
        <div className="toolbar-center">
          <span>{personCount} people • {familyCount} families</span>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-icon" onClick={toggleLayout} title="Toggle Layout">
            <i className="fas fa-arrows-alt-v"></i>
          </button>
        </div>
      </div>
      <div
        className="tree-canvas"
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg
          id="tree-svg"
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            position: 'absolute',
            top: 0,
            left: 0
          }}
        >
          {/* Links */}
          {treeLayout.links.map((link, i) => (
            <path
              key={`link-${i}`}
              d={link.d}
              className={`tree-link ${link.type || ''}`}
            />
          ))}

          {/* Nodes */}
          {treeLayout.nodes.map(node => {
            const person = individuals.get(node.id)
            if (!person) return null
            return (
              <g
                key={node.id}
                className={`tree-node ${selectedId === node.id ? 'selected' : ''}`}
                data-id={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={(e) => {
                  e.stopPropagation()
                  handlePersonClick(node.id)
                }}
              >
                <rect
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx="8"
                  ry="8"
                  fill={getGenderColor(person.gender)}
                  stroke="#fff"
                  strokeWidth="2"
                />
                <text
                  className="node-name"
                  x={NODE_WIDTH / 2}
                  y={NODE_HEIGHT / 2 - 5}
                >
                  {truncateText(person.name, 20)}
                </text>
                <text
                  className="node-dates"
                  x={NODE_WIDTH / 2}
                  y={NODE_HEIGHT / 2 + 15}
                >
                  {formatDates(person)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

export default TreeView