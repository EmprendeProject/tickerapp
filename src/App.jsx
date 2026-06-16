import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
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
import Scanner from './pages/Scanner'
import './index.css'

// Theme handled by ThemeProvider

function Spinner() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="h-10 w-10 border-2 border-border border-t-foreground rounded-full animate-spin" />
    </div>
  )
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner />
  return user ? children : <Navigate to="/login" state={{ from: location }} replace />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  return !user ? children : <Navigate to="/dashboard" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

      {/* Public ticket purchase page */}
      <Route path="/evento/:eventId/comprar" element={<BuyTicket />} />

      {/* Protected routes */}
      <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route path="/dashboard"     element={<Dashboard />} />
        <Route path="/eventos"       element={<Events />} />
        <Route path="/eventos/crear" element={<EventCreate />} />
        <Route path="/eventos/:id"   element={<EventDetail />} />
        <Route path="/ordenes"       element={<OrderVerification />} />
        <Route path="/scanner"       element={<Scanner />} />
        <Route path="/configuracion" element={<Settings />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'hsl(var(--background))',
              color: 'hsl(var(--foreground))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: '0.875rem',
            },
            success: { iconTheme: { primary: '#22c55e', secondary: 'hsl(var(--background))' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: 'hsl(var(--background))' } },
          }}
        />
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  )
}
