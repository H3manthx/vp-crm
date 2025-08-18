import { Outlet } from 'react-router-dom'

export default function ManagerLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        <Outlet />
      </div>
    </div>
  )
}