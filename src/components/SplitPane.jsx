import React, { useState, useCallback, useRef, useEffect } from 'react'

function SplitPane({ children, initialSizes }) {
  const [sizes, setSizes] = useState(() => {
    if (initialSizes) return initialSizes
    const count = React.Children.count(children)
    return React.Children.map(() => 100 / count)
  })

  const containerRef = useRef(null)
  const dragRef = useRef(null)

  const handlePointerDown = useCallback((e, index) => {
    e.preventDefault()
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    dragRef.current = {
      startX: e.clientX,
      index,
      containerWidth: rect.width,
      startSizes: [...sizes],
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev) => {
      if (!dragRef.current) return
      const { startX, index: idx, containerWidth, startSizes } = dragRef.current
      const delta = ev.clientX - startX
      const deltaPercent = (delta / containerWidth) * 100

      setSizes(prev => {
        const next = [...prev]
        const left = startSizes[idx] + deltaPercent
        const right = startSizes[idx + 1] - deltaPercent
        next[idx] = Math.max(15, Math.min(85, left))
        next[idx + 1] = Math.max(15, Math.min(85, right))
        return next
      })
    }

    const onUp = () => {
      dragRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [sizes])

  const panes = React.Children.toArray(children)

  return (
    <div ref={containerRef} className="split-pane">
      {panes.map((child, i) => (
        <React.Fragment key={i}>
          <div className="pane" style={{ width: `${sizes[i]}%` }}>
            {child}
          </div>
          {i < panes.length - 1 && (
            <div
              className={`pane-resizer ${dragRef.current ? 'dragging' : ''}`}
              onPointerDown={(e) => handlePointerDown(e, i)}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

export default SplitPane
