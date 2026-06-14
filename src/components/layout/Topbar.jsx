import { Link, useLocation } from 'react-router-dom'
import { Menu, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

const pageTitles = {
  '/dashboard':     'Dashboard',
  '/eventos':       'Mis Eventos',
  '/eventos/crear': 'Crear Evento',
  '/ordenes':       'Verificar Pagos',
  '/configuracion': 'Configuración',
}

export default function Topbar({ onMenuClick }) {
  const { pathname } = useLocation()
  const title = pageTitles[pathname] || 'TicketShow'

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
            <Menu className="h-5 w-5" />
          </Button>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
        </div>
        <Button asChild size="sm">
          <Link to="/eventos/crear">
            <Plus className="h-4 w-4" />
            Nuevo Evento
          </Link>
        </Button>
      </div>
    </header>
  )
}
