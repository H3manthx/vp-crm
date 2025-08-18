// src/pages/CorporateManagerDashboard.jsx
import { useState } from 'react'
import CorporateCreateLead from '../components/CorporateCreateLead'   // <-- new
import HomeButton from '../components/HomeButton'

export default function CorporateManagerDashboard(){
  const [open, setOpen] = useState(false)
  const [lead, setLead] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const onOpen = (l) => { setLead(l); setOpen(true) }
  const onChanged = () => setRefreshKey(k => k + 1)

  return (
    <div className="relative min-h-screen bg-gray-50 pb-20">
      <HomeButton to="/corp" />

      {/* Create section */}
      <div className="pt-10 max-w-6xl mx-auto">
        <CorporateCreateLead onCreated={onChanged} />
      </div>
    </div>
  )
}