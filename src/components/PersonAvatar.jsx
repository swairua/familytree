import React, { useState } from 'react'
import { photoUrl } from '../utils/photoUrl'

function getInitials(name) {
  const parts = (name || '').split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function PersonAvatar({ person, className, showInitials = true }) {
  const [failed, setFailed] = useState(false)
  const url = photoUrl(person)
  const genderClass = person ? person.gender || 'unknown' : 'unknown'
  const baseClass = className || 'avatar'

  if (url && !failed) {
    return (
      <div className={`${baseClass} ${genderClass} avatar-photo`}>
        <img
          src={url}
          alt={person ? person.name : ''}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      </div>
    )
  }

  if (!showInitials) {
    return <div className={`${baseClass} ${genderClass} avatar-empty`}></div>
  }

  return (
    <div className={`${baseClass} ${genderClass} avatar-initials`}>
      {person ? getInitials(person.name) : '?'}
    </div>
  )
}

export default PersonAvatar