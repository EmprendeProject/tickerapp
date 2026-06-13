import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar, Ticket, DollarSign, Users, TrendingUp,
  ArrowUpRight, Clock, CheckCircle, XCircle, AlertCircle
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatDate, getStatusLabel, getStatusColor } from '../lib/utils'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div style={{
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '8px 14px',
        fontSize: '0.82rem',
      }}>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>{label}</p>
        {payload.map(p => (
          <p key={p.name} style={{ color: p.color, fontWeight: 700 }}>
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function Dashboard() {
  const { user } = useAuth()
  const [metrics, setMetrics] = useState({ events: 0, sold: 0, revenue: 0, pending: 0 })
  const [recentOrders, setRecentOrders] = useState([])
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    if (!user) return
    setLoading(true)

    // Fetch events
    const { data: events } = await supabase
      .from('events')
      .select('id')
      .eq('organizer_id', user.id)

    const eventIds = events?.map(e => e.id) || []

    // Fetch orders
    let orders = []
    if (eventIds.length > 0) {
      const { data } = await supabase
        .from('orders')
        .select(`*, events(name), ticket_types(name, price)`)
        .in('event_id', eventIds)
        .order('created_at', { ascending: false })
      orders = data || []
    }

    const approved = orders.filter(o => o.status === 'approved')
    const pending  = orders.filter(o => o.status === 'pending')
    const revenue  = approved.reduce((sum, o) => sum + (o.total_amount || 0), 0)

    setMetrics({
      events: eventIds.length,
      sold: approved.length,
      revenue,
      pending: pending.length,
    })
    setRecentOrders(orders.slice(0, 6))

    // Build chart data (last 7 days)
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i)
      const label = format(d, 'dd/MM', { locale: es })
      const dayStr = format(d, 'yyyy-MM-dd')
      const dayOrders = orders.filter(o =>
        o.status === 'approved' && o.created_at?.startsWith(dayStr)
      )
      return { label, tickets: dayOrders.length, ingresos: dayOrders.reduce((s, o) => s + (o.total_amount || 0), 0) }
    })
    setChartData(days)

    setLoading(false)
  }

  const statusIcon = (status) => {
    if (status === 'approved') return <CheckCircle size={14} color="var(--color-success)" />
    if (status === 'rejected') return <XCircle size={14} color="var(--color-danger)" />
    return <AlertCircle size={14} color="var(--color-warning)" />
  }

  if (loading) return (
    <div className="page-wrapper">
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[1,2,3,4].map(i => <div key={i} className="metric-card skeleton" style={{ height: 120 }} />)}
      </div>
    </div>
  )

  return (
    <div className="page-wrapper animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Resumen de tus eventos y ventas</p>
      </div>

      {/* Metrics */}
      <div className="grid-4 mb-8">
        <MetricCard
          icon={<Calendar size={20} />}
          iconBg="rgba(124,58,237,0.15)"
          iconColor="var(--color-primary)"
          value={metrics.events}
          label="Eventos creados"
          link="/eventos"
        />
        <MetricCard
          icon={<Ticket size={20} />}
          iconBg="rgba(6,182,212,0.15)"
          iconColor="var(--color-accent)"
          value={metrics.sold}
          label="Tickets vendidos"
          link="/ordenes"
        />
        <MetricCard
          icon={<DollarSign size={20} />}
          iconBg="rgba(16,185,129,0.15)"
          iconColor="var(--color-success)"
          value={formatCurrency(metrics.revenue)}
          label="Ingresos totales"
        />
        <MetricCard
          icon={<AlertCircle size={20} />}
          iconBg="rgba(245,158,11,0.15)"
          iconColor="var(--color-warning)"
          value={metrics.pending}
          label="Pagos por verificar"
          link="/ordenes"
          alert={metrics.pending > 0}
        />
      </div>

      {/* Charts */}
      <div className="grid-2 mb-8">
        <div className="chart-container">
          <div className="chart-header">
            <h3 className="chart-title">Tickets vendidos (7 días)</h3>
            <TrendingUp size={16} color="var(--color-text-muted)" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gradTickets" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="tickets" name="Tickets" stroke="#7c3aed" strokeWidth={2} fill="url(#gradTickets)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <div className="chart-header">
            <h3 className="chart-title">Ingresos por día ($)</h3>
            <DollarSign size={16} color="var(--color-text-muted)" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="ingresos" name="Ingresos $" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent orders */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 style={{ fontWeight: 700 }}>Órdenes recientes</h3>
          <Link to="/ordenes" className="btn btn-ghost btn-sm">
            Ver todas <ArrowUpRight size={14} />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="empty-state">
            <Ticket className="empty-state-icon" />
            <p className="empty-state-title">Sin órdenes aún</p>
            <p className="empty-state-desc">Cuando alguien compre un ticket aparecerá aquí</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Comprador</th>
                  <th>Evento</th>
                  <th>Ticket</th>
                  <th>Monto</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(order => (
                  <tr key={order.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{order.buyer_name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{order.buyer_email}</div>
                    </td>
                    <td>{order.events?.name || '—'}</td>
                    <td>{order.ticket_types?.name || '—'}</td>
                    <td style={{ fontWeight: 700, color: 'var(--color-success)' }}>
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td>
                      <span className={`badge badge-${order.status}`}>
                        {statusIcon(order.status)} {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                      {format(new Date(order.created_at), 'dd/MM/yy HH:mm')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function MetricCard({ icon, iconBg, iconColor, value, label, link, alert }) {
  const content = (
    <div className={`metric-card${alert ? ' animate-pulse-glow' : ''}`}>
      <div className="metric-icon" style={{ background: iconBg, color: iconColor }}>
        {icon}
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
      {link && (
        <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', gap: 4 }}>
          Ver detalle <ArrowUpRight size={12} />
        </div>
      )}
    </div>
  )
  return link ? <Link to={link} style={{ textDecoration: 'none' }}>{content}</Link> : content
}
