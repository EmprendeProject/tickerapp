import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/cn'
import toast from 'react-hot-toast'

const BANKS = ['Banco de Venezuela', 'Banesco', 'Mercantil', 'BBVA Provincial', 'Bicentenario', 'BNC', 'Banco Exterior', 'Banplus', 'Sofitasa', 'Otro']
const CURRENCIES = ['USD', 'VES', 'USDT']

const STEPS = ['Información', 'Tickets', 'Pago Móvil']

export default function EventCreate() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(0)

  const [event, setEvent] = useState({
    name: '', description: '', date: '', location: '', banner_url: '',
    payment_phone: '', payment_bank: '', payment_ci: '',
  })

  const [ticketTypes, setTicketTypes] = useState([
    { name: 'General', price: '', quantity: '', currency: 'USD' }
  ])

  const setField = f => e => setEvent(ev => ({ ...ev, [f]: e.target.value }))
  const setSelectField = f => v => setEvent(ev => ({ ...ev, [f]: v }))

  const addTicket = () => setTicketTypes(tt => [...tt, { name: '', price: '', quantity: '', currency: 'USD' }])
  const removeTicket = i => { if (ticketTypes.length > 1) setTicketTypes(tt => tt.filter((_, idx) => idx !== i)) }
  const setTicket = (i, f) => v => setTicketTypes(tt => tt.map((t, idx) => idx === i ? { ...t, [f]: v } : t))
  const setTicketInput = (i, f) => e => setTicketTypes(tt => tt.map((t, idx) => idx === i ? { ...t, [f]: e.target.value } : t))

  const validate = () => {
    if (!event.name)   { toast.error('El nombre del evento es obligatorio'); return false }
    if (!event.date)   { toast.error('La fecha es obligatoria'); return false }
    if (ticketTypes.some(t => !t.name || !t.price || !t.quantity)) { toast.error('Completa todos los campos de los tickets'); return false }
    if (!event.payment_phone || !event.payment_bank || !event.payment_ci) { toast.error('Los datos de Pago Móvil son obligatorios'); return false }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    const { data: createdEvent, error: eventErr } = await supabase.from('events').insert({ ...event, organizer_id: user.id }).select().single()
    if (eventErr) { toast.error('Error al crear el evento'); setLoading(false); return }
    const ttInsert = ticketTypes.map(t => ({ event_id: createdEvent.id, name: t.name, price: parseFloat(t.price), quantity: parseInt(t.quantity), currency: t.currency, sold: 0 }))
    const { error: ttErr } = await supabase.from('ticket_types').insert(ttInsert)
    if (ttErr) { toast.error('Error al crear los tipos de ticket'); setLoading(false); return }
    toast.success('¡Evento creado exitosamente!')
    navigate(`/eventos/${createdEvent.id}`)
  }

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Crear Evento</h1>
        <p className="text-sm text-muted-foreground">Configura tu evento en {STEPS.length} pasos</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 max-w-lg">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <button
              type="button"
              onClick={() => i < step + 1 && setStep(i)}
              className={cn(
                "flex items-center gap-2 text-sm font-medium transition-colors",
                i === step ? "text-foreground" : i < step ? "text-muted-foreground" : "text-muted-foreground/50"
              )}
            >
              <span className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                i === step ? "border-foreground bg-foreground text-background" : i < step ? "border-muted-foreground bg-muted-foreground/20 text-muted-foreground" : "border-border"
              )}>
                {i + 1}
              </span>
              {s}
            </button>
            {i < STEPS.length - 1 && <div className={cn("flex-1 h-px", i < step ? "bg-muted-foreground" : "bg-border")} />}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="max-w-2xl space-y-6">

          {/* STEP 0 */}
          {step === 0 && (
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle>Información del Evento</CardTitle>
                <CardDescription>Los detalles principales que verán los asistentes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ev-name">Nombre del evento *</Label>
                  <Input id="ev-name" placeholder="Festival de Música 2026" value={event.name} onChange={setField('name')} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ev-desc">Descripción</Label>
                  <Textarea id="ev-desc" placeholder="Describe tu evento..." value={event.description} onChange={setField('description')} rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ev-date">Fecha y hora *</Label>
                    <Input id="ev-date" type="datetime-local" value={event.date} onChange={setField('date')} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ev-location">Lugar</Label>
                    <Input id="ev-location" placeholder="Teatro Municipal, Caracas" value={event.location} onChange={setField('location')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ev-banner">URL del banner (opcional)</Label>
                  <Input id="ev-banner" type="url" placeholder="https://..." value={event.banner_url} onChange={setField('banner_url')} />
                  <p className="text-xs text-muted-foreground">Usa un link de imagen pública (Imgur, etc.)</p>
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="button" onClick={() => setStep(1)}>Siguiente: Tickets →</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <Card>
                <CardHeader>
                  <CardTitle>Tipos de Ticket</CardTitle>
                  <CardDescription>Define los diferentes tipos de entrada para tu evento</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {ticketTypes.map((tt, i) => (
                    <div key={i} className="p-4 rounded-lg border bg-muted/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">Tipo #{i + 1}</Badge>
                        {ticketTypes.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeTicket(i)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Nombre *</Label>
                          <Input placeholder="VIP, General, Estudiante..." value={tt.name} onChange={setTicketInput(i, 'name')} required />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Moneda</Label>
                          <Select value={tt.currency} onValueChange={setTicket(i, 'currency')}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Precio *</Label>
                          <Input type="number" placeholder="0.00" min="0" step="0.01" value={tt.price} onChange={setTicketInput(i, 'price')} required />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Cantidad *</Label>
                          <Input type="number" placeholder="100" min="1" value={tt.quantity} onChange={setTicketInput(i, 'quantity')} required />
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" className="w-full" onClick={addTicket}>
                    <Plus className="h-4 w-4" /> Agregar otro tipo de ticket
                  </Button>
                </CardContent>
              </Card>
              <div className="flex justify-between">
                <Button type="button" variant="ghost" onClick={() => setStep(0)}>← Anterior</Button>
                <Button type="button" onClick={() => setStep(2)}>Siguiente: Pago Móvil →</Button>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <Card>
                <CardHeader>
                  <CardTitle>Datos de Pago Móvil</CardTitle>
                  <CardDescription>Los compradores verán esta información para realizar la transferencia</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-lg border bg-muted/30 text-sm text-muted-foreground">
                    📱 Cuando alguien compre un ticket, verá estos datos para hacer el Pago Móvil y podrá subir el comprobante.
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pay-phone">Teléfono de Pago Móvil *</Label>
                    <Input id="pay-phone" type="tel" placeholder="0412-1234567" value={event.payment_phone} onChange={setField('payment_phone')} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Banco *</Label>
                      <Select value={event.payment_bank} onValueChange={setSelectField('payment_bank')} required>
                        <SelectTrigger><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
                        <SelectContent>
                          {BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pay-ci">Cédula / RIF *</Label>
                      <Input id="pay-ci" placeholder="V-12345678" value={event.payment_ci} onChange={setField('payment_ci')} required />
                    </div>
                  </div>

                  <Separator />

                  {/* Summary */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Resumen</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Evento:</span>
                      <span className="font-medium">{event.name || '—'}</span>
                      <span className="text-muted-foreground">Tipos de ticket:</span>
                      <span className="font-medium">{ticketTypes.length}</span>
                      <span className="text-muted-foreground">Capacidad:</span>
                      <span className="font-medium">{ticketTypes.reduce((s, t) => s + parseInt(t.quantity || 0), 0)} tickets</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button type="button" variant="ghost" onClick={() => setStep(1)}>← Anterior</Button>
                <Button type="submit" size="lg" disabled={loading}>
                  {loading
                    ? <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    : '🚀 Crear Evento'
                  }
                </Button>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
