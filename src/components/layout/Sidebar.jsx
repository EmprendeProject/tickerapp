import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Calendar, CheckSquare,
  Settings, LogOut, Ticket, ScanLine
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/cn'
import logo from '@/assets/logo.png'
import toast from 'react-hot-toast'
import { ThemeToggle } from '@/components/ThemeToggle'

const navItems = [
  { label: 'Dashboard',       to: '/dashboard', icon: LayoutDashboard },
  { label: 'Mis Eventos',     to: '/eventos',   icon: Calendar },
  { label: 'Verificar Pagos', to: '/ordenes',   icon: CheckSquare },
  { label: 'Escáner QR',     to: '/scanner',   icon: ScanLine },
]

export default function Sidebar({ isOpen, onClose }) {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    toast.success('Sesión cerrada')
    navigate('/login')
  }

  const initials    = (user?.email || 'U').slice(0, 2).toUpperCase()
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Usuario'

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        "fixed top-0 left-0 h-screen w-64 border-r bg-card flex flex-col z-50 transform transition-transform duration-200 ease-in-out md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b">
        <img src={logo} alt="TicketShow" className="h-8 w-auto object-contain" />
        <span className="text-lg font-bold tracking-tight">TicketShow</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Principal
        </p>
        {navItems.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}

        <div className="pt-4">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Cuenta
          </p>
          <NavLink
            to="/configuracion"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )
            }
          >
            <Settings className="h-4 w-4 shrink-0" />
            Configuración
          </NavLink>
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground">Organizador</p>
          </div>
          <div className="flex shrink-0">
            <ThemeToggle className="h-7 w-7 text-muted-foreground mr-1" />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={handleSignOut}
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </aside>
    </>
  )
}
