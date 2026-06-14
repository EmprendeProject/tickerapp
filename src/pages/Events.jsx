import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Calendar, MapPin, Ticket, Trash2, ExternalLink } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Events() {
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState(null)

  useEffect(() => { loadEvents() }, [user])

  const loadEvents = async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('events')
      .select(`*, ticket_types(id, name, price, quantity, sold)`)
      .eq('organizer_id', user.id)
      .order('date', { ascending: true })
    setEvents(data || [])
    setLoading(false)
  }

  const deleteEvent = async (id) => {
    if (!confirm('¿Eliminar este evento? Esta acción no se puede deshacer.')) return
    setDeleting(id)
    await supabase.from('orders').delete().eq('event_id', id)
    await supabase.from('ticket_types').delete().eq('event_id', id)
    await supabase.from('events').delete().eq('id', id)
    toast.success('Evento eliminado')
    loadEvents()
    setDeleting(null)
  }

  const filtered = events.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.location?.toLowerCase().includes(search.toLowerCase())
  )

  const getSold    = e => (e.ticket_types || []).reduce((s, t) => s + (t.sold || 0), 0)
  const getCap     = e => (e.ticket_types || []).reduce((s, t) => s + (t.quantity || 0), 0)
  const getRevenue = e => (e.ticket_types || []).reduce((s, t) => s + ((t.sold || 0) * (t.price || 0)), 0)

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mis Eventos</h1>
          <p className="text-sm text-muted-foreground">{events.length} evento{events.length !== 1 ? 's' : ''} creado{events.length !== 1 ? 's' : ''}</p>
        </div>
        <Button asChild>
          <Link to="/eventos/crear"><Plus className="h-4 w-4" /> Crear Evento</Link>
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar eventos..."
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="skeleton h-80 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="py-16">
          <div className="flex flex-col items-center text-center">
            <Calendar className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold mb-1">{search ? 'Sin resultados' : 'Sin eventos aún'}</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {search ? 'Prueba con otra búsqueda' : 'Crea tu primer evento para empezar a vender tickets'}
            </p>
            {!search && (
              <Button asChild><Link to="/eventos/crear"><Plus className="h-4 w-4" /> Crear mi primer evento</Link></Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(event => {
            const sold = getSold(event)
            const cap  = getCap(event)
            const rev  = getRevenue(event)
            const pct  = cap > 0 ? Math.round((sold / cap) * 100) : 0
            const isPast = new Date(event.date) < new Date()

            return (
              <Card key={event.id} className="overflow-hidden group hover:border-border/80 transition-all">
                {/* Banner */}
                <div className="h-40 relative overflow-hidden bg-muted">
                  {event.banner_url ? (
                    <img src={event.banner_url} alt={event.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Calendar className="h-12 w-12 text-muted-foreground/20" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    <Badge variant={isPast ? 'secondary' : 'default'}>
                      {isPast ? 'Finalizado' : 'Próximo'}
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-5 space-y-4">
                  <div>
                    <h3 className="font-bold text-base mb-2 line-clamp-1">{event.name}</h3>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3 shrink-0" />
                        {format(new Date(event.date), "EEEE dd 'de' MMMM, HH:mm", { locale: es })}
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {event.location}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-muted/50">
                    {[
                      { label: 'Vendidos', value: sold },
                      { label: 'Capacidad', value: cap },
                      { label: 'Ingresos', value: formatCurrency(rev), green: true },
                    ].map(s => (
                      <div key={s.label} className="text-center">
                        <div className={`text-lg font-bold ${s.green ? 'text-green-500' : ''}`}>{s.value}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Progress */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Ocupación</span>
                      <span className={pct > 80 ? 'text-red-400' : pct > 50 ? 'text-yellow-400' : 'text-green-400'}>{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <Button asChild size="sm" className="flex-1">
                      <Link to={`/eventos/${event.id}`}><ExternalLink className="h-3 w-3" /> Ver detalle</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" title="Página pública">
                      <a href={`/evento/${event.id}/comprar`} target="_blank" rel="noreferrer">
                        <Ticket className="h-3 w-3" />
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deleting === event.id}
                      onClick={() => deleteEvent(event.id)}
                    >
                      {deleting === event.id
                        ? <div className="h-3 w-3 border border-white/30 border-t-white rounded-full animate-spin" />
                        : <Trash2 className="h-3 w-3" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
