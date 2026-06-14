import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Ticket, DollarSign, AlertCircle, TrendingUp, ArrowUpRight, CheckCircle, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency, getStatusLabel } from '@/lib/utils'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'

const ChartTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="rounded-lg border bg-card p-3 shadow-lg text-xs">
        <p className="text-muted-foreground mb-1">{label}</p>
        {payload.map(p => (
          <p key={p.name} style={{ color: p.color }} className="font-semibold">
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

  useEffect(() => { loadData() }, [user])

  const loadData = async () => {
    if (!user) return
    setLoading(true)
    const { data: events } = await supabase.from('events').select('id').eq('organizer_id', user.id)
    const eventIds = events?.map(e => e.id) || []

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
    setMetrics({ events: eventIds.length, sold: approved.length, revenue: approved.reduce((s, o) => s + (o.total_amount || 0), 0), pending: pending.length })
    setRecentOrders(orders.slice(0, 6))

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i)
      const label = format(d, 'dd/MM', { locale: es })
      const dayStr = format(d, 'yyyy-MM-dd')
      const dayOrders = orders.filter(o => o.status === 'approved' && o.created_at?.startsWith(dayStr))
      return { label, tickets: dayOrders.length, ingresos: dayOrders.reduce((s, o) => s + (o.total_amount || 0), 0) }
    })
    setChartData(days)
    setLoading(false)
  }

  const metricCards = [
    { label: 'Eventos creados',       value: metrics.events,                  icon: Calendar,      to: '/eventos' },
    { label: 'Tickets vendidos',      value: metrics.sold,                    icon: Ticket,        to: '/ordenes' },
    { label: 'Ingresos totales',      value: formatCurrency(metrics.revenue), icon: DollarSign,    to: null },
    { label: 'Pagos por verificar',   value: metrics.pending,                 icon: AlertCircle,   to: '/ordenes' },
  ]

  if (loading) return (
    <div className="p-8">
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[1,2,3,4].map(i => <div key={i} className="skeleton h-28 rounded-xl" />)}
      </div>
    </div>
  )

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Resumen de tus eventos y ventas</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map(({ label, value, icon: Icon, to }) => {
          const card = (
            <Card className="hover:border-border/80 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {to && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    Ver detalle <ArrowUpRight className="h-3 w-3" />
                  </p>
                )}
              </CardContent>
            </Card>
          )
          return to
            ? <Link key={label} to={to} className="no-underline">{card}</Link>
            : <div key={label}>{card}</div>
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-sm font-medium">Tickets vendidos (7 días)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradTickets" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--foreground))" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="tickets" name="Tickets" stroke="hsl(var(--foreground))" strokeWidth={2} fill="url(#gradTickets)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-sm font-medium">Ingresos por día ($)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="ingresos" name="Ingresos $" fill="hsl(var(--foreground))" radius={[4,4,0,0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Órdenes recientes</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/ordenes">Ver todas <ArrowUpRight className="h-3 w-3 ml-1" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Ticket className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="font-medium">Sin órdenes aún</p>
              <p className="text-sm text-muted-foreground">Cuando alguien compre un ticket aparecerá aquí</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Comprador</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map(order => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <div className="font-medium">{order.buyer_name}</div>
                      <div className="text-xs text-muted-foreground">{order.buyer_email}</div>
                    </TableCell>
                    <TableCell className="text-sm">{order.events?.name || '—'}</TableCell>
                    <TableCell className="text-sm">{order.ticket_types?.name || '—'}</TableCell>
                    <TableCell className="font-semibold text-green-500">{formatCurrency(order.total_amount)}</TableCell>
                    <TableCell>
                      <Badge variant={order.status}>{getStatusLabel(order.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(order.created_at), 'dd/MM/yy HH:mm')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
