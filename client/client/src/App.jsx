import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'

// Sales pages
import SalesLayout from './layouts/SalesLayout'
import SalesCreateLead from './pages/SalesCreateLead'
import SalesAssigned from './pages/SalesAssigned'
import SalesPerformance from './pages/SalesPerformance'
import SalesHome from './pages/SalesHome'

// Manager pages (Laptop / PC)
import ManagerLayout from './layouts/ManagerLayout'
import ManagerUnassigned from './pages/ManagerUnassigned'
import ManagerAssignedByMe from './pages/ManagerAssignedByMe'
import ManagerMyLeads from './pages/ManagerMyLeads'
import ManagerPerformance from './pages/ManagerPerformance'
import ManagerCreateLead from './pages/ManagerCreateLead'
import ManagerHome from './pages/ManagerHome'

// Corporate
import CorporateLayout from './layouts/CorporateLayout'
import CorporateManagerDashboard from './pages/CorporateManagerDashboard'
import CorporateLeads from './pages/CorporateLeads'
import CorporateHome from './pages/CorporateHome'

// Shared
import LeadDetail from './pages/LeadDetail'

function RoleIndexRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'sales') return <Navigate to="/sales" replace />
  if (user.role === 'laptop_manager' || user.role === 'pc_manager') return <Navigate to="/mgr" replace />
  if (user.role === 'corporate_manager') return <Navigate to="/corp" replace />
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Sales area */}
      <Route
        path="/sales"
        element={
          <ProtectedRoute roles={['sales']}>
            <SalesLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<SalesHome />} />
        <Route path="create" element={<SalesCreateLead />} />
        <Route path="assigned" element={<SalesAssigned />} />
       <Route path="performance" element={<SalesPerformance />} />
      </Route>

      {/* Manager area (Laptop/PC) */}
      <Route
        path="/mgr"
        element={
          <ProtectedRoute roles={['laptop_manager','pc_manager']}>
            <ManagerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ManagerHome />} />
        <Route path="create" element={<ManagerCreateLead />} />
        <Route path="unassigned" element={<ManagerUnassigned />} />
        <Route path="assigned-by-me" element={<ManagerAssignedByMe />} />
        <Route path="my-leads" element={<ManagerMyLeads />} />
        <Route path="performance" element={<ManagerPerformance />} />
      </Route>

      {/* Corporate */}
      <Route
        path="/corp"
        element={
          <ProtectedRoute roles={['corporate_manager']}>
            <CorporateLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<CorporateHome />} />
        <Route path="create" element={<CorporateManagerDashboard />} />
        <Route path="my-leads" element={<CorporateLeads />} />
      </Route>

      {/* Lead detail (sales + managers) */}
      <Route
        path="/lead/:id"
        element={
          <ProtectedRoute roles={['sales','laptop_manager','pc_manager']}>
            <LeadDetail />
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<RoleIndexRedirect />} />
      <Route path="*" element={<RoleIndexRedirect />} />
    </Routes>
  )
}