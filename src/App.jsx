import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Events from './pages/Events'
import EventCreate from './pages/EventCreate'
import EventDetail from './pages/EventDetail'
import OrderVerification from './pages/OrderVerification'
import BuyTicket from './pages/BuyTicket'
import Settings from './pages/Settings'
import './index.css'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="btn-spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return !user ? children : <Navigate to="/dashboard" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

      {/* Public ticket purchase page */}
      <Route path="/evento/:eventId/comprar" element={<BuyTicket />} />

      {/* Protected routes */}
      <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/eventos" element={<Events />} />
        <Route path="/eventos/crear" element={<EventCreate />} />
        <Route path="/eventos/:id" element={<EventDetail />} />
        <Route path="/ordenes" element={<OrderVerification />} />
        <Route path="/configuracion" element={<Settings />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--color-bg-elevated)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.88rem',
            },
            success: { iconTheme: { primary: 'var(--color-success)', secondary: 'var(--color-bg-card)' } },
            error:   { iconTheme: { primary: 'var(--color-danger)',  secondary: 'var(--color-bg-card)' } },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  )
}
