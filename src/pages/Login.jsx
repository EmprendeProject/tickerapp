import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Ticket, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      toast.error('Credenciales incorrectas. Verifica tu correo y contraseña.')
    } else {
      toast.success('¡Bienvenido de vuelta!')
      navigate('/dashboard')
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
          <h1 className="auth-title">Bienvenido a TickerApp</h1>
          <p className="auth-subtitle">Gestiona tus eventos y tickets fácilmente</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Correo electrónico</label>
            <div className="form-input-group">
              <Mail className="form-input-prefix" size={16} />
              <input
                type="email"
                className="form-input"
                placeholder="tu@correo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <div className="form-input-group">
              <Lock className="form-input-prefix" size={16} />
              <input
                type={showPass ? 'text' : 'password'}
                className="form-input"
                placeholder="Tu contraseña"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? <div className="btn-spinner" /> : (
              <><ArrowRight size={16} /> Iniciar Sesión</>
            )}
          </button>
        </form>

        <div className="divider-text mt-6">o</div>

        <p className="text-center text-sm text-muted">
          ¿No tienes cuenta?{' '}
          <Link to="/register" style={{ color: 'var(--color-primary-light)', fontWeight: 600 }}>
            Regístrate gratis
          </Link>
        </p>
      </div>
    </div>
  )
}
