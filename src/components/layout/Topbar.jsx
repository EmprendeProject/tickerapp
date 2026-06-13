import { useLocation, Link } from 'react-router-dom'
import { Plus, Bell } from 'lucide-react'

const pageTitles = {
  '/dashboard':     'Dashboard',
  '/eventos':       'Mis Eventos',
  '/eventos/crear': 'Crear Evento',
  '/ordenes':       'Verificar Pagos',
  '/configuracion': 'Configuración',
}

export default function Topbar() {
  const { pathname } = useLocation()
  const title = pageTitles[pathname] || 'TickerApp'

  return (
    <header className="topbar">
      <span className="topbar-title">{title}</span>
      <div className="topbar-actions">
        <Link to="/eventos/crear" className="btn btn-primary btn-sm">
          <Plus size={15} />
          Nuevo Evento
        </Link>
      </div>
    </header>
  )
}
