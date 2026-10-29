import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import More from './pages/More'
import Profile from './pages/Profile'
import Users from './pages/Users'
import ComingSoon from './pages/ComingSoon'
import TasksPage from './pages/tasks/TasksPage'

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
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="outreach" element={<ComingSoon title="Outreach" />} />
        <Route path="tickets" element={<ComingSoon title="Ticket Sales" />} />
        <Route path="ideas" element={<ComingSoon title="Ideas Board" />} />
        <Route path="tables" element={<ComingSoon title="Tables" />} />
        <Route path="more" element={<More />} />
        <Route path="profile" element={<Profile />} />
        {isAdmin && <Route path="budget" element={<ComingSoon title="Budget" />} />}
        {isAdmin && <Route path="users" element={<Users />} />}
        {isAdmin && <Route path="settings" element={<ComingSoon title="Settings" />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
