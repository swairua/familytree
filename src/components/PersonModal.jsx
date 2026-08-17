import React, { useCallback, useEffect } from 'react'

function PersonModal({ person, individuals, families, onClose, onSelectPerson }) {
  const getInitials = useCallback((name) => {
    const parts = name.split(' ').filter(Boolean)
    if (parts.length === 0) return '?'
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
  }, [])

  const getPerson = useCallback((id) => {
    return id ? individuals.get(id) : null
  }, [individuals])

  const formatDate = useCallback((date) => {
    if (!date) return 'Unknown'
    return date
  }, [])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Close on overlay click
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const parents = person.parents.map(id => getPerson(id)).filter(Boolean)
  const spouses = person.spouses.map(id => getPerson(id)).filter(Boolean)
  const children = person.children.map(id => getPerson(id)).filter(Boolean)
  const siblings = person.siblings.map(id => getPerson(id)).filter(Boolean)

  const eventLabels = {
    BIRT: 'Birth',
    DEAT: 'Death',
    MARR: 'Marriage',
    DIV: 'Divorce',
    CENS: 'Census',
    RESI: 'Residence',
    IMMI: 'Immigration',
    EMIG: 'Emigration',
    CHR: 'Christening',
    BAPM: 'Baptism',
    CONF: 'Confirmation',
    GRAD: 'Graduation',
    NATU: 'Naturalization',
    PROB: 'Probate',
    WILL: 'Will',
    RETI: 'Retirement',
    EVEN: 'Event',
    BURI: 'Burial',
    OCCU: 'Occupation'
  }

  const renderFamilyMember = (member, relation) => {
    if (!member) return null
    return (
      <div
        key={member.id}
        className="family-member"
        onClick={() => onSelectPerson(member.id)}
      >
        <div className={`mini-avatar ${member.gender}`}>
          {getInitials(member.name)}
        </div>
        <span className="member-name">{member.name}</span>
        <span className="member-relation">{relation}</span>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>
        <div className="modal-content">
          <div className="profile-header">
            <div className={`profile-avatar ${person.gender}`}>
              {getInitials(person.name)}
            </div>
            <h2>{person.name}</h2>
            <div className="profile-dates">
              {person.birthDate && (
                <span>
                  <i className="fas fa-birthday-cake"></i> {formatDate(person.birthDate)}
                  {person.birthPlace && ` • ${person.birthPlace}`}
                </span>
              )}
              {person.deathDate && (
                <span style={{ marginLeft: '10px' }}>
                  <i className="fas fa-cross"></i> {formatDate(person.deathDate)}
                  {person.deathPlace && ` • ${person.deathPlace}`}
                </span>
              )}
            </div>
          </div>

          {/* Basic Info */}
          {(person.gender !== 'unknown' || person.occupation || person.education || person.religion) && (
            <div className="profile-section">
              <h3><i className="fas fa-info-circle"></i> Basic Information</h3>
              <div className="profile-info-grid">
                {person.gender !== 'unknown' && (
                  <div className="profile-info-item">
                    <div className="label">Gender</div>
                    <div className="value" style={{ textTransform: 'capitalize' }}>{person.gender}</div>
                  </div>
                )}
                {person.occupation && (
                  <div className="profile-info-item">
                    <div className="label">Occupation</div>
                    <div className="value">{person.occupation}</div>
                  </div>
                )}
                {person.education && (
                  <div className="profile-info-item">
                    <div className="label">Education</div>
                    <div className="value">{person.education}</div>
                  </div>
                )}
                {person.religion && (
                  <div className="profile-info-item">
                    <div className="label">Religion</div>
                    <div className="value">{person.religion}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Parents */}
          {parents.length > 0 && (
            <div className="profile-section">
              <h3><i className="fas fa-user-friends"></i> Parents</h3>
              <div className="family-list">
                {parents.map(parent => renderFamilyMember(parent, 'Parent'))}
              </div>
            </div>
          )}

          {/* Spouses */}
          {spouses.length > 0 && (
            <div className="profile-section">
              <h3><i className="fas fa-heart"></i> Spouses</h3>
              <div className="family-list">
                {spouses.map(spouse => renderFamilyMember(spouse, 'Spouse'))}
              </div>
            </div>
          )}

          {/* Children */}
          {children.length > 0 && (
            <div className="profile-section">
              <h3><i className="fas fa-child"></i> Children</h3>
              <div className="family-list">
                {children.map(child => renderFamilyMember(child, 'Child'))}
              </div>
            </div>
          )}

          {/* Siblings */}
          {siblings.length > 0 && (
            <div className="profile-section">
              <h3><i className="fas fa-users"></i> Siblings</h3>
              <div className="family-list">
                {siblings.map(sibling => renderFamilyMember(sibling, 'Sibling'))}
              </div>
            </div>
          )}

          {/* Events */}
          {person.events.length > 0 && (
            <div className="profile-section">
              <h3><i className="fas fa-calendar-alt"></i> Life Events</h3>
              <div className="family-list">
                {person.events.map((event, i) => (
                  <div key={i} className="family-member">
                    <div className="mini-avatar" style={{ background: '#95a5a6' }}>
                      <i className="fas fa-calendar"></i>
                    </div>
                    <span className="member-name">
                      {eventLabels[event.type] || event.type}
                      {event.date && ` (${event.date})`}
                    </span>
                    {event.place && (
                      <span className="member-relation">
                        <i className="fas fa-map-marker-alt"></i> {event.place}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {person.notes.length > 0 && (
            <div className="profile-section">
              <h3><i className="fas fa-sticky-note"></i> Notes</h3>
              {person.notes.map((note, i) => (
                <div key={i} className="profile-info-item" style={{ marginBottom: '8px' }}>
                  <div className="value">{note}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PersonModal