import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Ticket, Calendar, MapPin, Upload, Download, CreditCard, Plus, Minus } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { supabase } from '@/lib/supabase'
import { formatCurrency, generateQRToken, buildQRUrl, formatEventDate } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { buildOrganizerNotificationEmail } from '@/lib/emailTemplates'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function BuyTicket() {
  const { eventId } = useParams()
  const [event, setEvent] = useState(null)
  const [ticketTypes, setTicketTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [bcvRate, setBcvRate] = useState(null)
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [orders, setOrders] = useState([])          // array of created orders
  const ticketsRef = useRef(null)

  const [cart, setCart] = useState({})
  const [organizerEmail, setOrganizerEmail] = useState('')
  
  const [discountCodeText, setDiscountCodeText] = useState('')
  const [appliedDiscount, setAppliedDiscount] = useState(null)
  const [applyingDiscount, setApplyingDiscount] = useState(false)

  const [form, setForm] = useState({ buyer_name: '', buyer_email: '', buyer_phone: '' })
  const [proofFile, setProofFile] = useState(null)
  const [proofPreview, setProofPreview] = useState(null)

  useEffect(() => { 
    loadEvent()
    fetch('https://ve.dolarapi.com/v1/dolares/oficial')
      .then(res => res.json())
      .then(data => { if (data?.promedio) setBcvRate(data.promedio) })
      .catch(err => console.error('Error fetching BCV rate:', err))
  }, [eventId])

  const loadEvent = async () => {
    setLoading(true)
    const { data: ev } = await supabase.from('events').select('*').eq('id', eventId).single()
    const { data: tt } = await supabase.from('ticket_types').select('*').eq('event_id', eventId)
    setEvent(ev)
    setTicketTypes(tt || [])
    
    if (ev) {
      const { data: profile } = await supabase
        .from('organizer_profiles')
        .select('email')
        .eq('id', ev.organizer_id)
        .single()
      if (profile?.email) {
        setOrganizerEmail(profile.email)
      }
    }

    // init cart with 0 for each type
    const initialCart = {}
    ;(tt || []).forEach(t => { initialCart[t.id] = 0 })
    setCart(initialCart)
    setLoading(false)
  }

  const setField = f => e => setForm(v => ({ ...v, [f]: e.target.value }))

  const changeQty = (typeId, delta) => {
    const tt = ticketTypes.find(t => t.id === typeId)
    if (!tt) return
    const available = tt.quantity - (tt.sold || 0)
    setCart(c => {
      const next = (c[typeId] || 0) + delta
      if (next < 0) return c
      if (next > available) { toast.error(`Solo hay ${available} entradas disponibles de "${tt.name}"`); return c }
      if (next > 10) { toast.error('Máximo 10 por tipo en una sola compra'); return c }
      return { ...c, [typeId]: next }
    })
  }

  const cartItems = ticketTypes.filter(tt => (cart[tt.id] || 0) > 0).map(tt => ({
    ...tt, qty: cart[tt.id], subtotal: cart[tt.id] * tt.price
  }))

  const totalTickets = cartItems.reduce((s, i) => s + i.qty, 0)
  const baseTotalAmount = cartItems.reduce((s, i) => s + i.subtotal, 0)
  const discountAmount = appliedDiscount ? baseTotalAmount * (appliedDiscount.percentage / 100) : 0
  const totalAmount  = baseTotalAmount - discountAmount
  const currency     = cartItems[0]?.currency || 'USD'

  const handleApplyDiscount = async () => {
    if (!discountCodeText.trim()) return
    setApplyingDiscount(true)
    const { data, error } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('event_id', eventId)
      .eq('code', discountCodeText.toUpperCase().trim())
      .eq('active', true)
      .single()
    
    if (error || !data) {
      toast.error('Código inválido o expirado')
      setAppliedDiscount(null)
    } else {
      setAppliedDiscount(data)
      toast.success(`¡Descuento del ${data.percentage}% aplicado!`)
    }
    setApplyingDiscount(false)
  }

  const handleFileChange = e => {
    const file = e.target.files[0]
    if (!file) return
    setProofFile(file)
    setProofPreview(URL.createObjectURL(file))
  }

  const handleSubmitOrder = async () => {
    if (!form.buyer_name || !form.buyer_email) { toast.error('Nombre y correo son obligatorios'); return }
    if (!proofFile) { toast.error('Debes subir el comprobante de pago'); return }
    setSubmitting(true)
    try {
      // Upload proof
      const ext = proofFile.name.split('.').pop()
      const fileName = `proof-${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('payment-proofs').upload(fileName, proofFile)
      if (uploadErr) throw new Error('Error al subir el comprobante')
      const { data: { publicUrl } } = supabase.storage.from('payment-proofs').getPublicUrl(fileName)

      // Create one order per ticket purchased (each with its own QR)
      const createdOrders = []
      for (const item of cartItems) {
        for (let i = 0; i < item.qty; i++) {
          const qrToken = generateQRToken()
          const discountedPrice = appliedDiscount ? item.price * (1 - appliedDiscount.percentage / 100) : item.price
          const newOrderData = {
            event_id: eventId,
            ticket_type_id: item.id,
            buyer_name: form.buyer_name,
            buyer_email: form.buyer_email,
            buyer_phone: form.buyer_phone,
            quantity: 1,
            total_amount: discountedPrice,
            status: 'pending',
            payment_proof_url: publicUrl,
            qr_code: qrToken,
            discount_code: appliedDiscount?.code || null,
          }

          const { error: orderErr } = await supabase.from('orders').insert(newOrderData)
          
          if (orderErr) {
            console.error('Insert Error:', orderErr)
            throw new Error(`Error al registrar la orden: ${orderErr.message}`)
          }
          
          createdOrders.push({ 
            ...newOrderData, 
            id: 'temp-' + qrToken,
            created_at: new Date().toISOString(),
            ticket_type: item 
          })
        }
      }
      setOrders(createdOrders)
      setStep(3)
      toast.success(`¡${totalTickets} entrada${totalTickets > 1 ? 's' : ''} registrada${totalTickets > 1 ? 's' : ''}! Pendiente de aprobación.`)

      // Enviar notificación al organizador por correo electrónico (no bloqueante)
      if (organizerEmail) {
        try {
          const emailHtml = buildOrganizerNotificationEmail({
            event: event,
            buyerName: form.buyer_name,
            totalTickets: totalTickets,
            totalAmount: totalAmount,
            currency: currency
          })
          
          await supabase.functions.invoke('send-ticket-email', {
            body: {
              email: organizerEmail,
              subject: `🎫 Nueva compra registrada - ${event.name}`,
              html: emailHtml,
              text: `Hola, tienes una nueva compra de ${totalTickets} entradas para el evento ${event.name} por un monto de ${totalAmount} ${currency}. Ingresa al dashboard para verificar el pago.`
            }
          })
        } catch (emailErr) {
          console.error('Error al enviar correo de notificación al organizador:', emailErr)
        }
      }
    } catch (err) {
      toast.error(err.message || 'Error al procesar la compra')
    } finally {
      setSubmitting(false)
    }
  }

  const downloadAllTickets = async () => {
    if (!ticketsRef.current) return
    const canvas = await html2canvas(ticketsRef.current, { scale: 2, backgroundColor: '#09090b' })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pdfW = pdf.internal.pageSize.getWidth()
    const pdfH = (canvas.height * pdfW) / canvas.width
    pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH)
    pdf.save(`entradas-${event?.name?.replace(/\s+/g,'-') || eventId}.pdf`)
  }

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="h-10 w-10 border-2 border-border border-t-foreground rounded-full animate-spin" />
    </div>
  )
  if (!event) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-sm w-full text-center p-8">
        <div className="text-4xl mb-4">🎫</div>
        <h2 className="font-bold text-lg">Evento no encontrado</h2>
      </Card>
    </div>
  )

  const STEPS = ['Entradas', 'Tus datos', 'Pago']

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            <span className="font-bold tracking-tight">TicketShow</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="hidden sm:inline-flex">Compra segura</Badge>
            <ThemeToggle className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Event info */}
        <Card>
          <CardContent className="p-6">
            <div className="flex gap-4">
              {event.banner_url && (
                <img src={event.banner_url} alt={event.name} className="w-20 h-20 rounded-lg object-cover shrink-0" />
              )}
              <div>
                <h1 className="text-xl font-bold mb-2">{event.name}</h1>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 mt-4"><Calendar className="h-5 w-5 text-muted-foreground" />{formatEventDate(event.date, event.end_date)}</div>
                  {event.location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" /> {event.location}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Progress */}
        {step < 3 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              {STEPS.map((s, i) => (
                <span key={i} className={i === step ? 'text-foreground font-semibold' : 'text-muted-foreground'}>{s}</span>
              ))}
            </div>
            <Progress value={(step / 2) * 100} className="h-1" />
          </div>
        )}

        {/* ═══ STEP 0: Select quantities ═══ */}
        {step === 0 && (
          <div className="space-y-4 animate-fade-in">
            <Card>
              <CardHeader>
                <CardTitle>Selecciona tus entradas</CardTitle>
                <CardDescription>Puedes combinar distintos tipos en una sola compra</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {ticketTypes.map(tt => {
                  const available = tt.quantity - (tt.sold || 0)
                  const isSoldOut = available <= 0
                  const qty = cart[tt.id] || 0

                  return (
                    <div
                      key={tt.id}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                        isSoldOut ? 'opacity-50 bg-muted/30' : qty > 0 ? 'border-foreground/40 bg-muted/30' : 'hover:bg-muted/20'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="font-semibold">{tt.name}</div>
                        {isSoldOut && (
                          <div className="text-xs text-destructive font-medium mt-0.5">
                            🚫 Agotado
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end sm:items-center">
                          <span className="font-bold text-green-500 text-lg leading-none">
                            {formatCurrency(tt.price, tt.currency)}
                          </span>
                          {tt.currency === 'USD' && bcvRate && (
                            <span className="text-xs text-muted-foreground mt-1">
                              ~ {formatCurrency(tt.price * bcvRate, 'VES')}
                            </span>
                          )}
                        </div>
                        {!isSoldOut && (
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              onClick={() => changeQty(tt.id, -1)}
                              disabled={qty === 0}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="w-6 text-center font-bold tabular-nums">{qty}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              onClick={() => changeQty(tt.id, +1)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Cart summary */}
            {cartItems.length > 0 && (
              <Card className="border-foreground/20 animate-fade-in">
                <CardContent className="p-4 space-y-2">
                  <p className="text-sm font-semibold mb-3">Resumen</p>
                  {cartItems.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.qty}× {item.name}</span>
                      <span className={appliedDiscount ? "line-through text-muted-foreground opacity-60" : "font-medium"}>
                        {formatCurrency(item.subtotal, item.currency)}
                      </span>
                    </div>
                  ))}

                  <div className="pt-2 pb-1">
                    {appliedDiscount ? (
                      <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 text-green-600 px-3 py-2 rounded-md text-sm">
                        <span>Código <b className="font-mono">{appliedDiscount.code}</b> (-{appliedDiscount.percentage}%)</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-green-500/20 text-green-700 rounded-full" onClick={() => setAppliedDiscount(null)}>
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Código de descuento (Opcional)" 
                          className="h-9 text-sm" 
                          value={discountCodeText} 
                          onChange={e => setDiscountCodeText(e.target.value.toUpperCase())} 
                        />
                        <Button size="sm" className="h-9" variant="secondary" onClick={handleApplyDiscount} disabled={applyingDiscount || !discountCodeText.trim()}>
                          Aplicar
                        </Button>
                      </div>
                    )}
                  </div>

                  <Separator className="my-2" />
                  
                  {appliedDiscount && (
                    <div className="flex justify-between text-sm text-green-500 mb-2 font-medium">
                      <span>Descuento aplicado</span>
                      <span>-{formatCurrency(discountAmount, currency)}</span>
                    </div>
                  )}

                  <div className="flex justify-between font-bold items-end">
                    <span>{totalTickets} entrada{totalTickets !== 1 ? 's' : ''}</span>
                    <div className="text-right">
                      <div className="text-green-500 text-lg leading-none">{formatCurrency(totalAmount, currency)}</div>
                      {currency === 'USD' && bcvRate && (
                        <div className="text-xs text-muted-foreground font-normal mt-1">
                          ~ {formatCurrency(totalAmount * bcvRate, 'VES')}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button className="w-full mt-3" onClick={() => setStep(1)}>
                    Continuar →
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ═══ STEP 1: Buyer info ═══ */}
        {step === 1 && (
          <Card className="animate-fade-in">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Tus datos</CardTitle>
                  <CardDescription>Para enviarte tus entradas</CardDescription>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <div className="font-bold text-green-500">{formatCurrency(totalAmount, currency)}</div>
                  {currency === 'USD' && bcvRate && (
                    <div className="text-xs text-muted-foreground font-normal">
                      ~ {formatCurrency(totalAmount * bcvRate, 'VES')}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">{totalTickets} entrada{totalTickets !== 1 ? 's' : ''}</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bname">Nombre completo *</Label>
                <Input id="bname" placeholder="Juan Pérez" value={form.buyer_name} onChange={setField('buyer_name')} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bemail">Correo electrónico *</Label>
                <Input id="bemail" type="email" placeholder="juan@ejemplo.com" value={form.buyer_email} onChange={setField('buyer_email')} required />
                <p className="text-xs text-muted-foreground">Recibirás tus {totalTickets} entrada{totalTickets !== 1 ? 's' : ''} aquí al ser aprobado el pago</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bphone">Teléfono (opcional)</Label>
                <Input id="bphone" type="tel" placeholder="0412-1234567" value={form.buyer_phone} onChange={setField('buyer_phone')} />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(0)}>← Volver</Button>
                <Button type="button" className="flex-1" onClick={() => {
                  if (!form.buyer_name || !form.buyer_email) { toast.error('Nombre y correo son obligatorios'); return }
                  setStep(2)
                }}>
                  Continuar al pago →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══ STEP 2: Payment ═══ */}
        {step === 2 && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle>Realiza el Pago Móvil</CardTitle>
              <CardDescription>Transfiere el monto exacto y sube el comprobante</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Amount */}
              <div className="text-center p-4 rounded-lg bg-muted/50 border space-y-2">
                <div className="text-xs text-muted-foreground">Monto total a pagar</div>
                <div>
                  <div className="text-3xl font-bold text-green-500 leading-none">{formatCurrency(totalAmount, currency)}</div>
                  {currency === 'USD' && bcvRate && (
                    <div className="mt-4 p-3 bg-muted rounded-lg border">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Debes pagar:</div>
                      <div className="text-2xl font-bold text-foreground">
                        {formatCurrency(totalAmount * bcvRate, 'VES')}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 opacity-80">
                        Tasa BCV: {formatCurrency(bcvRate, 'VES')}
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground pt-1">
                  {cartItems.map(i => `${i.qty}× ${i.name}`).join(' · ')}
                </div>
              </div>

              {/* Bank data */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <CreditCard className="h-4 w-4" />
                  Datos de Pago Móvil
                </div>
                {[
                  ['Teléfono', event.payment_phone],
                  ['Banco',    event.payment_bank],
                  ['Cédula / RIF', event.payment_ci],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{value}</span>
                      <button
                        type="button"
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        onClick={() => { navigator.clipboard.writeText(value); toast.success(`${label} copiado`) }}
                      >
                        Copiar
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Upload */}
              <div className="space-y-2">
                <Label>Sube el comprobante de pago *</Label>
                {proofPreview ? (
                  <div className="text-center space-y-2">
                    <img src={proofPreview} alt="comprobante" className="max-h-48 rounded-lg mx-auto border" />
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setProofFile(null); setProofPreview(null) }}>
                      Cambiar imagen
                    </Button>
                  </div>
                ) : (
                  <label className="block cursor-pointer">
                    <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-foreground/40 transition-colors">
                      <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Toca para subir el comprobante</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">PNG, JPG o PDF · Máx. 5MB</p>
                    </div>
                    <input type="file" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" />
                  </label>
                )}
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>← Volver</Button>
                <Button type="button" className="flex-1" disabled={submitting || !proofFile} onClick={handleSubmitOrder}>
                  {submitting
                    ? <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    : `✅ Confirmar ${totalTickets} entrada${totalTickets !== 1 ? 's' : ''}`
                  }
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══ STEP 3: Success — one QR per ticket ═══ */}
        {step === 3 && orders.length > 0 && (
          <div className="space-y-4 animate-fade-in">
            <Card className="border-green-500/30">
              <CardContent className="pt-6 text-center space-y-2">
                <div className="text-4xl">🎉</div>
                <h2 className="text-xl font-bold text-green-500">
                  ¡{orders.length} entrada{orders.length !== 1 ? 's' : ''} registrada{orders.length !== 1 ? 's' : ''}!
                </h2>
                <p className="text-sm text-muted-foreground">
                  Tu pago está siendo revisado. Recibirás tus entradas en <strong>{form.buyer_email}</strong> cuando sea aprobado.
                </p>
              </CardContent>
            </Card>

            {/* All tickets */}
            <div ref={ticketsRef} className="space-y-3">
              {orders.map((order, idx) => (
                <Card key={order.id} className="overflow-hidden">
                  <div className="bg-foreground text-background px-6 py-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold">{event.name}</h3>
                      <p className="text-sm opacity-70">{order.ticket_type?.name}</p>
                    </div>
                    <Badge className="bg-background/20 text-background border-background/30">
                      #{idx + 1} de {orders.length}
                    </Badge>
                  </div>
                  <CardContent className="p-5 flex gap-5 items-center">
                    <div className="flex-1 space-y-2">
                      {[
                        ['Comprador', form.buyer_name],
                        ['Fecha', format(new Date(event.date), 'dd/MM/yyyy, HH:mm')],
                        ...(event.location ? [['Lugar', event.location]] : []),
                        ['Precio', formatCurrency(order.ticket_type?.price, order.ticket_type?.currency)],
                      ].map(([l, v]) => (
                        <div key={l}>
                          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{l}</div>
                          <div className="text-sm font-semibold">{v}</div>
                        </div>
                      ))}
                    </div>
                    <div className="text-center shrink-0 space-y-2">
                      <div className="bg-white inline-flex p-2 rounded-lg">
                        <QRCodeSVG value={buildQRUrl(order.qr_code)} size={100} bgColor="#ffffff" fgColor="#000000" level="M" />
                      </div>
                      <p className="font-mono text-[9px] text-muted-foreground">{order.qr_code}</p>
                      <Badge variant="warning" className="text-[9px]">⚠️ Pendiente de aprobación</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={downloadAllTickets}>
                <Download className="h-4 w-4" /> Descargar PDF ({orders.length} entrada{orders.length !== 1 ? 's' : ''})
              </Button>
              <Button variant="ghost" onClick={() => {
                setStep(0)
                setOrders([])
                setForm({ buyer_name: '', buyer_email: '', buyer_phone: '' })
                setProofFile(null)
                setProofPreview(null)
                const resetCart = {}
                ticketTypes.forEach(t => { resetCart[t.id] = 0 })
                setCart(resetCart)
              }}>
                Nueva compra
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
