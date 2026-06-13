import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Calendar, MapPin, FileText, Tag, Image, Smartphone, Building, CreditCard } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

const BANKS = [
  'Banco de Venezuela', 'Banesco', 'Mercantil', 'BBVA Provincial',
  'Bicentenario', 'BNC', 'Banco Exterior', 'Banplus', 'Sofitasa', 'Otro'
]

const CURRENCIES = ['USD', 'VES', 'USDT']

export default function EventCreate() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(0) // 0=info, 1=tickets, 2=payment

  const [event, setEvent] = useState({
    name: '', description: '', date: '', location: '', banner_url: '',
    payment_phone: '', payment_bank: '', payment_ci: '',
  })

  const [ticketTypes, setTicketTypes] = useState([
    { name: 'General', price: '', quantity: '', currency: 'USD' }
  ])

  const setField = (f) => (e) => setEvent(ev => ({ ...ev, [f]: e.target.value }))

  const addTicketType = () => {
    setTicketTypes(tt => [...tt, { name: '', price: '', quantity: '', currency: 'USD' }])
  }

  const removeTicketType = (i) => {
    if (ticketTypes.length === 1) return
    setTicketTypes(tt => tt.filter((_, idx) => idx !== i))
  }

  const setTicket = (i, f) => (e) => {
    setTicketTypes(tt => tt.map((t, idx) => idx === i ? { ...t, [f]: e.target.value } : t))
  }

  const validate = () => {
    if (!event.name) { toast.error('El nombre del evento es obligatorio'); return false }
    if (!event.date)  { toast.error('La fecha es obligatoria'); return false }
    if (ticketTypes.some(t => !t.name || !t.price || !t.quantity)) {
      toast.error('Completa todos los campos de los tipos de ticket')
      return false
    }
    if (!event.payment_phone || !event.payment_bank || !event.payment_ci) {
      toast.error('Los datos de Pago Móvil son obligatorios')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)

    // Create event
    const { data: createdEvent, error: eventErr } = await supabase
      .from('events')
      .insert({ ...event, organizer_id: user.id })
      .select()
      .single()

    if (eventErr) {
      toast.error('Error al crear el evento')
      setLoading(false)
      return
    }

    // Create ticket types
    const ttInsert = ticketTypes.map(t => ({
      event_id: createdEvent.id,
      name: t.name,
      price: parseFloat(t.price),
      quantity: parseInt(t.quantity),
      currency: t.currency,
      sold: 0,
    }))

    const { error: ttErr } = await supabase.from('ticket_types').insert(ttInsert)
    if (ttErr) {
      toast.error('Error al crear los tipos de ticket')
      setLoading(false)
      return
    }

    toast.success('¡Evento creado exitosamente!')
    navigate(`/eventos/${createdEvent.id}`)
  }

  const steps = ['Información', 'Tickets', 'Pago Móvil']

  return (
    <div className="page-wrapper animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Crear Evento</h1>
        <p className="page-subtitle">Configura tu evento en 3 pasos</p>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32, maxWidth: 600 }}>
        {steps.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setStep(i)}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              background: i === step ? 'var(--gradient-primary)' : i < step ? 'var(--color-success-bg)' : 'var(--color-bg-elevated)',
              border: i === step ? 'none' : `1px solid ${i < step ? 'rgba(16,185,129,0.3)' : 'var(--color-border)'}`,
              color: i === step ? 'white' : i < step ? 'var(--color-success)' : 'var(--color-text-muted)',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ maxWidth: 700 }}>

          {/* STEP 0: Event info */}
          {step === 0 && (
            <div className="card animate-fade-in">
              <h2 style={{ fontWeight: 700, marginBottom: 24 }}>Información del Evento</h2>

              <div className="form-group">
                <label className="form-label"><FileText size={13} style={{ display: 'inline', marginRight: 6 }} />Nombre del evento *</label>
                <input type="text" className="form-input" placeholder="Festival de Música 2026" value={event.name} onChange={setField('name')} required />
              </div>

              <div className="form-group">
                <label className="form-label">Descripción</label>
                <textarea className="form-textarea" placeholder="Describe tu evento..." value={event.description} onChange={setField('description')} rows={4} />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label"><Calendar size={13} style={{ display: 'inline', marginRight: 6 }} />Fecha y hora *</label>
                  <input type="datetime-local" className="form-input" value={event.date} onChange={setField('date')} required />
                </div>
                <div className="form-group">
                  <label className="form-label"><MapPin size={13} style={{ display: 'inline', marginRight: 6 }} />Lugar</label>
                  <input type="text" className="form-input" placeholder="Teatro Municipal, Caracas" value={event.location} onChange={setField('location')} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label"><Image size={13} style={{ display: 'inline', marginRight: 6 }} />URL del banner (imagen)</label>
                <input type="url" className="form-input" placeholder="https://..." value={event.banner_url} onChange={setField('banner_url')} />
                <p className="form-hint">Usa un link de imagen (Imgur, Cloudinary, etc.) o déjalo vacío</p>
              </div>

              <div className="flex justify-between mt-6">
                <span />
                <button type="button" className="btn btn-primary" onClick={() => setStep(1)}>
                  Siguiente: Tickets →
                </button>
              </div>
            </div>
          )}

          {/* STEP 1: Ticket types */}
          {step === 1 && (
            <div className="card animate-fade-in">
              <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Tipos de Ticket</h2>
              <p className="text-muted text-sm mb-6">Define los diferentes tipos de entrada para tu evento</p>

              {ticketTypes.map((tt, i) => (
                <div key={i} style={{
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-5)',
                  marginBottom: 'var(--space-4)',
                  position: 'relative',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h4 style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-primary-light)' }}>
                      Tipo #{i + 1}
                    </h4>
                    {ticketTypes.length > 1 && (
                      <button type="button" onClick={() => removeTicketType(i)} className="btn btn-danger btn-icon btn-sm">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label"><Tag size={12} style={{ display: 'inline', marginRight: 6 }} />Nombre *</label>
                      <input type="text" className="form-input" placeholder="VIP, General, Estudiante..." value={tt.name} onChange={setTicket(i, 'name')} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Moneda</label>
                      <select className="form-select" value={tt.currency} onChange={setTicket(i, 'currency')}>
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Precio *</label>
                      <div className="form-input-group">
                        <span className="form-input-prefix">{tt.currency === 'USD' ? '$' : tt.currency === 'VES' ? 'Bs.' : '₮'}</span>
                        <input type="number" className="form-input" placeholder="0.00" min="0" step="0.01" value={tt.price} onChange={setTicket(i, 'price')} required />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Cantidad disponible *</label>
                      <input type="number" className="form-input" placeholder="100" min="1" value={tt.quantity} onChange={setTicket(i, 'quantity')} required />
                    </div>
                  </div>
                </div>
              ))}

              <button type="button" onClick={addTicketType} className="btn btn-secondary" style={{ width: '100%', marginBottom: 24 }}>
                <Plus size={15} /> Agregar otro tipo de ticket
              </button>

              <div className="flex justify-between">
                <button type="button" className="btn btn-ghost" onClick={() => setStep(0)}>← Anterior</button>
                <button type="button" className="btn btn-primary" onClick={() => setStep(2)}>Siguiente: Pago Móvil →</button>
              </div>
            </div>
          )}

          {/* STEP 2: Payment data */}
          {step === 2 && (
            <div className="card animate-fade-in">
              <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Datos de Pago Móvil</h2>
              <p className="text-muted text-sm mb-6">
                Los compradores verán esta información para realizar la transferencia
              </p>

              <div className="payment-box mb-6">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, color: 'var(--color-accent)' }}>
                  <Smartphone size={18} />
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Información para los compradores</span>
                </div>
                <p className="text-sm text-muted">
                  Cuando alguien compre un ticket, verá estos datos para hacer el Pago Móvil y luego podrá subir el comprobante.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label"><Smartphone size={13} style={{ display: 'inline', marginRight: 6 }} />Teléfono de Pago Móvil *</label>
                <input type="tel" className="form-input" placeholder="0412-1234567" value={event.payment_phone} onChange={setField('payment_phone')} required />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label"><Building size={13} style={{ display: 'inline', marginRight: 6 }} />Banco *</label>
                  <select className="form-select" value={event.payment_bank} onChange={setField('payment_bank')} required>
                    <option value="">Selecciona un banco</option>
                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label"><CreditCard size={13} style={{ display: 'inline', marginRight: 6 }} />Cédula / RIF *</label>
                  <input type="text" className="form-input" placeholder="V-12345678" value={event.payment_ci} onChange={setField('payment_ci')} required />
                </div>
              </div>

              {/* Summary */}
              <div className="card" style={{ background: 'var(--color-bg-secondary)', marginTop: 24, marginBottom: 24 }}>
                <h4 style={{ fontWeight: 700, marginBottom: 12, fontSize: '0.9rem' }}>Resumen del evento</h4>
                <div className="payment-data-row">
                  <span className="payment-data-label">Evento</span>
                  <span className="payment-data-value" style={{ fontFamily: 'inherit' }}>{event.name || '—'}</span>
                </div>
                <div className="payment-data-row">
                  <span className="payment-data-label">Tipos de ticket</span>
                  <span className="payment-data-value" style={{ fontFamily: 'inherit' }}>{ticketTypes.length}</span>
                </div>
                <div className="payment-data-row">
                  <span className="payment-data-label">Capacidad total</span>
                  <span className="payment-data-value" style={{ fontFamily: 'inherit' }}>
                    {ticketTypes.reduce((s, t) => s + parseInt(t.quantity || 0), 0)} tickets
                  </span>
                </div>
              </div>

              <div className="flex justify-between">
                <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>← Anterior</button>
                <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                  {loading ? <><div className="btn-spinner" /> Creando...</> : '🚀 Crear Evento'}
                </button>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
