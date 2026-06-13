import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Calendar, MapPin, Ticket, Users, ExternalLink, Copy, CheckCircle, XCircle, AlertCircle, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatDate, getStatusLabel } from '../lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend
} from 'recharts'

export default function EventDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [event, setEvent] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('orders')

  useEffect(() => { loadEvent() }, [id])

  const loadEvent = async () => {
    setLoading(true)
    const { data: ev } = await supabase
      .from('events')
      .select(`*, ticket_types(*)`)
      .eq('id', id)
      .single()

    const { data: ords } = await supabase
      .from('orders')
      .select(`*, ticket_types(name, price, currency)`)
      .eq('event_id', id)
      .order('created_at', { ascending: false })

    setEvent(ev)
    setOrders(ords || [])
    setLoading(false)
  }

  const copyLink = () => {
    const link = `${window.location.origin}/evento/${id}/comprar`
    navigator.clipboard.writeText(link)
    toast.success('¡Link copiado!')
  }

  const exportCSV = () => {
    const rows = [
      ['Nombre', 'Email', 'Teléfono', 'Ticket', 'Monto', 'Estado', 'Fecha', 'QR Token'],
      ...orders.map(o => [
        o.buyer_name, o.buyer_email, o.buyer_phone || '',
        o.ticket_types?.name || '', o.total_amount || '',
        o.status, format(new Date(o.created_at), 'dd/MM/yyyy HH:mm'),
        o.qr_code || '',
      ])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `asistentes-${event?.name || id}.csv`; a.click()
  }

  if (loading) return (
    <div className="page-wrapper">
      <div className="skeleton" style={{ height: 200, borderRadius: 'var(--radius-xl)', marginBottom: 24 }} />
    </div>
  )
  if (!event) return (
    <div className="page-wrapper"><div className="empty-state card"><p>Evento no encontrado</p></div></div>
  )

  const approved = orders.filter(o => o.status === 'approved')
  const pending  = orders.filter(o => o.status === 'pending')
  const rejected = orders.filter(o => o.status === 'rejected')
  const revenue  = approved.reduce((s, o) => s + (o.total_amount || 0), 0)

  const pieData = [
    { name: 'Aprobados', value: approved.length, color: 'var(--color-success)' },
    { name: 'Pendientes', value: pending.length,  color: 'var(--color-warning)' },
    { name: 'Rechazados', value: rejected.length, color: 'var(--color-danger)' },
  ].filter(d => d.value > 0)

  const statusIcon = (status) => {
    if (status === 'approved') return <CheckCircle size={14} color="var(--color-success)" />
    if (status === 'rejected') return <XCircle size={14} color="var(--color-danger)" />
    return <AlertCircle size={14} color="var(--color-warning)" />
  }

  return (
    <div className="page-wrapper animate-fade-in">
      {/* Header */}
      <div className="card mb-8" style={{
        background: event.banner_url
          ? `linear-gradient(rgba(8,12,24,0.7), rgba(8,12,24,0.95)), url(${event.banner_url}) center/cover`
          : 'var(--gradient-hero)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-10)',
      }}>
        <div className="flex items-center justify-between mb-4">
          <Link to="/eventos" style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>← Mis Eventos</Link>
          <div className="flex gap-3">
            <button onClick={copyLink} className="btn btn-secondary btn-sm">
              <Copy size={13} /> Copiar link de venta
            </button>
            <a href={`/evento/${id}/comprar`} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
              <ExternalLink size={13} /> Ver página pública
            </a>
          </div>
        </div>

        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 8 }}>{event.name}</h1>

        <div className="flex gap-6" style={{ flexWrap: 'wrap' }}>
          <div className="event-meta-item">
            <Calendar size={14} />
            {format(new Date(event.date), "EEEE dd 'de' MMMM yyyy, HH:mm", { locale: es })}
          </div>
          {event.location && (
            <div className="event-meta-item">
              <MapPin size={14} />
              {event.location}
            </div>
          )}
        </div>

        {event.description && (
          <p style={{ marginTop: 12, color: 'var(--color-text-muted)', maxWidth: 600 }}>{event.description}</p>
        )}
      </div>

      {/* Metrics row */}
      <div className="grid-4 mb-8">
        {[
          { label: 'Órdenes totales', value: orders.length, color: 'var(--color-primary)' },
          { label: 'Aprobadas', value: approved.length, color: 'var(--color-success)' },
          { label: 'Pendientes', value: pending.length, color: 'var(--color-warning)' },
          { label: 'Ingresos', value: formatCurrency(revenue), color: 'var(--color-accent)' },
        ].map((m, i) => (
          <div key={i} className="metric-card">
            <div className="metric-value" style={{ color: m.color }}>{m.value}</div>
            <div className="metric-label">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Ticket types capacities */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-5">
          <h3 style={{ fontWeight: 700 }}>Tipos de Ticket</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {event.ticket_types?.map(tt => {
            const pct = tt.quantity > 0 ? Math.round((tt.sold / tt.quantity) * 100) : 0
            return (
              <div key={tt.id} style={{
                background: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 18px',
              }}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span style={{ fontWeight: 700 }}>{tt.name}</span>
                    <span className="badge badge-primary" style={{ marginLeft: 8 }}>
                      {formatCurrency(tt.price, tt.currency)}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    {tt.sold}/{tt.quantity} vendidos
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[['orders', 'Órdenes'], ['stats', 'Estadísticas']].map(([key, label]) => (
          <button key={key} className={`tab-btn${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {/* Orders tab */}
      {tab === 'orders' && (
        <div className="card animate-fade-in">
          <div className="flex items-center justify-between mb-5">
            <h3 style={{ fontWeight: 700 }}>Lista de Órdenes ({orders.length})</h3>
            <button onClick={exportCSV} className="btn btn-secondary btn-sm">
              <Download size={13} /> Exportar CSV
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="empty-state">
              <Ticket className="empty-state-icon" />
              <p className="empty-state-title">Sin órdenes aún</p>
              <p className="empty-state-desc">Comparte el link de venta para recibir tu primera compra</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Comprador</th>
                    <th>Ticket</th>
                    <th>Monto</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th>QR Token</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{order.buyer_name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{order.buyer_email}</div>
                      </td>
                      <td>{order.ticket_types?.name}</td>
                      <td style={{ fontWeight: 700, color: 'var(--color-success)' }}>{formatCurrency(order.total_amount)}</td>
                      <td>
                        <span className={`badge badge-${order.status}`}>
                          {statusIcon(order.status)} {getStatusLabel(order.status)}
                        </span>
                      </td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                        {format(new Date(order.created_at), 'dd/MM/yy HH:mm')}
                      </td>
                      <td>
                        {order.qr_code ? (
                          <code style={{ fontSize: '0.72rem', color: 'var(--color-accent)', fontFamily: 'monospace' }}>
                            {order.qr_code.slice(-8)}
                          </code>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Stats tab */}
      {tab === 'stats' && (
        <div className="animate-fade-in">
          {pieData.length > 0 ? (
            <div className="chart-container">
              <h3 className="chart-title mb-6">Distribución de órdenes</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={{ stroke: 'var(--color-border)' }}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 8 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state card">
              <p className="empty-state-title">Sin datos suficientes</p>
              <p className="empty-state-desc">Las estadísticas aparecerán cuando haya órdenes</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
