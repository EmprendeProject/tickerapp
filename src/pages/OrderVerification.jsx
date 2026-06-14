import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, AlertCircle, Image as ImageIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency, getStatusLabel } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { buildTicketApprovalEmail } from '@/lib/emailTemplates'

export default function OrderVerification() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [allOrders, setAllOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('pending')
  const [processing, setProcessing] = useState(null)
  const [proofUrl, setProofUrl] = useState(null)

  useEffect(() => { loadOrders() }, [user])

  const loadOrders = async () => {
    if (!user) return
    setLoading(true)
    const { data: events } = await supabase.from('events').select('id').eq('organizer_id', user.id)
    const eventIds = events?.map(e => e.id) || []
    if (eventIds.length === 0) { setAllOrders([]); setOrders([]); setLoading(false); return }
    const { data } = await supabase
      .from('orders')
      .select(`*, events(name, date, location), ticket_types(name, price, currency)`)
      .in('event_id', eventIds)
      .order('created_at', { ascending: false })
    setAllOrders(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (activeTab === 'all') setOrders(allOrders)
    else setOrders(allOrders.filter(o => o.status === activeTab))
  }, [activeTab, allOrders])

  const updateStatus = async (orderId, status, ticketTypeId) => {
    setProcessing(orderId)
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId)
    if (!error && status === 'approved') {
      await supabase.rpc('increment_sold', { ticket_type_id: ticketTypeId })
      
      // Enviar correo de confirmación con el ticket QR al comprador (no bloqueante)
      try {
        const orderObj = allOrders.find(o => o.id === orderId)
        if (orderObj) {
          const emailHtml = buildTicketApprovalEmail({
            event: {
              name: orderObj.events?.name,
              date: orderObj.events?.date,
              location: orderObj.events?.location
            },
            order: orderObj
          })
          
          await supabase.functions.invoke('send-ticket-email', {
            body: {
              email: orderObj.buyer_email,
              subject: `✅ Entrada aprobada - ${orderObj.events?.name}`,
              html: emailHtml,
              text: `¡Hola ${orderObj.buyer_name}! Tu pago fue aprobado. Tu código QR es: ${orderObj.qr_code}. Preséntalo en la entrada del evento.`
            }
          })
        }
      } catch (emailErr) {
        console.error('Error al enviar correo de confirmación al comprador:', emailErr)
      }
    }
    if (error) toast.error('Error al actualizar el estado')
    else toast.success(status === 'approved' ? '✅ Pago aprobado' : '❌ Pago rechazado')
    loadOrders()
    setProcessing(null)
  }

  const counts = {
    pending:  allOrders.filter(o => o.status === 'pending').length,
    approved: allOrders.filter(o => o.status === 'approved').length,
    rejected: allOrders.filter(o => o.status === 'rejected').length,
  }

  const statusIcon = s => s === 'approved' ? <CheckCircle className="h-3.5 w-3.5" /> : s === 'rejected' ? <XCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Verificar Pagos</h1>
        <p className="text-sm text-muted-foreground">Revisa y aprueba los comprobantes de Pago Móvil</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-500">{counts.pending}</div>
            <div className="text-sm text-muted-foreground mt-1">Pendientes</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">{counts.approved}</div>
            <div className="text-sm text-muted-foreground mt-1">Aprobados</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-500">{counts.rejected}</div>
            <div className="text-sm text-muted-foreground mt-1">Rechazados</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">⏳ Pendientes ({counts.pending})</TabsTrigger>
          <TabsTrigger value="approved">✅ Aprobados</TabsTrigger>
          <TabsTrigger value="rejected">❌ Rechazados</TabsTrigger>
          <TabsTrigger value="all">Todos</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-16">
                  <div className="h-8 w-8 border-2 border-border border-t-foreground rounded-full animate-spin" />
                </div>
              ) : orders.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500/40 mb-3" />
                  <p className="font-medium">Sin órdenes</p>
                  <p className="text-sm text-muted-foreground">
                    {activeTab === 'pending' ? '¡Estás al día! No hay pagos pendientes.' : 'No hay órdenes en esta categoría.'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Comprador</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Comprobante</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map(order => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{order.buyer_name}</div>
                          <div className="text-xs text-muted-foreground">{order.buyer_email}</div>
                          {order.buyer_phone && <div className="text-xs text-muted-foreground">{order.buyer_phone}</div>}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{order.events?.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {order.events?.date && format(new Date(order.events.date), 'dd/MM/yyyy', { locale: es })}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{order.ticket_types?.name}</TableCell>
                        <TableCell className="font-semibold text-green-500 text-sm">{formatCurrency(order.total_amount)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(order.created_at), 'dd/MM/yy HH:mm')}</TableCell>
                        <TableCell>
                          {order.payment_proof_url
                            ? <Button variant="outline" size="sm" onClick={() => setProofUrl(order.payment_proof_url)}><ImageIcon className="h-3.5 w-3.5" /> Ver</Button>
                            : <span className="text-xs text-muted-foreground">Sin comprobante</span>}
                        </TableCell>
                        <TableCell>
                          {order.status === 'pending' ? (
                            <div className="flex gap-2">
                              <Button size="sm" variant="success" disabled={processing === order.id} onClick={() => updateStatus(order.id, 'approved', order.ticket_type_id)}>
                                {processing === order.id
                                  ? <div className="h-3 w-3 border border-white/30 border-t-white rounded-full animate-spin" />
                                  : <><CheckCircle className="h-3.5 w-3.5" /> Aprobar</>}
                              </Button>
                              <Button size="sm" variant="destructive" disabled={processing === order.id} onClick={() => updateStatus(order.id, 'rejected', order.ticket_type_id)}>
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <Badge variant={order.status} className="gap-1">
                              {statusIcon(order.status)} {getStatusLabel(order.status)}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Proof Dialog */}
      <Dialog open={!!proofUrl} onOpenChange={() => setProofUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comprobante de Pago</DialogTitle>
          </DialogHeader>
          {proofUrl && <img src={proofUrl} alt="Comprobante" className="w-full rounded-lg max-h-[70vh] object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
