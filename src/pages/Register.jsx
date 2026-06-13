import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Ticket, Mail, Lock, User, Building2, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export default function Register() {
  const [form, setForm] = useState({ fullName: '', orgName: '', email: '', password: '', confirmPassword: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    if (form.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setLoading(true)
    const { error } = await signUp(form.email, form.password, form.fullName, form.orgName)
    setLoading(false)
    if (error) {
      toast.error(error.message || 'Error al registrarse')
    } else {
      toast.success('¡Cuenta creada! Revisa tu correo para confirmar.')
      navigate('/login')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg-orb auth-bg-orb-1" />
      <div className="auth-bg-orb auth-bg-orb-2" />

      <div className="auth-card animate-slide-up">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <Ticket size={28} color="white" />
          </div>
          <h1 className="auth-title">Crear cuenta</h1>
          <p className="auth-subtitle">Empieza a gestionar tus eventos hoy</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Tu nombre</label>
              <div className="form-input-group">
                <User className="form-input-prefix" size={16} />
                <input type="text" className="form-input" placeholder="Juan Pérez" value={form.fullName} onChange={set('fullName')} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Organización</label>
              <div className="form-input-group">
                <Building2 className="form-input-prefix" size={16} />
                <input type="text" className="form-input" placeholder="Mi empresa" value={form.orgName} onChange={set('orgName')} required />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Correo electrónico</label>
            <div className="form-input-group">
              <Mail className="form-input-prefix" size={16} />
              <input type="email" className="form-input" placeholder="tu@correo.com" value={form.email} onChange={set('email')} required autoComplete="email" />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <div className="form-input-group">
                <Lock className="form-input-prefix" size={16} />
                <input
                  type={showPass ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Min. 6 caracteres"
                  value={form.password}
                  onChange={set('password')}
                  required
                  style={{ paddingRight: 44 }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Confirmar</label>
              <div className="form-input-group">
                <Lock className="form-input-prefix" size={16} />
                <input type="password" className="form-input" placeholder="Repite la contraseña" value={form.confirmPassword} onChange={set('confirmPassword')} required />
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? <div className="btn-spinner" /> : <><ArrowRight size={16} /> Crear cuenta</>}
          </button>
        </form>

        <div className="divider-text mt-6">o</div>
        <p className="text-center text-sm text-muted">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" style={{ color: 'var(--color-primary-light)', fontWeight: 600 }}>Inicia sesión</Link>
        </p>
      </div>
    </div>
  )
}
