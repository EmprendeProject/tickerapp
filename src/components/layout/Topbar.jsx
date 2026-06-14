import { Link, useLocation } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

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
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b">
      <div className="flex h-14 items-center justify-between px-6">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
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
