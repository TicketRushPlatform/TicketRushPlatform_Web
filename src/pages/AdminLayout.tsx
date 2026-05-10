import {
  BarChart3,
  CalendarPlus,
  Film,
  KeyRound,
  LogOut,
  Map,
  ShieldCheck,
  Ticket,
  UsersRound,
} from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function AdminLayout() {
  const auth = useAuth()
  const navigate = useNavigate()

  function handleSignOut() {
    auth.signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="admin-sidebar-layout">
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <div className="admin-sidebar-brand">
          <span>
            <ShieldCheck size={18} strokeWidth={2.5} />
          </span>
          Admin Panel
        </div>

        <p className="admin-sidebar-section">Overview</p>
        <NavLink className={({ isActive }) => `admin-sidebar-link ${isActive ? 'active' : ''}`} to="/admin" end>
          <BarChart3 size={18} strokeWidth={2.5} />
          Dashboard
        </NavLink>

        <p className="admin-sidebar-section">Events</p>
        <NavLink className={({ isActive }) => `admin-sidebar-link ${isActive ? 'active' : ''}`} to="/admin/events/new">
          <CalendarPlus size={18} strokeWidth={2.5} />
          Create Event
        </NavLink>
        <NavLink className={({ isActive }) => `admin-sidebar-link ${isActive ? 'active' : ''}`} to="/admin/events/new/seat-map">
          <Map size={18} strokeWidth={2.5} />
          Seat Maps
        </NavLink>
        <NavLink className={({ isActive }) => `admin-sidebar-link ${isActive ? 'active' : ''}`} to="/admin/movies">
          <Film size={18} strokeWidth={2.5} />
          Movies
        </NavLink>

        <p className="admin-sidebar-section">Platform</p>
        <NavLink className={({ isActive }) => `admin-sidebar-link ${isActive ? 'active' : ''}`} to="/admin/users">
          <UsersRound size={18} strokeWidth={2.5} />
          Users
        </NavLink>
        <NavLink className={({ isActive }) => `admin-sidebar-link ${isActive ? 'active' : ''}`} to="/admin/permissions">
          <KeyRound size={18} strokeWidth={2.5} />
          Permissions
        </NavLink>

        <div style={{ marginTop: 'auto', paddingTop: 22, display: 'grid', gap: 6 }}>
          <NavLink className="admin-sidebar-link" to="/">
            <Ticket size={18} strokeWidth={2.5} />
            Back to App
          </NavLink>
          <button className="admin-sidebar-link" type="button" onClick={handleSignOut} style={{ border: 'none', textAlign: 'left', cursor: 'pointer' }}>
            <LogOut size={18} strokeWidth={2.5} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="admin-sidebar-content">
        <Outlet />
      </main>
    </div>
  )
}
