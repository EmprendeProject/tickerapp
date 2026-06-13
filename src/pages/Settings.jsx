import { useState, useEffect } from 'react'
import { User, Building2, Phone, Smartphone, CreditCard, Bell, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export default function Settings() {
  const { user, profile, fetchProfile } = useAuth()
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    org_name: '',
    phone: '',
    payment_phone: '',
    payment_bank: '',
    payment_ci: '',
    email_notifications: true,
  })

  useEffect(() => {
    if (profile) {
      setForm(f => ({
        ...f,
        full_name: profile.full_name || '',
        org_name: profile.org_name || '',
        phone: profile.phone || '',
        payment_phone: profile.payment_phone || '',
        payment_bank: profile.payment_bank || '',
        payment_ci: profile.payment_ci || '',
        email_notifications: profile.email_notifications ?? true,
      }))
    }
  }, [profile])

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('organizer_profiles')
      .upsert({ id: user.id, ...form }, { onConflict: 'id' })

    if (error) {
      toast.error('Error al guardar los cambios')
    } else {
      toast.success('✅ Perfil actualizado')
      fetchProfile(user.id)
    }
    setSaving(false)
  }

  const BANKS = [
    'Banco de Venezuela', 'Banesco', 'Mercantil', 'BBVA Provincial',
    'Bicentenario', 'BNC', 'Banco Exterior', 'Banplus', 'Sofitasa', 'Otro'
  ]

  return (
    <div className="page-wrapper animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Configuración</h1>
        <p className="page-subtitle">Gestiona tu perfil y preferencias</p>
      </div>

      <div style={{ maxWidth: 700 }}>

        {/* Profile */}
        <div className="settings-section mb-6">
          <div className="settings-section-header">
            <User size={14} style={{ display: 'inline', marginRight: 8 }} />
            Información personal
          </div>
          <div className="settings-section-body">
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Nombre completo</label>
                <input type="text" className="form-input" value={form.full_name} onChange={set('full_name')} placeholder="Juan Pérez" />
              </div>
              <div className="form-group">
                <label className="form-label">Organización</label>
                <input type="text" className="form-input" value={form.org_name} onChange={set('org_name')} placeholder="Mi Empresa" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Correo electrónico</label>
              <input type="email" className="form-input" value={user?.email || ''} disabled style={{ opacity: 0.6 }} />
              <p className="form-hint">El correo no puede modificarse desde aquí</p>
            </div>
            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input type="tel" className="form-input" value={form.phone} onChange={set('phone')} placeholder="0412-1234567" />
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="settings-section mb-6">
          <div className="settings-section-header">
            <Smartphone size={14} style={{ display: 'inline', marginRight: 8 }} />
            Datos de Pago Móvil (por defecto)
          </div>
          <div className="settings-section-body">
            <p className="text-muted text-sm mb-6">
              Estos datos se pre-rellenarán automáticamente al crear nuevos eventos
            </p>
            <div className="form-group">
              <label className="form-label">Teléfono de Pago Móvil</label>
              <input type="tel" className="form-input" value={form.payment_phone} onChange={set('payment_phone')} placeholder="0412-1234567" />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Banco</label>
                <select className="form-select" value={form.payment_bank} onChange={set('payment_bank')}>
                  <option value="">Selecciona un banco</option>
                  {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cédula / RIF</label>
                <input type="text" className="form-input" value={form.payment_ci} onChange={set('payment_ci')} placeholder="V-12345678" />
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="settings-section mb-8">
          <div className="settings-section-header">
            <Bell size={14} style={{ display: 'inline', marginRight: 8 }} />
            Notificaciones
          </div>
          <div className="settings-section-body">
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.email_notifications}
                onChange={e => setForm(f => ({ ...f, email_notifications: e.target.checked }))}
                style={{ width: 18, height: 18, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Notificaciones por email</div>
                <div className="text-muted text-sm">Recibe un email cuando llegue un nuevo pago para revisar</div>
              </div>
            </label>
          </div>
        </div>

        <button onClick={handleSave} className="btn btn-primary btn-lg" disabled={saving}>
          {saving ? <><div className="btn-spinner" /> Guardando...</> : <><Save size={16} /> Guardar cambios</>}
        </button>

        {/* Account info */}
        <div className="card mt-8" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
          <h4 style={{ fontWeight: 700, color: 'var(--color-danger)', marginBottom: 8 }}>Zona de peligro</h4>
          <p className="text-muted text-sm mb-4">Estas acciones son irreversibles. Procede con precaución.</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-danger btn-sm" onClick={() => toast.error('Contacta soporte para eliminar tu cuenta')}>
              Eliminar cuenta
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
