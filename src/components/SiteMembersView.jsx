import React, { useMemo, useState } from 'react'
import PersonAvatar from './PersonAvatar'
import { cleanName } from '../utils/cleanName'
import '../styles/sitemembers.css'

function SiteMembersView({ individuals, onSelectPerson }) {
  const [sort, setSort] = useState('firstName')
  const [query, setQuery] = useState('')

  const members = useMemo(() => {
    let arr = Array.from(individuals.values())
    if (query.trim()) {
      const q = query.toLowerCase()
      arr = arr.filter(p => (p.name || '').toLowerCase().includes(q))
    }
    arr.sort((a, b) => {
      if (sort === 'lastName') return (a.surname || '').localeCompare(b.surname || '')
      if (sort === 'lastVisit') return 0
      return (a.givenName || a.name || '').localeCompare(b.givenName || b.name || '')
    })
    return arr.slice(0, 50)
  }, [individuals, query, sort])

  return (
    <div className="sm-view">
      <div className="sm-container">
        <div className="sm-header">
          <h1>Site Members</h1>
          <span className="sm-count">All members ({individuals.size})</span>
        </div>
        <div className="sm-controls">
          <select value={sort} onChange={e => setSort(e.target.value)}>
            <option value="firstName">First Name</option>
            <option value="lastName">Last Name</option>
            <option value="lastVisit">Last Visit</option>
          </select>
          <input placeholder="Find a person" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div className="sm-table-wrap">
          <table className="sm-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Relationship</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((p, i) => (
                <tr key={p.id}>
                  <td>{i + 1}</td>
                  <td className="sm-name">
                    <PersonAvatar person={p} className="sm-avatar" />
                    <span>{cleanName(p.name)}</span>
                  </td>
                  <td>{p.gender === 'male' ? 'Male' : p.gender === 'female' ? 'Female' : 'Member'}</td>
                  <td>Never visited</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => onSelectPerson(p.id)}>View profile</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default SiteMembersView