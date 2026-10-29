import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import More from './pages/More'
import Profile from './pages/Profile'
import Users from './pages/Users'
import IdeasPage from './pages/IdeasPage'
import TablesPage from './pages/TablesPage'
import BudgetPage from './pages/BudgetPage'
import TasksPage from './pages/tasks/TasksPage'
import CompaniesPage from './pages/companies/CompaniesPage'
import CompanyDetail from './pages/companies/CompanyDetail'
import ImportPage from './pages/companies/ImportPage'
import ReceiptPage from './pages/companies/ReceiptPage'
import SettingsPage from './pages/SettingsPage'
import TicketsPage from './pages/tickets/TicketsPage'

export default function App() {
  const { status, isAdmin } = useAuth()

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <img src="/icon-192.png" alt="" className="h-20 w-20 animate-pulse rounded-full" />
      </div>
    )
  }

  if (status === 'signed_out') return <Login />

  return (
    <Routes>
      {/* full-page, printable */}
      <Route path="receipt/:id" element={<ReceiptPage />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="outreach" element={<CompaniesPage />} />
        <Route path="outreach/import" element={<ImportPage />} />
        <Route path="outreach/:id" element={<CompanyDetail />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="ideas" element={<IdeasPage />} />
        <Route path="tables" element={<TablesPage />} />
        <Route path="more" element={<More />} />
        <Route path="profile" element={<Profile />} />
        {isAdmin && <Route path="budget" element={<BudgetPage />} />}
        {isAdmin && <Route path="users" element={<Users />} />}
        {isAdmin && <Route path="settings" element={<SettingsPage />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
