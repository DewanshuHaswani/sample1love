import React from 'react'
import ReactDOM from 'react-dom/client'
import { FamilySection } from './components/FamilySection'
import { MapSection } from './components/MapSection'

// Removed WavesDemo to restore the video background as requested by the user.

const mapRootEl = document.getElementById('react-map-root');
if (mapRootEl) {
  ReactDOM.createRoot(mapRootEl).render(
    <React.StrictMode>
      <MapSection />
    </React.StrictMode>
  )
}

const familyRootEl = document.getElementById('react-family-root');
if (familyRootEl) {
  ReactDOM.createRoot(familyRootEl).render(
    <React.StrictMode>
      <FamilySection />
    </React.StrictMode>
  )
}
