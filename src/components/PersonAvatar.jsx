import React, { useState } from 'react'
import { photoUrl } from '../utils/photoUrl'
import { cleanName, getInitials } from '../utils/cleanName'

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
          alt={person ? cleanName(person.name) : ''}
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