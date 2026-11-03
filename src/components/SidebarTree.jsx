import React, { useMemo, useState, useCallback } from 'react'
import { cleanName } from '../utils/cleanName'

function SidebarTree({ individuals, families, onSelectPerson, selectedPersonId }) {
  const [expandedNodes, setExpandedNodes] = useState(() => {
    const s = new Set()
    // Auto-expand first generation
    for (const [id, p] of individuals) {
      if (!p.parents || p.parents.length === 0) s.add(id)
    }
    return s
  })

  // Build root nodes (no parents), sorted by birth year
  const roots = useMemo(() => {
    const result = []
    for (const [id, p] of individuals) {
      if (!p.parents || p.parents.length === 0) result.push(id)
    }
    result.sort((a, b) => {
      const yearOf = (x) => {
        const m = (x.birthYear || '').match(/\d{4}/)
        return m ? +m[0] : 9999
      }
      const d = yearOf(individuals.get(a)) - yearOf(individuals.get(b))
      return d !== 0 ? d : (a < b ? -1 : 1)
    })
    return result
  }, [individuals])

  const toggleNode = useCallback((id) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const formatYear = (person) => {
    if (!person) return ''
    const m = (person.birthYear || '').match(/\d{4}/)
    return m ? m[0] : ''
  }

  const renderNode = (id, depth = 0) => {
    const person = individuals.get(id)
    if (!person) return null
    const hasChildren = person.children && person.children.length > 0
    const isExpanded = expandedNodes.has(id)
    const isSelected = selectedPersonId === id

    return (
      <React.Fragment key={id}>
        <button
          className={`sidebar-tree-node ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: `${12 + depth * 14}px` }}
          onClick={() => onSelectPerson(id)}
        >
          {hasChildren ? (
            <span
              className={`toggle-icon ${isExpanded ? 'expanded' : ''}`}
              onClick={(e) => { e.stopPropagation(); toggleNode(id) }}
            >
              <i className="fas fa-chevron-right"></i>
            </span>
          ) : (
            <span className="toggle-icon" style={{ visibility: 'hidden' }}></span>
          )}
          <span className="person-name">{cleanName(person.name) || 'Unknown'}</span>
          <span className="person-year">{formatYear(person)}</span>
        </button>
        {isExpanded && hasChildren && (
          <div className="sidebar-tree-children">
            {person.children.map(cid => renderNode(cid, depth + 1))}
          </div>
        )}
      </React.Fragment>
    )
  }

  if (roots.length === 0) {
    return (
      <div style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-light)' }}>
        No family tree data loaded
      </div>
    )
  }

  // Show first 50 roots to avoid massive initial render
  const visibleRoots = roots.slice(0, 50)

  return (
    <div>
      {visibleRoots.map(id => renderNode(id))}
      {roots.length > 50 && (
        <div style={{ padding: '8px 16px', fontSize: '0.68rem', color: 'var(--text-light)' }}>
          + {roots.length - 50} more roots...
        </div>
      )}
    </div>
  )
}

export default React.memo(SidebarTree)
