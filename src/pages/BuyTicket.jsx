import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Ticket, Calendar, MapPin, Upload, Download, CreditCard } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { supabase } from '@/lib/supabase'
import { formatCurrency, generateQRToken } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import logo from '@/assets/logo.png'

export default function BuyTicket() {
  const { eventId } = useParams()
  const [event, setEvent] = useState(null)
  const [ticketTypes, setTicketTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(0)
  const [selectedType, setSelectedType] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [order, setOrder] = useState(null)
  const ticketRef = useRef(null)

  const [form, setForm] = useState({ buyer_name: '', buyer_email: '', buyer_phone: '' })
  const [proofFile, setProofFile] = useState(null)
  const [proofPreview, setProofPreview] = useState(null)

  useEffect(() => { loadEvent() }, [eventId])

  const loadEvent = async () => {
    setLoading(true)
    const { data: ev } = await supabase.from('events').select('*').eq('id', eventId).single()
    const { data: tt } = await supabase.from('ticket_types').select('*').eq('event_id', eventId)
    setEvent(ev); setTicketTypes(tt || [])
    setLoading(false)
  }

  const setField = f => e => setForm(v => ({ ...v, [f]: e.target.value }))

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
      const ext = proofFile.name.split('.').pop()
      const fileName = `proof-${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('payment-proofs').upload(fileName, proofFile)
      if (uploadErr) throw new Error('Error al subir el comprobante')
      const { data: { publicUrl } } = supabase.storage.from('payment-proofs').getPublicUrl(fileName)
      const qrToken = generateQRToken()
      const { data: newOrder, error: orderErr } = await supabase.from('orders').insert({
        event_id: eventId, ticket_type_id: selectedType.id,
        buyer_name: form.buyer_name, buyer_email: form.buyer_email, buyer_phone: form.buyer_phone,
        quantity: 1, total_amount: selectedType.price,
        status: 'pending', payment_proof_url: publicUrl, qr_code: qrToken,
      }).select().single()
      if (orderErr) throw new Error('Error al registrar la orden')
      setOrder({ ...newOrder, event, ticket_types: selectedType })
      setStep(3)
      toast.success('¡Compra registrada! El organizador revisará tu pago.')
    } catch (err) {
      toast.error(err.message || 'Error al procesar la compra')
    } finally {
      setSubmitting(false)
    }
  }

  const downloadTicket = async () => {
    if (!ticketRef.current) return
    const canvas = await html2canvas(ticketRef.current, { scale: 2, backgroundColor: '#09090b' })
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [100, 150] })
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 100, 150)
    pdf.save(`entrada-${order?.qr_code || 'ticket'}.pdf`)
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

  const STEPS = ['Seleccionar', 'Tus datos', 'Pago', 'Confirmación']

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logo} alt="TickerApp" className="h-5 w-auto object-contain" />
            <span className="font-bold">TickerApp</span>
          </div>
          <Badge variant="outline">Compra segura</Badge>
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
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(event.date), "EEEE dd 'de' MMMM yyyy, HH:mm", { locale: es })}
                  </div>
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

        {/* Progress bar */}
        {step < 3 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              {STEPS.slice(0,3).map((s, i) => (
                <span key={i} className={i === step ? 'text-foreground font-medium' : ''}>{s}</span>
              ))}
            </div>
            <Progress value={((step) / 2) * 100} className="h-1" />
          </div>
        )}

        {/* STEP 0: Select */}
        {step === 0 && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle>Selecciona tu entrada</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ticketTypes.map(tt => {
                const available = tt.quantity - (tt.sold || 0)
                const isSoldOut = available <= 0
                return (
                  <button
                    key={tt.id}
                    type="button"
                    disabled={isSoldOut}
                    onClick={() => { setSelectedType(tt); setStep(1) }}
                    className={`w-full flex items-center justify-between p-4 rounded-lg border text-left transition-colors ${
                      isSoldOut ? 'opacity-50 cursor-not-allowed bg-muted/30' : 'hover:border-foreground/40 hover:bg-muted/50 cursor-pointer'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{tt.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {isSoldOut ? '🚫 Agotado' : `${available} disponibles`}
                      </div>
                    </div>
                    <div className="text-xl font-bold text-green-500">
                      {formatCurrency(tt.price, tt.currency)}
                    </div>
                  </button>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* STEP 1: Buyer info */}
        {step === 1 && selectedType && (
          <Card className="animate-fade-in">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Tus datos</CardTitle>
                  <CardDescription>Para enviarte tu entrada</CardDescription>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-500 text-xl">{formatCurrency(selectedType.price, selectedType.currency)}</div>
                  <div className="text-xs text-muted-foreground">{selectedType.name}</div>
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
                <p className="text-xs text-muted-foreground">Tu entrada se enviará aquí al ser aprobado el pago</p>
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

        {/* STEP 2: Payment */}
        {step === 2 && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle>Realiza el Pago Móvil</CardTitle>
              <CardDescription>Transfiere el monto exacto y sube el comprobante</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Amount */}
              <div className="text-center p-4 rounded-lg bg-muted/50 border">
                <div className="text-xs text-muted-foreground mb-1">Monto a pagar</div>
                <div className="text-3xl font-bold text-green-500">{formatCurrency(selectedType.price, selectedType.currency)}</div>
              </div>

              {/* Bank data */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold mb-3">
                  <CreditCard className="h-4 w-4" />
                  Datos de Pago Móvil
                </div>
                {[
                  ['Teléfono', event.payment_phone],
                  ['Banco', event.payment_bank],
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
                <Label>Comprobante de pago *</Label>
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
                    : '✅ Confirmar compra'
                  }
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 3: Success */}
        {step === 3 && order && (
          <div className="space-y-4 animate-fade-in">
            <Card className="border-green-500/30">
              <CardContent className="pt-6 text-center">
                <div className="text-4xl mb-3">🎉</div>
                <h2 className="text-xl font-bold text-green-500 mb-2">¡Compra registrada!</h2>
                <p className="text-sm text-muted-foreground">
                  Tu pago está siendo revisado. Recibirás tu entrada en <strong>{form.buyer_email}</strong> cuando sea aprobado.
                </p>
              </CardContent>
            </Card>

            {/* Ticket */}
            <div ref={ticketRef}>
              <Card className="overflow-hidden">
                <div className="bg-foreground text-background p-6 text-center">
                  <h3 className="text-xl font-bold">{event.name}</h3>
                  <p className="text-sm opacity-70 mt-1">{selectedType?.name}</p>
                </div>

                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      ['Comprador', order.buyer_name],
                      ['Fecha', format(new Date(event.date), 'dd/MM/yyyy')],
                      ['Hora', format(new Date(event.date), 'HH:mm')],
                      ['Precio', formatCurrency(selectedType?.price, selectedType?.currency)],
                      ...(event.location ? [['Lugar', event.location]] : []),
                    ].map(([l, v]) => (
                      <div key={l}>
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">{l}</div>
                        <div className="font-semibold text-sm mt-0.5">{v}</div>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="text-center space-y-3">
                    <Badge variant="warning">⚠️ Válido solo si el pago es aprobado</Badge>
                    <div className="bg-white inline-flex p-3 rounded-lg">
                      <QRCodeSVG value={order.qr_code} size={140} bgColor="#ffffff" fgColor="#000000" level="M" />
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">{order.qr_code}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={downloadTicket}>
                <Download className="h-4 w-4" /> Descargar PDF
              </Button>
              <Button variant="ghost" onClick={() => { setStep(0); setOrder(null); setForm({ buyer_name:'', buyer_email:'', buyer_phone:'' }); setProofFile(null); setProofPreview(null) }}>
                Comprar otro
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
