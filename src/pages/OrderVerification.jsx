import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, AlertCircle, Eye, Image } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, getStatusLabel, formatDate } from '../lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'

export default function OrderVerification() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [processing, setProcessing] = useState(null)
  const [showProof, setShowProof] = useState(null)

  useEffect(() => { loadOrders() }, [user, statusFilter])

  const loadOrders = async () => {
    if (!user) return
    setLoading(true)

    const { data: events } = await supabase
      .from('events')
      .select('id')
      .eq('organizer_id', user.id)

    const eventIds = events?.map(e => e.id) || []
    if (eventIds.length === 0) { setOrders([]); setLoading(false); return }

    const query = supabase
      .from('orders')
      .select(`*, events(name, date), ticket_types(name, price, currency)`)
      .in('event_id', eventIds)
      .order('created_at', { ascending: false })

    if (statusFilter !== 'all') {
      query.eq('status', statusFilter)
    }

    const { data } = await query
    setOrders(data || [])
    setLoading(false)
  }

  const updateStatus = async (orderId, status, ticketTypeId) => {
    setProcessing(orderId)
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId)

    if (!error && status === 'approved') {
      // Increment sold count
      await supabase.rpc('increment_sold', { ticket_type_id: ticketTypeId })
      // In production: trigger email via Supabase Edge Function
    }

    if (error) {
      toast.error('Error al actualizar el estado')
    } else {
      toast.success(status === 'approved' ? '✅ Pago aprobado — el comprador recibirá su QR' : '❌ Pago rechazado')
      loadOrders()
      setSelectedOrder(null)
    }
    setProcessing(null)
  }

  const statusCounts = {
    pending: orders.filter(o => o.status === 'pending').length,
    approved: orders.filter(o => o.status === 'approved').length,
    rejected: orders.filter(o => o.status === 'rejected').length,
  }

  const filters = [
    { key: 'pending',  label: '⏳ Pendientes' },
    { key: 'approved', label: '✅ Aprobados' },
    { key: 'rejected', label: '❌ Rechazados' },
    { key: 'all',      label: 'Todos' },
  ]

  return (
    <div className="page-wrapper animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Verificar Pagos</h1>
        <p className="page-subtitle">Revisa y aprueba los comprobantes de Pago Móvil</p>
      </div>

      {/* Quick stats */}
      <div className="grid-3 mb-8">
        <div className="metric-card" style={{ borderColor: 'rgba(245,158,11,0.3)' }}>
          <div className="metric-value" style={{ color: 'var(--color-warning)' }}>{statusCounts.pending}</div>
          <div className="metric-label">Pendientes de revisión</div>
        </div>
        <div className="metric-card" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
          <div className="metric-value" style={{ color: 'var(--color-success)' }}>{statusCounts.approved}</div>
          <div className="metric-label">Aprobados</div>
        </div>
        <div className="metric-card" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
          <div className="metric-value" style={{ color: 'var(--color-danger)' }}>{statusCounts.rejected}</div>
          <div className="metric-label">Rechazados</div>
        </div>
      </div>

      {/* Filters */}
      <div className="tabs mb-0">
        {filters.map(f => (
          <button key={f.key} className={`tab-btn${statusFilter === f.key ? ' active' : ''}`} onClick={() => setStatusFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Orders list */}
      <div className="card mt-0" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div className="btn-spinner" style={{ width: 36, height: 36, borderWidth: 3, margin: '0 auto' }} />
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <CheckCircle className="empty-state-icon" color="var(--color-success)" />
            <p className="empty-state-title">Sin órdenes {statusFilter !== 'all' ? getStatusLabel(statusFilter).toLowerCase() + 's' : ''}</p>
            <p className="empty-state-desc">
              {statusFilter === 'pending' ? '¡Estás al día! No hay pagos pendientes de revisar.' : 'No hay órdenes en esta categoría.'}
            </p>
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
                  <th>Fecha</th>
                  <th>Comprobante</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{order.buyer_name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{order.buyer_email}</div>
                      {order.buyer_phone && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-subtle)' }}>{order.buyer_phone}</div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{order.events?.name}</div>
                      <div style={{ fontSize: '0.77rem', color: 'var(--color-text-muted)' }}>
                        {order.events?.date && format(new Date(order.events.date), 'dd/MM/yyyy', { locale: es })}
                      </div>
                    </td>
                    <td>{order.ticket_types?.name}</td>
                    <td style={{ fontWeight: 700, color: 'var(--color-success)' }}>
                      {formatCurrency(order.total_amount, order.ticket_types?.currency)}
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                      {format(new Date(order.created_at), 'dd/MM/yy HH:mm')}
                    </td>
                    <td>
                      {order.payment_proof_url ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setShowProof(order.payment_proof_url)}
                        >
                          <Image size={13} /> Ver
                        </button>
                      ) : <span className="text-subtle text-xs">Sin comprobante</span>}
                    </td>
                    <td>
                      {order.status === 'pending' ? (
                        <div className="flex gap-2">
                          <button
                            className="btn btn-success btn-sm"
                            disabled={processing === order.id}
                            onClick={() => updateStatus(order.id, 'approved', order.ticket_type_id)}
                          >
                            {processing === order.id ? <div className="btn-spinner" style={{ borderTopColor: 'var(--color-success)' }} /> : <CheckCircle size={13} />}
                            Aprobar
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            disabled={processing === order.id}
                            onClick={() => updateStatus(order.id, 'rejected', order.ticket_type_id)}
                          >
                            <XCircle size={13} />
                          </button>
                        </div>
                      ) : (
                        <span className={`badge badge-${order.status}`}>
                          {order.status === 'approved' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                          {getStatusLabel(order.status)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Proof image modal */}
      {showProof && (
        <div className="modal-overlay" onClick={() => setShowProof(null)}>
          <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Comprobante de Pago</h3>
              <button className="modal-close" onClick={() => setShowProof(null)}>✕</button>
            </div>
            <img
              src={showProof}
              alt="Comprobante"
              style={{ width: '100%', borderRadius: 'var(--radius-md)', maxHeight: '70vh', objectFit: 'contain' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
