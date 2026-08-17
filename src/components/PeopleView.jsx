import React, { useState, useMemo, useCallback } from 'react'

function PeopleView({ individuals, onSelectPerson }) {
  const [searchQuery, setSearchQuery] = useState('')

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

  const filteredPeople = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    const people = Array.from(individuals.values())
    if (!query) return people
    return people.filter(person => {
      const searchable = [
        person.name,
        person.givenName,
        person.surname,
        person.birthDate,
        person.birthPlace,
        person.deathDate,
        person.deathPlace,
        person.occupation
      ].join(' ').toLowerCase()
      return searchable.includes(query)
    })
  }, [individuals, searchQuery])

  if (individuals.size === 0) {
    return (
      <div className="people-container">
        <div className="people-header">
          <h2><i className="fas fa-users"></i> All People</h2>
        </div>
        <div className="empty-state">
          <i className="fas fa-users"></i>
          <h2>No people found</h2>
          <p>Import a GEDCOM file to see all family members</p>
        </div>
      </div>
    )
  }

  return (
    <div className="people-container">
      <div className="people-header">
        <h2><i className="fas fa-users"></i> All People ({filteredPeople.length})</h2>
        <div className="search-box">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Search people..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="people-grid">
        {filteredPeople.map(person => (
          <div
            key={person.id}
            className="person-card"
            onClick={() => onSelectPerson(person.id)}
          >
            <div className={`person-avatar ${person.gender}`}>
              {getInitials(person.name)}
            </div>
            <h3>{person.name}</h3>
            <div className="person-dates">{formatDates(person)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default PeopleView