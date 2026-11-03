import React, { useMemo } from 'react'
import '../styles/familystats.css'

function StatCircle({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="stat-circle">
      <div className="stat-circle-ring" style={{ background: `conic-gradient(${color} ${pct}%, #e8e2dd ${pct}%)` }}>
        <div className="stat-circle-inner">
          <span className="stat-circle-value">{value.toLocaleString()}</span>
          <span className="stat-circle-pct">{pct}%</span>
        </div>
      </div>
      <span className="stat-circle-label">{label}</span>
    </div>
  )
}

function FamilyStatsView({ individuals, families }) {
  const stats = useMemo(() => {
    let male = 0, female = 0, unknown = 0, living = 0, deceased = 0
    for (const p of individuals.values()) {
      if (p.gender === 'male') male++
      else if (p.gender === 'female') female++
      else unknown++
      if (p.deathDate || p.deathYear) deceased++
      else living++
    }
    return { male, female, unknown, living, deceased, total: individuals.size, families: families.size }
  }, [individuals, families])

  return (
    <div className="fs-view">
      <div className="fs-container">
        <h1>Family Statistics</h1>
        <div className="fs-grid">
          <div className="fs-card">
            <h2>Gender</h2>
            <p className="fs-total">Total: {stats.total.toLocaleString()} people</p>
            <div className="fs-circles">
              <StatCircle label="Male" value={stats.male} total={stats.total} color="#6fa8d6" />
              <StatCircle label="Female" value={stats.female} total={stats.total} color="#e89bb0" />
              <StatCircle label="Unknown" value={stats.unknown} total={stats.total} color="#b5b0ad" />
            </div>
          </div>
          <div className="fs-card">
            <h2>Living vs. Deceased</h2>
            <p className="fs-total">Total: {stats.total.toLocaleString()} people</p>
            <div className="fs-circles">
              <StatCircle label="Living" value={stats.living} total={stats.total} color="#7fb069" />
              <StatCircle label="Deceased" value={stats.deceased} total={stats.total} color="#9c948e" />
            </div>
          </div>
          <div className="fs-card">
            <h2>Family Trees</h2>
            <p className="fs-total">Total: {stats.families.toLocaleString()} families</p>
            <div className="fs-big">{stats.families}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FamilyStatsView