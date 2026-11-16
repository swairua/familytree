import React from 'react'
import DiscoveriesView from './DiscoveriesView'

export default function MatchesByPeopleView({ individuals, onSelectPerson, onSwitchView }) {
  return (
    <DiscoveriesView
      individuals={individuals}
      onSelectPerson={onSelectPerson}
      onSwitchView={onSwitchView}
      mode="people"
    />
  )
}
