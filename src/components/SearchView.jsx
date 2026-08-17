import React, { useState, useMemo, useCallback } from 'react'

function SearchView({ individuals, onSelectPerson }) {
  const [query, setQuery] = useState('')

  const getInitials = useCallback((name) => {
    const parts = name.split(' ').filter(Boolean)
    if (parts.length === 0) return '?'
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
  }, [])

  const formatDates = useCallback((person) => {
    const extractYear = (date) => {
      const match = date.match(/\d{4}/)
      return match ? match[0] : date
    }
    const birth = person.birthDate ? extractYear(person.birthDate) : '?'
    const death = person.deathDate ? extractYear(person.deathDate) : ''
    return death ? `${birth} - ${death}` : `${birth}`
  }, [])

  const results = useMemo(() => {
    const queryLower = query.toLowerCase().trim()
    if (!queryLower) return []

    const matches = []
    for (const [id, person] of individuals) {
      const searchable = [
        person.name,
        person.givenName,
        person.surname,
        person.birthDate,
        person.birthPlace,
        person.deathDate,
        person.deathPlace,
        person.occupation,
        person.education,
        person.religion,
        ...person.notes
      ].join(' ').toLowerCase()

      if (searchable.includes(queryLower)) {
        matches.push(person)
      }
    }
    return matches
  }, [individuals, query])

  return (
    <div className="search-container">
      <div className="search-header">
        <h2><i className="fas fa-search"></i> Search Family Members</h2>
        <div className="search-box large">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Search by name, birth date, location..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      <div className="search-results">
        {!query.trim() && (
          <div className="empty-state">
            <i className="fas fa-search"></i>
            <h2>Search your family tree</h2>
            <p>Type a name or detail to find family members</p>
          </div>
        )}

        {query.trim() && results.length === 0 && (
          <div className="empty-state">
            <i className="fas fa-search"></i>
            <h2>No results found</h2>
            <p>No family members match "{query}"</p>
          </div>
        )}

        {results.map(person => (
          <div
            key={person.id}
            className="search-result-item"
            onClick={() => onSelectPerson(person.id)}
          >
            <div className={`person-avatar ${person.gender}`}>
              {getInitials(person.name)}
            </div>
            <div>
              <h3>{person.name}</h3>
              <div className="person-dates">{formatDates(person)}</div>
              {person.birthPlace && (
                <div className="person-dates">
                  <i className="fas fa-map-marker-alt"></i> {person.birthPlace}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SearchView