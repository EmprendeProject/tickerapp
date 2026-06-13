import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Calendar, Ticket, CheckSquare,
  Settings, LogOut, Zap, Users
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

const navItems = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Mis Eventos', to: '/eventos', icon: Calendar },
  { label: 'Verificar Pagos', to: '/ordenes', icon: CheckSquare },
]

export default function Sidebar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    toast.success('Sesión cerrada')
    navigate('/login')
  }

  const initials = (user?.email || 'U').slice(0, 2).toUpperCase()
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Usuario'

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-inner">
          <div className="sidebar-logo-icon">
            <Ticket size={20} color="white" />
          </div>
          <span className="sidebar-logo-text">TickerApp</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <p className="sidebar-section-label">Principal</p>
        {navItems.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <Icon className="sidebar-link-icon" size={18} />
            {label}
          </NavLink>
        ))}

        <p className="sidebar-section-label">Cuenta</p>
        <NavLink
          to="/configuracion"
          className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
        >
          <Settings className="sidebar-link-icon" size={18} />
          Configuración
        </NavLink>
      </nav>

      {/* Footer user */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{displayName}</div>
            <div className="sidebar-user-role">Organizador</div>
          </div>
          <button
            onClick={handleSignOut}
            className="btn btn-ghost btn-icon"
            title="Cerrar sesión"
          >
            <LogOut size={16} color="var(--color-text-muted)" />
          </button>
        </div>
      </div>
    </aside>
  )
}
