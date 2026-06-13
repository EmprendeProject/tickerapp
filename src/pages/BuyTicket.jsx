import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Ticket, Calendar, MapPin, User, Mail, Phone, CreditCard, Upload, CheckCircle, Download } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { formatCurrency, generateQRToken } from '../lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export default function BuyTicket() {
  const { eventId } = useParams()
  const [event, setEvent] = useState(null)
  const [ticketTypes, setTicketTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(0) // 0=select, 1=form, 2=payment, 3=done
  const [selectedType, setSelectedType] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [order, setOrder] = useState(null)
  const ticketRef = useRef(null)

  const [form, setForm] = useState({ buyer_name: '', buyer_email: '', buyer_phone: '' })
  const [proofFile, setProofFile] = useState(null)
  const [proofPreview, setProofPreview] = useState(null)

  useEffect(() => { loadEvent() }, [eventId])

  const loadEvent = async () => {
    setLoading(true)
    const { data: ev } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single()

    const { data: tt } = await supabase
      .from('ticket_types')
      .select('*')
      .eq('event_id', eventId)

    setEvent(ev)
    setTicketTypes(tt || [])
    setLoading(false)
  }

  const setField = (f) => (e) => setForm(v => ({ ...v, [f]: e.target.value }))

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setProofFile(file)
    setProofPreview(URL.createObjectURL(file))
  }

  const handleSubmitOrder = async () => {
    if (!form.buyer_name || !form.buyer_email) {
      toast.error('Nombre y correo son obligatorios')
      return
    }
    if (!proofFile) {
      toast.error('Debes subir el comprobante de pago')
      return
    }

    setSubmitting(true)
    try {
      // Upload proof
      const ext = proofFile.name.split('.').pop()
      const fileName = `proof-${Date.now()}.${ext}`
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, proofFile)

      if (uploadErr) throw new Error('Error al subir el comprobante')

      const { data: { publicUrl } } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(fileName)

      const qrToken = generateQRToken()
      const total = selectedType.price * 1

      // Create order
      const { data: newOrder, error: orderErr } = await supabase
        .from('orders')
        .insert({
          event_id: eventId,
          ticket_type_id: selectedType.id,
          buyer_name: form.buyer_name,
          buyer_email: form.buyer_email,
          buyer_phone: form.buyer_phone,
          quantity: 1,
          total_amount: total,
          status: 'pending',
          payment_proof_url: publicUrl,
          qr_code: qrToken,
        })
        .select()
        .single()

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
    const canvas = await html2canvas(ticketRef.current, { scale: 2, backgroundColor: '#111827' })
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [100, 150] })
    const imgData = canvas.toDataURL('image/png')
    pdf.addImage(imgData, 'PNG', 0, 0, 100, 150)
    pdf.save(`entrada-${order?.qr_code || 'ticket'}.pdf`)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="btn-spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
    </div>
  )

  if (!event) return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card text-center" style={{ maxWidth: 400 }}>
        <p style={{ fontSize: '2rem' }}>🎫</p>
        <h2 style={{ fontWeight: 700 }}>Evento no encontrado</h2>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gradient-hero)', padding: '40px 16px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* Event header */}
        <div className="card mb-6" style={{
          background: event.banner_url
            ? `linear-gradient(rgba(8,12,24,0.75), rgba(8,12,24,0.97)), url(${event.banner_url}) center/cover`
            : 'var(--color-bg-card)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🎪</div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 8 }}>{event.name}</h1>
          <div className="flex items-center justify-center gap-4" style={{ flexWrap: 'wrap' }}>
            <div className="event-meta-item" style={{ justifyContent: 'center' }}>
              <Calendar size={14} />
              {format(new Date(event.date), "EEEE dd 'de' MMMM yyyy", { locale: es })}
            </div>
            {event.location && (
              <div className="event-meta-item" style={{ justifyContent: 'center' }}>
                <MapPin size={14} /> {event.location}
              </div>
            )}
          </div>
          {event.description && (
            <p style={{ marginTop: 12, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{event.description}</p>
          )}
        </div>

        {/* Branded logo */}
        <div className="text-center mb-4" style={{ color: 'var(--color-text-subtle)', fontSize: '0.78rem' }}>
          Powered by <span style={{ color: 'var(--color-primary-light)', fontWeight: 600 }}>TickerApp</span>
        </div>

        {/* STEP 0: Select ticket */}
        {step === 0 && (
          <div className="card animate-slide-up">
            <h2 style={{ fontWeight: 700, marginBottom: 20, fontSize: '1.2rem' }}>Selecciona tu entrada</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {ticketTypes.map(tt => {
                const available = tt.quantity - (tt.sold || 0)
                const isSoldOut = available <= 0
                return (
                  <button
                    key={tt.id}
                    type="button"
                    disabled={isSoldOut}
                    onClick={() => { setSelectedType(tt); setStep(1) }}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px 20px',
                      borderRadius: 'var(--radius-lg)',
                      background: selectedType?.id === tt.id ? 'rgba(124,58,237,0.15)' : 'var(--color-bg-secondary)',
                      border: `1px solid ${selectedType?.id === tt.id ? 'rgba(124,58,237,0.5)' : 'var(--color-border)'}`,
                      cursor: isSoldOut ? 'not-allowed' : 'pointer',
                      opacity: isSoldOut ? 0.5 : 1,
                      transition: 'all var(--transition-fast)',
                      textAlign: 'left',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)' }}>{tt.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {isSoldOut ? '🚫 Agotado' : `${available} disponibles`}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '1.3rem', color: isSoldOut ? 'var(--color-text-subtle)' : 'var(--color-success)' }}>
                      {formatCurrency(tt.price, tt.currency)}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* STEP 1: Buyer info */}
        {step === 1 && selectedType && (
          <div className="card animate-slide-up">
            <button type="button" onClick={() => setStep(0)} style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: 20, background: 'none', border: 'none', cursor: 'pointer' }}>
              ← Cambiar tipo
            </button>

            <div className="payment-box mb-6">
              <div className="flex items-center justify-between">
                <span style={{ fontWeight: 700 }}>{selectedType.name}</span>
                <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--color-success)' }}>
                  {formatCurrency(selectedType.price, selectedType.currency)}
                </span>
              </div>
            </div>

            <h2 style={{ fontWeight: 700, marginBottom: 20, fontSize: '1.1rem' }}>Tus datos</h2>

            <div className="form-group">
              <label className="form-label"><User size={12} style={{ display: 'inline', marginRight: 6 }} />Nombre completo *</label>
              <input type="text" className="form-input" placeholder="Juan Pérez" value={form.buyer_name} onChange={setField('buyer_name')} required />
            </div>

            <div className="form-group">
              <label className="form-label"><Mail size={12} style={{ display: 'inline', marginRight: 6 }} />Correo electrónico *</label>
              <input type="email" className="form-input" placeholder="juan@ejemplo.com" value={form.buyer_email} onChange={setField('buyer_email')} required />
              <p className="form-hint">Tu entrada digital se enviará aquí cuando el pago sea aprobado</p>
            </div>

            <div className="form-group">
              <label className="form-label"><Phone size={12} style={{ display: 'inline', marginRight: 6 }} />Teléfono (opcional)</label>
              <input type="tel" className="form-input" placeholder="0412-1234567" value={form.buyer_phone} onChange={setField('buyer_phone')} />
            </div>

            <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={() => {
              if (!form.buyer_name || !form.buyer_email) { toast.error('Nombre y correo son obligatorios'); return }
              setStep(2)
            }}>
              Continuar al pago →
            </button>
          </div>
        )}

        {/* STEP 2: Payment */}
        {step === 2 && (
          <div className="card animate-slide-up">
            <button type="button" onClick={() => setStep(1)} style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: 20, background: 'none', border: 'none', cursor: 'pointer' }}>
              ← Volver
            </button>

            <h2 style={{ fontWeight: 700, marginBottom: 8, fontSize: '1.1rem' }}>Realiza el Pago Móvil</h2>
            <p className="text-muted text-sm mb-6">Transfiere el monto exacto a los datos indicados y sube el comprobante</p>

            <div className="payment-amount mb-4">
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Monto a pagar</div>
              <div className="payment-amount-value">{formatCurrency(selectedType.price, selectedType.currency)}</div>
            </div>

            <div className="payment-box mb-6">
              <div style={{ color: 'var(--color-accent)', fontWeight: 700, fontSize: '0.9rem', marginBottom: 12 }}>
                📱 Datos de Pago Móvil
              </div>
              {[
                ['Teléfono', event.payment_phone],
                ['Banco', event.payment_bank],
                ['Cédula / RIF', event.payment_ci],
              ].map(([label, value]) => (
                <div key={label} className="payment-data-row">
                  <span className="payment-data-label">{label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="payment-data-value">{value}</span>
                    <button
                      type="button"
                      className="copy-btn"
                      onClick={() => { navigator.clipboard.writeText(value); toast.success(`${label} copiado`) }}
                    >
                      <CreditCard size={12} /> Copiar
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Upload proof */}
            <div className="form-group">
              <label className="form-label"><Upload size={12} style={{ display: 'inline', marginRight: 6 }} />Comprobante de pago *</label>

              {proofPreview ? (
                <div style={{ textAlign: 'center' }}>
                  <img src={proofPreview} alt="comprobante" style={{ maxHeight: 200, borderRadius: 'var(--radius-md)', marginBottom: 12 }} />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setProofFile(null); setProofPreview(null) }}>
                    Cambiar imagen
                  </button>
                </div>
              ) : (
                <label style={{ display: 'block', cursor: 'pointer' }}>
                  <div className="dropzone">
                    <Upload className="dropzone-icon" />
                    <p className="dropzone-text">Toca para subir el comprobante</p>
                    <p className="dropzone-hint">PNG, JPG o PDF · Máx. 5MB</p>
                  </div>
                  <input type="file" accept="image/*,.pdf" onChange={handleFileChange} style={{ display: 'none' }} />
                </label>
              )}
            </div>

            <button
              type="button"
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              disabled={submitting || !proofFile}
              onClick={handleSubmitOrder}
            >
              {submitting ? <><div className="btn-spinner" /> Enviando...</> : '✅ Confirmar compra'}
            </button>
          </div>
        )}

        {/* STEP 3: Success */}
        {step === 3 && order && (
          <div className="animate-slide-up">
            <div className="card text-center mb-6" style={{ borderColor: 'rgba(16,185,129,0.4)' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎉</div>
              <h2 style={{ fontWeight: 800, color: 'var(--color-success)', marginBottom: 8 }}>¡Compra registrada!</h2>
              <p className="text-muted">Tu pago está siendo revisado. Cuando sea aprobado recibirás tu entrada por correo en <strong>{form.buyer_email}</strong></p>
            </div>

            {/* Ticket preview */}
            <div ref={ticketRef}>
              <div className="ticket-card mb-6">
                <div className="ticket-header">
                  <h3 className="ticket-title">{event.name}</h3>
                  <p className="ticket-subtitle">{selectedType?.name}</p>
                </div>

                <div className="ticket-body">
                  <div className="ticket-info-grid">
                    <div className="ticket-info-item">
                      <div className="ticket-info-label">Comprador</div>
                      <div className="ticket-info-value">{order.buyer_name}</div>
                    </div>
                    <div className="ticket-info-item">
                      <div className="ticket-info-label">Fecha</div>
                      <div className="ticket-info-value">{format(new Date(event.date), 'dd/MM/yyyy')}</div>
                    </div>
                    <div className="ticket-info-item">
                      <div className="ticket-info-label">Hora</div>
                      <div className="ticket-info-value">{format(new Date(event.date), 'HH:mm')}</div>
                    </div>
                    <div className="ticket-info-item">
                      <div className="ticket-info-label">Precio</div>
                      <div className="ticket-info-value" style={{ color: 'var(--color-success)' }}>
                        {formatCurrency(selectedType?.price, selectedType?.currency)}
                      </div>
                    </div>
                    {event.location && (
                      <div className="ticket-info-item" style={{ gridColumn: '1/-1' }}>
                        <div className="ticket-info-label">Lugar</div>
                        <div className="ticket-info-value">{event.location}</div>
                      </div>
                    )}
                  </div>

                  <div className="ticket-qr-section">
                    <div className="ticket-qr-wrapper">
                      <QRCodeSVG
                        value={order.qr_code}
                        size={140}
                        bgColor="#ffffff"
                        fgColor="#000000"
                        level="M"
                      />
                    </div>
                    <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                      ⚠️ Válido solo si el pago es aprobado
                    </p>
                    <div className="ticket-qr-code">{order.qr_code}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <button onClick={downloadTicket} className="btn btn-secondary">
                <Download size={15} /> Descargar PDF
              </button>
              <button onClick={() => { setStep(0); setOrder(null); setForm({ buyer_name: '', buyer_email: '', buyer_phone: '' }); setProofFile(null); setProofPreview(null) }} className="btn btn-ghost">
                Comprar otro ticket
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
