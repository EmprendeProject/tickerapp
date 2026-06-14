// Base URL for the app — reads from env or falls back to the Vercel domain
const APP_BASE_URL = import.meta.env.VITE_APP_URL || 'https://tickerapp.vercel.app'

export const generateQRToken = () => {
  // Generate a unique token for the ticket QR
  const randomPart = Math.random().toString(36).substring(2, 11).toUpperCase()
  return `TKR-${Date.now()}-${randomPart}`
}

export const buildQRUrl = (token) => `${APP_BASE_URL}/scanner?qr=${token}`

export const formatCurrency = (amount, currency = 'USD') => {
  if (currency === 'USD') {
    return `$${parseFloat(amount).toFixed(2)}`
  }
  if (currency === 'VES') {
    return `Bs. ${parseFloat(amount).toLocaleString('es-VE')}`
  }
  return `${currency} ${parseFloat(amount).toFixed(2)}`
}

export const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('es-VE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const getStatusLabel = (status) => {
  const labels = {
    pending: 'Pendiente',
    approved: 'Aprobado',
    rejected: 'Rechazado',
  }
  return labels[status] || status
}

export const getStatusColor = (status) => {
  const colors = {
    pending: 'var(--color-warning)',
    approved: 'var(--color-success)',
    rejected: 'var(--color-danger)',
  }
  return colors[status] || 'var(--color-text-muted)'
}
