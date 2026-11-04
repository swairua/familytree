import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { photoUrl } from '../utils/photoUrl'
import { cleanName } from '../utils/cleanName'

const NODE_WIDTH = 270
const NODE_HEIGHT = 150
const H_GAP = 40
const V_GAP = 70
const ZOOM_MIN = 0.01
const ZOOM_MAX = 3
const ZOOM_STEP = 1.25
const AVATAR_R = 46

function TreeView({ individuals, families, onSelectPerson, onOpenPersonModal, layoutMode = 'flat', onLayoutModeChange }) {
  const containerRef = useRef(null)
  const contentGroupRef = useRef(null)
  const minimapSvgRef = useRef(null)
  const [zoom, setZoom] = useState(null)
  const [pan, setPan] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  const [showLegend, setShowLegend] = useState(true)
  const [minimapOpen, setMinimapOpen] = useState(true)
  const isPanning = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })
  const dragStart = useRef(null)
  const suppressClick = useRef(false)
  const pinchRef = useRef(null)
  const vel = useRef({ x: 0, y: 0 })
  const lastPos = useRef({ x: 0, y: 0, t: 0 })
  const touchVel = useRef({ x: 0, y: 0 })
  const touchLast = useRef({ x: 0, y: 0, t: 0 })
  const frame = useRef(null)
  const INERTIA_DECAY = 0.90
  const INERTIA_MIN_SPEED = 0.5

  const personCount = individuals.size
  const familyCount = families.size
  const selectedPerson = selectedId ? individuals.get(selectedId) : null

  // Measure canvas container for viewport-aware fit/reset
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setViewport({ w: r.width, h: r.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const extractYear = useCallback((date) => {
    if (!date) return ''
    const m = date.match(/\b(\d{4})\b/)
    return m ? m[1] : ''
  }, [])

  // ---- pre-compute person data (avoid repeated work per render) ----
  const personData = useMemo(() => {
    const map = new Map()
    for (const [id, p] of individuals) {
      const name = cleanName(p.name)
      const url = photoUrl(p)
      const parts = name.split(' ').filter(Boolean)
      const initials = parts.length >= 2
        ? (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
        : parts.length === 1 ? parts[0].charAt(0).toUpperCase() : '?'
      map.set(id, {
        name,
        url,
        initials,
        birthYear: extractYear(p.birthDate || ''),
        deathYear: extractYear(p.deathDate || ''),
        gender: p.gender || 'unknown',
        deceased: !!(p.deathDate || p.deathYear),
        safeId: id.replace(/[^a-zA-Z0-9_-]/g, ''),
      })
    }
    return map
  }, [individuals, extractYear])

  // ---- structural layout (top-down vertical tree) ----
  const flatLayout = useMemo(() => {
    if (individuals.size === 0) return { nodes: [], links: [], posMap: new Map(), width: 0, height: 0 }

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

    let roots = []
    for (const [id, person] of individuals) {
      if ((!person.parents || person.parents.length === 0)) roots.push(id)
    }
    if (roots.length === 0) roots = Array.from(individuals.keys())

    roots.sort((a, b) => {
      const yearOf = (id) => {
        const d = personData.get(id)
        return d.birthYear ? +d.birthYear : 9999
      }
      const d = yearOf(a) - yearOf(b)
      return d !== 0 ? d : (a < b ? -1 : 1)
    })

    const components = []
    for (const r of roots) {
      if (memo.has(r)) continue
      const st = build(r, new Set())
      if (st) components.push(st)
    }

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

      const midX = coupleX + coupleW / 2
      spouses.forEach((s) => {
        const p = pos.get(st.id)
        const sp = pos.get(s)
        const y = top + NODE_HEIGHT / 2
        links.push({ type: 'marriage', x1: p.x + NODE_WIDTH, y1: y, x2: sp.x, y2: y })
      })

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
    const frames = []
    for (const st of components) {
      const before = placedGlobal.size
      const linkStart = links.length
      place(st, 0, top)
      if (placedGlobal.size > before) {
        frames.push({
          top,
          width: st.width,
          height: st.height,
          nodeIds: new Set(Array.from(placedGlobal).slice(before)),
          linkStart,
          linkEnd: links.length,
        })
        maxWidth = Math.max(maxWidth, st.width)
        top += st.height + V_GAP
      }
    }

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
      const linkStart = links.length
      let x = 0
      for (const mid of members) {
        pos.set(mid, { x, y: top })
        x += NODE_WIDTH + H_GAP
      }
      frames.push({
        top,
        width: w,
        height: NODE_HEIGHT,
        nodeIds: new Set(members),
        linkStart,
        linkEnd: linkStart,
      })
      maxWidth = Math.max(maxWidth, w)
      top += NODE_HEIGHT + V_GAP
    }

    for (const [id, p] of pos) {
      nodes.push({ id, x: p.x, y: p.y })
    }
    const height = components.length || orphanIslands.length ? top + NODE_HEIGHT : NODE_HEIGHT

    return { nodes, links, posMap: pos, width: maxWidth, height, frames }
  }, [individuals])

  const verticalLayout = useMemo(() => {
    if (flatLayout.nodes.length === 0) {
      return { nodes: [], links: [], posMap: new Map(), width: 0, height: 0 }
    }
    const nodes = []
    const links = []
    const posMap = new Map()
    let w = 0
    let h = 0
    for (const f of flatLayout.frames) {
      for (const id of f.nodeIds) {
        const p = flatLayout.posMap.get(id)
        if (!p) continue
        const nx = w + (p.y - f.top)
        const ny = p.x
        posMap.set(id, { x: nx, y: ny })
        nodes.push({ id, x: nx, y: ny })
      }
      for (let i = f.linkStart; i < f.linkEnd; i++) {
        const l = flatLayout.links[i]
        links.push({
          type: l.type,
          x1: w + (l.y1 - f.top), y1: l.x1,
          x2: w + (l.y2 - f.top), y2: l.x2,
        })
      }
      w += f.height + V_GAP
      h = Math.max(h, f.width)
    }
    return { nodes, links, posMap, width: w, height: h }
  }, [flatLayout])

  const treeLayout = layoutMode === 'vertical' ? verticalLayout : flatLayout

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
      viewport.w, viewport.h, 40, ZOOM_MIN, 1
    )
  }, [treeLayout, viewport, fitRect])

  const prevModeRef = useRef(layoutMode)
  useEffect(() => {
    if (prevModeRef.current !== layoutMode) {
      prevModeRef.current = layoutMode
      setZoom(null)
      setPan(null)
    }
  }, [layoutMode])

  const legibleDefault = useCallback(() => {
    if (!viewport.w || !viewport.h) return { zoom: 1, pan: { x: 20, y: 20 } }
    const nodes = treeLayout.nodes
    if (!nodes || nodes.length === 0) return { zoom: 1, pan: { x: 20, y: 20 } }

    const roots = []
    for (const [id, p] of individuals) {
      if (!p.parents || p.parents.length === 0) roots.push(id)
    }
    if (roots.length === 0) {
      return { zoom: 0.5, pan: { x: 20, y: 20 } }
    }

    const rootPositions = roots
      .map(id => ({ id, pos: treeLayout.posMap.get(id) }))
      .filter(r => r.pos)

    const targetW = viewport.w * 2
    const topSliceBottom = treeLayout.frames && treeLayout.frames[0]
      ? treeLayout.frames[0].top + treeLayout.frames[0].height + V_GAP
      : Infinity
    const sorted = rootPositions.sort((a, b) => a.pos.x - b.pos.x || a.pos.y - b.pos.y)
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    let count = 0
    for (const { pos } of sorted) {
      if (pos.y > topSliceBottom) continue
      if (count > 0 && pos.x > x0 + targetW) break
      x0 = Math.min(x0, pos.x)
      y0 = Math.min(y0, pos.y)
      x1 = Math.max(x1, pos.x + NODE_WIDTH)
      y1 = Math.max(y1, pos.y + NODE_HEIGHT)
      count++
    }
    if (x0 === Infinity) {
      if (treeLayout.frames && treeLayout.frames[0]) {
        const f = treeLayout.frames[0]
        const box = { x: 0, y: f.top, w: Math.min(f.width, targetW), h: f.height }
        return fitRect(box, viewport.w, viewport.h, 30, 0.3, 1)
      }
      return { zoom: 0.5, pan: { x: 20, y: 20 } }
    }

    const box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
    return fitRect(box, viewport.w, viewport.h, 30, 0.3, 1)
  }, [viewport, treeLayout, individuals, fitRect])

  const view = useMemo(() => {
    if (zoom !== null && pan !== null) return { zoom, pan }
    if (!viewport.w || !viewport.h) return null
    const fit = fitAll()
    if (fit) return fit
    return { zoom: 0.5, pan: { x: 20, y: 20 } }
  }, [zoom, pan, viewport, fitAll])

  const viewRef = useRef({ zoom: 1, pan: { x: 20, y: 20 } })
  if (view) viewRef.current = view

  const applyView = useCallback(() => {
    const z = viewRef.current.zoom
    const panX = viewRef.current.pan.x
    const panY = viewRef.current.pan.y
    const g = contentGroupRef.current
    if (g) g.setAttribute('transform', `translate(${panX}, ${panY}) scale(${z})`)
  }, [])

  const cancelInertia = useCallback(() => {
    if (frame.current) {
      cancelAnimationFrame(frame.current)
      frame.current = null
    }
  }, [])

  const startInertia = useCallback(() => {
    cancelInertia()
    const run = () => {
      const v = viewRef.current
      v.pan.x += vel.current.x
      v.pan.y += vel.current.y
      vel.current.x *= INERTIA_DECAY
      vel.current.y *= INERTIA_DECAY
      applyView()
      const speed = Math.hypot(vel.current.x, vel.current.y)
      if (speed > INERTIA_MIN_SPEED) {
        frame.current = requestAnimationFrame(run)
      } else {
        frame.current = null
        setPan(v.pan)
        setZoom(v.zoom)
      }
    }
    frame.current = requestAnimationFrame(run)
  }, [applyView, cancelInertia])

  useEffect(() => {
    applyView()
  }, [applyView, zoom, pan, view])

  const engage = useCallback(() => {
    if (zoom === null || pan === null) {
      setZoom(viewRef.current.zoom)
      setPan(viewRef.current.pan)
    }
  }, [zoom, pan])

  const zoomAtPoint = useCallback((px, py, factor) => {
    const z = viewRef.current.zoom
    const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z * factor))
    if (next === z) return
    const ratio = next / z
    const v = viewRef.current
    viewRef.current = {
      zoom: next,
      pan: { x: px - (px - v.pan.x) * ratio, y: py - (py - v.pan.y) * ratio },
    }
    setZoom(next)
    setPan(viewRef.current.pan)
    applyView()
  }, [applyView])

  const zoomBy = useCallback((factor) => {
    if (!viewport.w || !viewport.h) return
    zoomAtPoint(viewport.w / 2, viewport.h / 2, factor)
  }, [viewport, zoomAtPoint])

  const animateTo = useCallback((viewTo) => {
    if (!viewTo) return
    const prev = viewRef.current
    if (prev.zoom === viewTo.zoom && prev.pan.x === viewTo.pan.x && prev.pan.y === viewTo.pan.y) return
    viewRef.current = viewTo
    setZoom(viewTo.zoom)
    setPan(viewTo.pan)
    applyView()
  }, [applyView])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      engage()
      const rect = el.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? (viewport.h || 800) : 1
      if (e.ctrlKey || e.metaKey) {
        const raw = Math.exp(-e.deltaY * unit * 0.0015)
        const factor = Math.max(0.8, Math.min(1.25, raw))
        zoomAtPoint(px, py, factor)
      } else {
        const v = viewRef.current
        viewRef.current = { zoom: v.zoom, pan: { x: v.pan.x - e.deltaX * unit, y: v.pan.y - e.deltaY * unit } }
        applyView()
        setPan(viewRef.current.pan)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAtPoint, engage, applyView, viewport.h])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const toLocal = (t) => {
      const rect = el.getBoundingClientRect()
      return { x: t.clientX - rect.left, y: t.clientY - rect.top }
    }

    const onTouchStart = (e) => {
      const touches = e.touches
      if (touches.length === 1) {
        engage()
        cancelInertia()
        touchVel.current = { x: 0, y: 0 }
        touchLast.current = { x: 0, y: 0, t: performance.now() }
        isPanning.current = true
        const v = viewRef.current
        const p = toLocal(touches[0])
        startPos.current = { x: p.x - v.pan.x, y: p.y - v.pan.y }
        pinchRef.current = null
      } else if (touches.length === 2) {
        engage()
        cancelInertia()
        isPanning.current = false
        const a = toLocal(touches[0])
        const b = toLocal(touches[1])
        const v = viewRef.current
        pinchRef.current = {
          distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
          zoom: v.zoom,
          midX: (a.x + b.x) / 2,
          midY: (a.y + b.y) / 2,
          panX: v.pan.x,
          panY: v.pan.y,
        }
      }
    }

    const onTouchMove = (e) => {
      const touches = e.touches
      if (pinchRef.current && touches.length === 2) {
        e.preventDefault()
        const a = toLocal(touches[0])
        const b = toLocal(touches[1])
        const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))
        const midX = (a.x + b.x) / 2
        const midY = (a.y + b.y) / 2
        const start = pinchRef.current
        const ratio = dist / start.distance
        const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, start.zoom * ratio))
        const zoomRatio = nextZoom / start.zoom
        viewRef.current = {
          zoom: nextZoom,
          pan: {
            x: midX - (start.midX - start.panX) * zoomRatio,
            y: midY - (start.midY - start.panY) * zoomRatio,
          },
        }
        applyView()
      } else if (isPanning.current && touches.length === 1) {
        e.preventDefault()
        const v = viewRef.current
        const p = toLocal(touches[0])
        const now = performance.now()
        const dx = p.x - touchLast.current.x
        const dy = p.y - touchLast.current.y
        const dt = Math.max(1, now - touchLast.current.t)
        touchVel.current.x = touchVel.current.x * 0.45 + (dx / dt) * 16.67 * 0.55
        touchVel.current.y = touchVel.current.y * 0.45 + (dy / dt) * 16.67 * 0.55
        touchLast.current = { x: p.x, y: p.y, t: now }
        viewRef.current = { zoom: v.zoom, pan: { x: p.x - startPos.current.x, y: p.y - startPos.current.y } }
        applyView()
      }
    }

    const commitView = () => {
      setZoom(viewRef.current.zoom)
      setPan(viewRef.current.pan)
    }

    const onTouchEnd = (e) => {
      if (e.touches.length === 0) {
        if (isPanning.current || pinchRef.current) commitView()
        const tSpeed = Math.hypot(touchVel.current.x, touchVel.current.y)
        if (isPanning.current && tSpeed > INERTIA_MIN_SPEED) {
          startInertia()
        }
        isPanning.current = false
        pinchRef.current = null
        touchVel.current = { x: 0, y: 0 }
      } else if (e.touches.length === 1) {
        if (pinchRef.current) commitView()
        isPanning.current = true
        const v = viewRef.current
        const p = toLocal(e.touches[0])
        startPos.current = { x: p.x - v.pan.x, y: p.y - v.pan.y }
        pinchRef.current = null
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [engage, applyView, cancelInertia, startInertia])

  const handleMouseDown = useCallback((e) => {
    if (e.button !== undefined && e.button !== 0) return
    engage()
    cancelInertia()
    vel.current = { x: 0, y: 0 }
    lastPos.current = { x: e.clientX, y: e.clientY, t: performance.now() }
    isPanning.current = true
    dragStart.current = { x: e.clientX, y: e.clientY }
    const rect = containerRef.current ? containerRef.current.getBoundingClientRect() : { left: 0, top: 0 }
    const v = viewRef.current
    startPos.current = { x: (e.clientX - rect.left) - v.pan.x, y: (e.clientY - rect.top) - v.pan.y }
  }, [engage, cancelInertia])

  const handleMouseMove = useCallback((e) => {
    if (!isPanning.current) return
    if (dragStart.current && (Math.abs(e.clientX - dragStart.current.x) > 4 || Math.abs(e.clientY - dragStart.current.y) > 4)) {
      suppressClick.current = true
    }
    const now = performance.now()
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    const dt = Math.max(1, now - lastPos.current.t)
    const instX = (dx / dt) * 16.67
    const instY = (dy / dt) * 16.67
    vel.current.x = vel.current.x * 0.45 + instX * 0.55
    vel.current.y = vel.current.y * 0.45 + instY * 0.55
    lastPos.current = { x: e.clientX, y: e.clientY, t: now }

    const rect = containerRef.current ? containerRef.current.getBoundingClientRect() : { left: 0, top: 0 }
    const v = viewRef.current
    viewRef.current = { zoom: v.zoom, pan: { x: (e.clientX - rect.left) - startPos.current.x, y: (e.clientY - rect.top) - startPos.current.y } }
    applyView()
  }, [applyView])

  const handleMouseUp = useCallback(() => {
    if (isPanning.current) {
      const speed = Math.hypot(vel.current.x, vel.current.y)
      if (speed > INERTIA_MIN_SPEED) {
        startInertia()
      } else {
        setPan(viewRef.current.pan)
        setZoom(viewRef.current.zoom)
      }
    }
    isPanning.current = false
    dragStart.current = null
  }, [startInertia])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      cancelInertia()
    }
  }, [handleMouseMove, handleMouseUp, cancelInertia])

  const fitView = useCallback(() => {
    animateTo(fitAll())
  }, [fitAll, animateTo])

  const panTo = useCallback((id) => {
    const p = treeLayout.posMap.get(id)
    if (!p || !viewport.w || !viewport.h) return
    const targetZoom = Math.max(0.5, Math.min(1, viewRef.current.zoom))
    animateTo({
      zoom: targetZoom,
      pan: {
        x: viewport.w / 2 - (p.x + NODE_WIDTH / 2) * targetZoom,
        y: viewport.h / 2 - (p.y + NODE_HEIGHT / 2) * targetZoom,
      },
    })
  }, [treeLayout, viewport, animateTo])

  const resetView = useCallback(() => {
    viewRef.current = legibleDefault()
    setZoom(null)
    setPan(null)
  }, [legibleDefault])

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const panStep = 60
      switch (e.key) {
        case '+': case '=': e.preventDefault(); engage(); zoomBy(ZOOM_STEP); break
        case '-': case '_': e.preventDefault(); engage(); zoomBy(1 / ZOOM_STEP); break
        case '0': e.preventDefault(); fitView(); break
        case '1': e.preventDefault(); resetView(); break
        case 'ArrowUp':    e.preventDefault(); engage(); { const v = viewRef.current; viewRef.current = { zoom: v.zoom, pan: { x: v.pan.x, y: v.pan.y + panStep } }; applyView(); setPan(viewRef.current.pan); } break
        case 'ArrowDown':  e.preventDefault(); engage(); { const v = viewRef.current; viewRef.current = { zoom: v.zoom, pan: { x: v.pan.x, y: v.pan.y - panStep } }; applyView(); setPan(viewRef.current.pan); } break
        case 'ArrowLeft':  e.preventDefault(); engage(); { const v = viewRef.current; viewRef.current = { zoom: v.zoom, pan: { x: v.pan.x + panStep, y: v.pan.y } }; applyView(); setPan(viewRef.current.pan); } break
        case 'ArrowRight': e.preventDefault(); engage(); { const v = viewRef.current; viewRef.current = { zoom: v.zoom, pan: { x: v.pan.x - panStep, y: v.pan.y } }; applyView(); setPan(viewRef.current.pan); } break
        default: break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [engage, zoomBy, fitView, resetView, applyView])

  const hasInteracted = useRef(false)
  useEffect(() => {
    const engageHandler = () => { hasInteracted.current = true }
    const el = containerRef.current
    if (el) {
      el.addEventListener('mousedown', engageHandler, { once: true })
      el.addEventListener('touchstart', engageHandler, { once: true })
    }
    return () => {
      if (el) {
        el.removeEventListener('mousedown', engageHandler)
        el.removeEventListener('touchstart', engageHandler)
      }
    }
  }, [])

  useEffect(() => {
    if (!viewport.w || !viewport.h) return
    if (!hasInteracted.current && treeLayout.width && treeLayout.height) {
      setZoom(null)
      setPan(null)
    }
  }, [viewport, treeLayout])

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
    animateTo(v)
  }, [treeLayout, viewport, individuals, fitRect, animateTo])

  const handlePersonClick = useCallback((id) => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    setSelectedId(id)
  }, [])

  const formatDates = useCallback((person) => {
    const birth = person.birthDate ? extractYear(person.birthDate) : '?'
    const death = person.deathDate ? extractYear(person.deathDate) : ''
    return death ? `${birth} \u2013 ${death}` : `${birth}`
  }, [extractYear])

  const minimapBox = useMemo(() => {
    if (!view || !viewport.w || !viewport.h || treeLayout.width === 0 || treeLayout.height === 0) return null
    const z = view.zoom
    const box = {
      x: (0 - view.pan.x) / z,
      y: (0 - view.pan.y) / z,
      w: viewport.w / z,
      h: viewport.h / z,
    }
    return { box, treeW: treeLayout.width, treeH: treeLayout.height }
  }, [view, viewport, treeLayout])

  const renderToolbar = (hasData) => (
    <div className="tree-toolbar">
      <div className="toolbar-left">
        <span className="toolbar-label">Family tree</span>
        <button className="btn btn-icon" onClick={() => { engage(); zoomBy(ZOOM_STEP) }} title="Zoom In (+)">
          <i className="fas fa-plus"></i>
        </button>
        <button className="btn btn-icon" onClick={() => { engage(); zoomBy(1 / ZOOM_STEP) }} title="Zoom Out (-)">
          <i className="fas fa-minus"></i>
        </button>
        <span className="toolbar-zoom">{Math.round((view ? view.zoom : 1) * 100)}%</span>
        {hasData && (
          <button className="btn btn-icon" onClick={fitView} title="Fit to screen (0)">
            <i className="fas fa-expand"></i>
          </button>
        )}
        <button className="btn btn-icon" onClick={resetView} title="Reset (1)">
          <i className="fas fa-home"></i>
        </button>
        {hasData && (
          <button
            className={`btn btn-icon layout-toggle ${layoutMode === 'vertical' ? 'active' : ''}`}
            onClick={() => onLayoutModeChange && onLayoutModeChange(layoutMode === 'flat' ? 'vertical' : 'flat')}
            title={layoutMode === 'flat' ? 'Vertical tree' : 'Generational rows'}
          >
            <i className={`fas ${layoutMode === 'flat' ? 'fa-arrows-alt-v' : 'fa-arrows-alt-h'}`}></i>
          </button>
        )}
        {hasData && (
          <button
            className={`btn btn-icon ${minimapOpen ? 'active' : ''}`}
            onClick={() => setMinimapOpen(m => !m)}
            title="Toggle navigator"
          >
            <i className="fas fa-map"></i>
          </button>
        )}
      </div>
      <div className="toolbar-center">
        {hasData ? (
          <span className="toolbar-hint">{personCount} people \u2022 {familyCount} families \u2022 drag or scroll to pan \u2022 Ctrl+scroll or pinch to zoom \u2022 0 to fit</span>
        ) : (
          <span>No family tree loaded</span>
        )}
      </div>
      <div className="toolbar-right">
        {hasData && showLegend && (
          <div className="tree-legend">
            <span className="legend-dot male" title="Male"></span> Male
            <span className="legend-dot female" title="Female"></span> Female
            <span className="legend-dot unknown" title="Unknown"></span> Unknown
            <span className="legend-dot deceased" title="Deceased"></span> Deceased
          </div>
        )}
        <button
          className={`btn btn-icon ${showLegend ? 'active' : ''}`}
          onClick={() => setShowLegend(s => !s)}
          title="Toggle legend"
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
          <div className="tree-empty-state">
            <div className="empty-icon"><i className="fas fa-tree"></i></div>
            <h2>Your Family Tree</h2>
            <p>Import a GEDCOM file to visualize your family tree.</p>
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
      const y = link.y1
      return `M ${link.x1} ${y} L ${link.x2} ${y}`
    }
    const topY = link.y1 + NODE_HEIGHT
    const botY = link.y2
    const midY = (topY + botY) / 2
    return `M ${link.x1} ${topY} L ${link.x1} ${midY} L ${link.x2} ${midY} L ${link.x2} ${botY}`
  }

  const renderNode = (node) => {
    const pd = personData.get(node.id)
    if (!pd) return null
    const isSelected = selectedId === node.id

    return (
      <g
        key={node.id}
        className={`tree-node gender-${pd.gender} ${pd.deceased ? 'deceased' : ''} ${isSelected ? 'selected' : ''}`}
        data-id={node.id}
        transform={`translate(${node.x}, ${node.y})`}
        onClick={(e) => { e.stopPropagation(); handlePersonClick(node.id) }}
        onDoubleClick={(e) => { e.stopPropagation(); drillTo(node.id) }}
      >
        <circle className="node-port node-port-top" cx={NODE_WIDTH / 2} cy={0} r="3" />
        <circle className="node-port node-port-bottom" cx={NODE_WIDTH / 2} cy={NODE_HEIGHT} r="3" />
        <circle className="node-port node-port-left" cx={0} cy={NODE_HEIGHT / 2} r="3" />
        <circle className="node-port node-port-right" cx={NODE_WIDTH} cy={NODE_HEIGHT / 2} r="3" />

        <rect className="node-card" width={NODE_WIDTH} height={NODE_HEIGHT} rx="14" ry="14" clipPath={`url(#node-card-clip-${pd.safeId})`} />
        <rect className="node-card-fill" width={NODE_WIDTH} height={NODE_HEIGHT} rx="14" ry="14" clipPath={`url(#node-card-clip-${pd.safeId})`} />

        <g className="node-avatar-wrap" clipPath={`url(#node-card-clip-${pd.safeId})`}>
          <circle className="node-avatar-ring" cx={AVATAR_R} cy={NODE_HEIGHT / 2} r={AVATAR_R} />
          {pd.url ? (
            <image
              className="node-photo"
              href={pd.url}
              x={AVATAR_R - AVATAR_R} y={NODE_HEIGHT / 2 - AVATAR_R}
              width={AVATAR_R * 2} height={AVATAR_R * 2}
              clipPath={`url(#node-avatar-clip-${pd.safeId})`}
              preserveAspectRatio="xMidYMid slice"
              loading="lazy"
              decode="async"
              onError={(e) => { e.currentTarget.classList.add('node-photo-failed') }}
            />
          ) : (
            <text className="node-initials" x={AVATAR_R} y={NODE_HEIGHT / 2} textAnchor="middle" dominantBaseline="middle">{pd.initials}</text>
          )}
        </g>

        <text className="node-name" x={AVATAR_R * 2 + 18} y={NODE_HEIGHT / 2 - 20} textAnchor="start" dominantBaseline="middle">{truncateText(pd.name, 20)}</text>
        <text className="node-dates" x={AVATAR_R * 2 + 18} y={NODE_HEIGHT / 2 + 8} textAnchor="start" dominantBaseline="middle">{pd.birthYear || pd.deathYear ? `${pd.birthYear || '?'}${pd.deathYear ? ' \u2013 ' + pd.deathYear : ''}` : '?'}</text>
        {pd.birthPlace && <text className="node-place" x={AVATAR_R * 2 + 18} y={NODE_HEIGHT / 2 + 32} textAnchor="start" dominantBaseline="middle">{truncateText(pd.birthPlace, 18)}</text>}

        <circle className={`node-gender-badge gender-${pd.gender}`} cx={NODE_WIDTH - 22} cy={22} r="9" />
        {pd.deceased && <circle className="node-deceased" cx={NODE_WIDTH - 22} cy={NODE_HEIGHT - 22} r="7" />}
      </g>
    )
  }

  return (
    <div className="tree-container">
      {renderToolbar(true)}
      <div
        className="tree-canvas"
        ref={containerRef}
        onMouseDown={handleMouseDown}
      >
        {view && (
          <>
            <svg
              id="tree-svg"
              width="100%"
              height="100%"
            >
              <defs>
                <filter id="tree-glow" x="-30%" y="-40%" width="160%" height="180%">
                  <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(76, 63, 56, 0.25)" />
                </filter>
                <filter id="tree-glow-hover" x="-30%" y="-40%" width="160%" height="180%">
                  <feDropShadow dx="0" dy="5" stdDeviation="9" floodColor="rgba(76, 63, 56, 0.32)" />
                </filter>
                {treeLayout.nodes.map(node => {
                  const pd = personData.get(node.id)
                  return (
                    <React.Fragment key={`defs-${pd.safeId}`}>
                      <clipPath id={`node-card-clip-${pd.safeId}`}>
                        <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx="14" ry="14" />
                      </clipPath>
                      <clipPath id={`node-avatar-clip-${pd.safeId}`}>
                        <circle cx={AVATAR_R} cy={NODE_HEIGHT / 2} r={AVATAR_R} />
                      </clipPath>
                    </React.Fragment>
                  )
                })}
              </defs>

              <g ref={contentGroupRef} id="tree-content" transform={`translate(${view.pan.x}, ${view.pan.y}) scale(${view.zoom})`}>
                {treeLayout.links.map((link, i) => (
                  <path
                    key={`link-${i}`}
                    d={linkPath(link)}
                    className={`tree-link ${link.type || ''}`}
                  />
                ))}
                {treeLayout.nodes.map(renderNode)}
              </g>
            </svg>

            {minimapOpen && minimapBox && (
              <div className="tree-minimap">
                <div className="tree-minimap-label">Navigator</div>
                <svg
                  ref={minimapSvgRef}
                  className="tree-minimap-svg"
                  width="240"
                  height="150"
                  viewBox={`0 0 ${minimapBox.treeW} ${minimapBox.treeH}`}
                  preserveAspectRatio="xMidYMid slice"
                >
                  <rect className="minimap-bounds" x="0" y="0" width={minimapBox.treeW} height={minimapBox.treeH} />
                  {treeLayout.nodes.map(node => (
                    <circle key={node.id} className="minimap-node" cx={node.x + NODE_WIDTH / 2} cy={node.y + NODE_HEIGHT / 2} r="2" />
                  ))}
                  <rect
                    className="minimap-viewport"
                    x={minimapBox.box.x}
                    y={minimapBox.box.y}
                    width={minimapBox.box.w}
                    height={minimapBox.box.h}
                  />
                </svg>
              </div>
            )}
          </>
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
              <button className="tree-profile-close" onClick={() => setSelectedId(null)} title="Deselect">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="tree-profile-avatar-large" style={{ position: 'relative' }}>
              <img
                src={photoUrl(selectedPerson) || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='24' fill='%2399424b'%3E${selectedPerson.name ? selectedPerson.name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2) : '?' }%3C/text%3E%3C/svg%3E`}
                alt={cleanName(selectedPerson.name)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', border: '3px solid #fff', boxShadow: '0 2px 8px rgba(62,50,42,0.2)' }}
                onError={(e) => { e.currentTarget.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='24' fill='%2399424b'%3E${selectedPerson.name ? selectedPerson.name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2) : '?' }%3C/text%3E%3C/svg%3E`; }}
              />
            </div>
            <h2>{cleanName(selectedPerson.name)}</h2>
            <p className="tree-profile-dates">
              {formatDates(selectedPerson)}
              {selectedPerson.birthPlace && <span>{selectedPerson.birthPlace}</span>}
            </p>

            {selectedPerson.parents && selectedPerson.parents.length > 0 && (
              <div className="tree-profile-family">
                <span className="family-label"><i className="fas fa-user-friends"></i> Parents</span>
                <div className="family-links">
                  {selectedPerson.parents.map(pid => {
                    const p = individuals.get(pid)
                    if (!p) return null
                    return (
                      <button key={pid} className="family-link" onClick={() => { setSelectedId(pid); panTo(pid) }}>
                        <img
                          src={photoUrl(p) || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%2399424b'%3E${p.name ? p.name.split(' ').map(pp => pp[0]).join('').toUpperCase().slice(0, 2) : '?' }%3C/text%3E%3C/svg%3E`}
                          alt={cleanName(p.name)}
                          className="family-link-avatar"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                          onError={(e) => { e.currentTarget.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%2399424b'%3E${p.name ? p.name.split(' ').map(pp => pp[0]).join('').toUpperCase().slice(0, 2) : '?' }%3C/text%3E%3C/svg%3E`; }}
                        />
                        <span>{truncateText(cleanName(p.name), 22)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {selectedPerson.spouses && selectedPerson.spouses.length > 0 && (
              <div className="tree-profile-family">
                <span className="family-label"><i className="fas fa-heart"></i> Spouse{selectedPerson.spouses.length > 1 ? 's' : ''}</span>
                <div className="family-links">
                  {selectedPerson.spouses.map(sid => {
                    const s = individuals.get(sid)
                    if (!s) return null
                    return (
                      <button key={sid} className="family-link" onClick={() => { setSelectedId(sid); panTo(sid) }}>
                        <img
                          src={photoUrl(s) || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%2399424b'%3E${s.name ? s.name.split(' ').map(pp => pp[0]).join('').toUpperCase().slice(0, 2) : '?' }%3C/text%3E%3C/svg%3E`}
                          alt={cleanName(s.name)}
                          className="family-link-avatar"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                          onError={(e) => { e.currentTarget.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%2399424b'%3E${s.name ? s.name.split(' ').map(pp => pp[0]).join('').toUpperCase().slice(0, 2) : '?' }%3C/text%3E%3C/svg%3E`; }}
                        />
                        <span>{truncateText(cleanName(s.name), 22)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {selectedPerson.children && selectedPerson.children.length > 0 && (
              <div className="tree-profile-family">
                <span className="family-label"><i className="fas fa-child"></i> Children</span>
                <div className="family-links">
                  {selectedPerson.children.map(cid => {
                    const c = individuals.get(cid)
                    if (!c) return null
                    return (
                      <button key={cid} className="family-link" onClick={() => { setSelectedId(cid); panTo(cid) }}>
                        <img
                          src={photoUrl(c) || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%2399424b'%3E${c.name ? c.name.split(' ').map(pp => pp[0]).join('').toUpperCase().slice(0, 2) : '?' }%3C/text%3E%3C/svg%3E`}
                          alt={cleanName(c.name)}
                          className="family-link-avatar"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                          onError={(e) => { e.currentTarget.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%2399424b'%3E${c.name ? c.name.split(' ').map(pp => pp[0]).join('').toUpperCase().slice(0, 2) : '?' }%3C/text%3E%3C/svg%3E`; }}
                        />
                        <span>{truncateText(cleanName(c.name), 22)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="tree-profile-actions">
              <button className="btn btn-primary btn-sm" onClick={() => onOpenPersonModal && onOpenPersonModal(selectedPerson.id)}>
                <i className="fas fa-user"></i> Full Details
              </button>
              <button className="btn btn-sm" onClick={() => drillTo(selectedPerson.id)} title="Zoom to this person's family branch">
                <i className="fas fa-sitemap"></i> Drill Down
              </button>
            </div>
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
