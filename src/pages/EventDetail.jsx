import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Calendar, MapPin, ExternalLink, Copy, Download, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { supabase } from '@/lib/supabase'
import { formatCurrency, getStatusLabel } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

export default function EventDetail() {
  const { id } = useParams()
  const [event, setEvent] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadEvent() }, [id])

  const loadEvent = async () => {
    setLoading(true)
    const { data: ev }   = await supabase.from('events').select(`*, ticket_types(*)`).eq('id', id).single()
    const { data: ords } = await supabase.from('orders').select(`*, ticket_types(name, price, currency)`).eq('event_id', id).order('created_at', { ascending: false })
    setEvent(ev)
    setOrders(ords || [])
    setLoading(false)
  }

  const copyLink = () => { navigator.clipboard.writeText(`${window.location.origin}/evento/${id}/comprar`); toast.success('¡Link copiado!') }

  const exportCSV = () => {
    const rows = [
      ['Nombre','Email','Teléfono','Ticket','Monto','Estado','Fecha','QR Token'],
      ...orders.map(o => [o.buyer_name,o.buyer_email,o.buyer_phone||'',o.ticket_types?.name||'',o.total_amount||'',o.status,format(new Date(o.created_at),'dd/MM/yyyy HH:mm'),o.qr_code||''])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `asistentes-${event?.name||id}.csv`; a.click()
  }

  if (loading) return (
    <div className="p-4 md:p-8 space-y-4">
      <div className="skeleton h-48 rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
    </div>
  )
  if (!event) return <div className="p-4 md:p-8"><Card className="py-16 text-center"><p>Evento no encontrado</p></Card></div>

  const approved = orders.filter(o => o.status === 'approved')
  const pending  = orders.filter(o => o.status === 'pending')
  const rejected = orders.filter(o => o.status === 'rejected')
  const revenue  = approved.reduce((s, o) => s + (o.total_amount || 0), 0)

  const pieData = [
    { name: 'Aprobados', value: approved.length, color: '#22c55e' },
    { name: 'Pendientes', value: pending.length,  color: '#eab308' },
    { name: 'Rechazados', value: rejected.length, color: '#ef4444' },
  ].filter(d => d.value > 0)

  const statusIcon = (s) => s === 'approved'
    ? <CheckCircle className="h-3.5 w-3.5" />
    : s === 'rejected'
    ? <XCircle className="h-3.5 w-3.5" />
    : <AlertCircle className="h-3.5 w-3.5" />

  return (
    <div className="p-4 md:p-8 space-y-6 animate-fade-in">
      {/* Header banner */}
      <div
        className="rounded-xl p-6 md:p-8 relative overflow-hidden border"
        style={event.banner_url ? {
          background: `linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.85)), url(${event.banner_url}) center/cover`
        } : undefined}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
          <Link to="/eventos" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Mis Eventos</Link>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={copyLink} className="flex-1 sm:flex-none"><Copy className="h-3.5 w-3.5 mr-1" /> Copiar</Button>
            <Button size="sm" asChild className="flex-1 sm:flex-none"><a href={`/evento/${id}/comprar`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Ver</a></Button>
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-3">{event.name}</h1>
        <div className="flex gap-6 text-sm text-muted-foreground flex-wrap">
          <div className="flex items-center gap-2"><Calendar className="h-4 w-4" />{format(new Date(event.date), "EEEE dd 'de' MMMM yyyy, HH:mm", { locale: es })}</div>
          {event.location && <div className="flex items-center gap-2"><MapPin className="h-4 w-4" />{event.location}</div>}
        </div>
        {event.description && <p className="mt-3 text-sm text-muted-foreground max-w-xl">{event.description}</p>}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Órdenes totales', value: orders.length },
          { label: 'Aprobadas', value: approved.length, color: 'text-green-500' },
          { label: 'Pendientes', value: pending.length, color: 'text-yellow-500' },
          { label: 'Ingresos', value: formatCurrency(revenue), color: 'text-green-500' },
        ].map((m, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className={`text-2xl font-bold ${m.color || ''}`}>{m.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{m.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Ticket types */}
      <Card>
        <CardHeader><CardTitle className="text-base">Tipos de Ticket</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {event.ticket_types?.map(tt => {
            const pct = tt.quantity > 0 ? Math.round((tt.sold / tt.quantity) * 100) : 0
            return (
              <div key={tt.id} className="p-3 rounded-lg bg-muted/40">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{tt.name}</span>
                    <Badge variant="outline">{formatCurrency(tt.price, tt.currency)}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{tt.sold}/{tt.quantity} vendidos</span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Órdenes ({orders.length})</TabsTrigger>
          <TabsTrigger value="stats">Estadísticas</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Lista de Órdenes</CardTitle>
              <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-3.5 w-3.5" /> Exportar CSV</Button>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <p className="font-medium">Sin órdenes aún</p>
                  <p className="text-sm text-muted-foreground">Comparte el link de venta para recibir tu primera compra</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Comprador</TableHead><TableHead>Ticket</TableHead><TableHead>Monto</TableHead>
                      <TableHead>Estado</TableHead><TableHead>Fecha</TableHead><TableHead>QR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map(order => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{order.buyer_name}</div>
                          <div className="text-xs text-muted-foreground">{order.buyer_email}</div>
                        </TableCell>
                        <TableCell className="text-sm">{order.ticket_types?.name}</TableCell>
                        <TableCell className="font-semibold text-green-500 text-sm">{formatCurrency(order.total_amount)}</TableCell>
                        <TableCell>
                          <Badge variant={order.status} className="gap-1">
                            {statusIcon(order.status)} {getStatusLabel(order.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(order.created_at), 'dd/MM/yy HH:mm')}</TableCell>
                        <TableCell>
                          {order.qr_code
                            ? <code className="text-xs text-muted-foreground font-mono">{order.qr_code.slice(-8)}</code>
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          {pieData.length > 0 ? (
            <Card>
              <CardHeader><CardTitle className="text-base">Distribución de órdenes</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <Card className="py-12 text-center">
              <p className="text-muted-foreground text-sm">Las estadísticas aparecerán cuando haya órdenes</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
