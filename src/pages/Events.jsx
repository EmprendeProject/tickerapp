import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Calendar, MapPin, Ticket, Users, ExternalLink, Edit, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatDate, formatCurrency } from '../lib/utils'
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
    const { data, error } = await supabase
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

  const getTotalSold = (event) => (event.ticket_types || []).reduce((s, t) => s + (t.sold || 0), 0)
  const getTotalCap  = (event) => (event.ticket_types || []).reduce((s, t) => s + (t.quantity || 0), 0)
  const getRevenue   = (event) => (event.ticket_types || []).reduce((s, t) => s + ((t.sold || 0) * (t.price || 0)), 0)

  return (
    <div className="page-wrapper animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Mis Eventos</h1>
          <p className="page-subtitle">{events.length} evento{events.length !== 1 ? 's' : ''} creado{events.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/eventos/crear" className="btn btn-primary">
          <Plus size={16} /> Crear Evento
        </Link>
      </div>

      {/* Search */}
      <div className="form-input-group mb-6" style={{ maxWidth: 400 }}>
        <Search className="form-input-prefix" size={16} />
        <input
          type="text"
          className="form-input"
          placeholder="Buscar eventos..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="event-grid">
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 360, borderRadius: 'var(--radius-xl)' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state card">
          <Calendar className="empty-state-icon" />
          <h3 className="empty-state-title">{search ? 'Sin resultados' : 'Sin eventos aún'}</h3>
          <p className="empty-state-desc">
            {search ? 'Prueba con otra búsqueda' : 'Crea tu primer evento para empezar a vender tickets'}
          </p>
          {!search && (
            <Link to="/eventos/crear" className="btn btn-primary">
              <Plus size={16} /> Crear mi primer evento
            </Link>
          )}
        </div>
      ) : (
        <div className="event-grid">
          {filtered.map(event => {
            const sold = getTotalSold(event)
            const cap  = getTotalCap(event)
            const rev  = getRevenue(event)
            const pct  = cap > 0 ? Math.round((sold / cap) * 100) : 0
            const isPast = new Date(event.date) < new Date()

            return (
              <div key={event.id} className="event-card">
                {/* Banner */}
                <div className="event-card-banner">
                  {event.banner_url ? (
                    <img src={event.banner_url} alt={event.name} />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%',
                      background: 'linear-gradient(135deg, #1a0a3d 0%, #0a1a3d 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Calendar size={48} color="rgba(255,255,255,0.15)" />
                    </div>
                  )}
                  <div className="event-card-badge">
                    <span className={`badge ${isPast ? 'badge-info' : 'badge-primary'}`}>
                      {isPast ? 'Finalizado' : 'Próximo'}
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="event-card-body">
                  <h3 className="event-card-title">{event.name}</h3>
                  <div className="event-card-meta">
                    <div className="event-meta-item">
                      <Calendar size={13} />
                      {format(new Date(event.date), "EEEE dd 'de' MMMM, HH:mm", { locale: es })}
                    </div>
                    {event.location && (
                      <div className="event-meta-item">
                        <MapPin size={13} />
                        {event.location}
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="event-card-stats">
                    <div className="event-stat">
                      <div className="event-stat-value">{sold}</div>
                      <div className="event-stat-label">Vendidos</div>
                    </div>
                    <div className="event-stat">
                      <div className="event-stat-value">{cap}</div>
                      <div className="event-stat-label">Capacidad</div>
                    </div>
                    <div className="event-stat">
                      <div className="event-stat-value" style={{ color: 'var(--color-success)', fontSize: '1.1rem' }}>
                        {formatCurrency(rev)}
                      </div>
                      <div className="event-stat-label">Ingresos</div>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="progress-bar-wrapper mb-4">
                    <div className="progress-bar-header">
                      <span>Ocupación</span>
                      <span style={{ color: pct > 80 ? 'var(--color-danger)' : pct > 50 ? 'var(--color-warning)' : 'var(--color-success)', fontWeight: 700 }}>
                        {pct}%
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="event-card-actions">
                    <Link to={`/eventos/${event.id}`} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                      <ExternalLink size={13} /> Ver detalle
                    </Link>
                    <a
                      href={`/evento/${event.id}/comprar`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                      title="Página pública de venta"
                    >
                      <Ticket size={13} />
                    </a>
                    <button
                      onClick={() => deleteEvent(event.id)}
                      className="btn btn-danger btn-sm"
                      disabled={deleting === event.id}
                    >
                      {deleting === event.id ? <div className="btn-spinner" style={{ borderTopColor: 'var(--color-danger)' }} /> : <Trash2 size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
