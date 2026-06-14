import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '@/lib/supabase'
import { CheckCircle, XCircle, AlertCircle, Camera, ScanLine, RotateCcw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'

const SCANNER_ID = 'qr-reader'

// Extract TKR token from either a full URL or a bare token
function extractToken(text) {
  try {
    const url = new URL(text)
    const qr = url.searchParams.get('qr')
    if (qr) return qr
  } catch {}
  if (text.startsWith('TKR-')) return text
  return null
}

export default function Scanner() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [scannerState, setScannerState] = useState('idle') // idle | scanning | loading | result
  const [result, setResult]   = useState(null)  // { ok, reason, order }
  const [history, setHistory] = useState([])    // list of recent scans
  const scannerRef = useRef(null)

  // Start camera
  const startScanner = () => {
    setScannerState('scanning')
    setResult(null)
  }

  // Stop camera
  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch {}
      scannerRef.current = null
    }
  }

  // Handle a detected QR code
  const onScanSuccess = async (decodedText) => {
    const token = extractToken(decodedText)
    if (!token) return // ignore non-TicketShow QRs

    await stopScanner()
    setScannerState('loading')

    // Fetch order info
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, events(name, date, location), ticket_types(name)')
      .eq('qr_code', token)
      .single()

    if (error || !order) {
      setResult({ ok: false, reason: 'not_found', token })
      setScannerState('result')
      return
    }

    if (order.status !== 'approved') {
      setResult({ ok: false, reason: 'not_approved', order })
      setScannerState('result')
      return
    }

    if (order.used_at) {
      setResult({ ok: false, reason: 'already_used', order })
      setScannerState('result')
      return
    }

    setResult({ ok: true, order })
    setScannerState('result')
  }

  // Auto-process QR from URL if present
  useEffect(() => {
    const qrParam = searchParams.get('qr')
    if (qrParam) {
      searchParams.delete('qr')
      setSearchParams(searchParams, { replace: true })
      onScanSuccess(qrParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Initialize scanner when state becomes 'scanning'
  useEffect(() => {
    if (scannerState !== 'scanning') return

    const html5QrCode = new Html5Qrcode(SCANNER_ID)
    scannerRef.current = html5QrCode

    html5QrCode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      onScanSuccess,
      () => {} // ignore errors while scanning
    ).catch(() => {
      toast.error('No se pudo acceder a la cámara. Verifica los permisos.')
      setScannerState('idle')
    })

    return () => {
      html5QrCode.stop().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerState])

  // Mark ticket as used
  const handleMarkUsed = async () => {
    if (!result?.order) return
    setScannerState('loading')

    const { data, error } = await supabase.rpc('mark_ticket_used', {
      p_qr_code: result.order.qr_code
    })

    if (error || !data?.ok) {
      toast.error('Error al marcar la entrada. Intenta de nuevo.')
      setResult(prev => ({ ...prev }))
      setScannerState('result')
      return
    }

    const successResult = { ...result, confirmed: true }
    setResult(successResult)
    setScannerState('result')
    setHistory(prev => [{ ...result.order, confirmed_at: new Date() }, ...prev].slice(0, 10))
    toast.success('✅ Entrada marcada como usada')
  }

  const handleScanAnother = () => {
    setResult(null)
    startScanner()
  }

  // ─── UI helpers ────────────────────────────────────────────────────────────

  const ResultCard = () => {
    if (!result) return null

    const { ok, reason, order, confirmed } = result

    if (confirmed) return (
      <div className="flex flex-col items-center gap-4 py-6 animate-fade-in">
        <div className="h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle className="h-10 w-10 text-green-500" />
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-green-500">¡Entrada Válida!</p>
          <p className="text-sm text-muted-foreground mt-1">{order.buyer_name}</p>
          <p className="text-xs text-muted-foreground">{order.events?.name} · {order.ticket_types?.name}</p>
        </div>
        <Button onClick={handleScanAnother} className="w-full mt-2">
          <ScanLine className="h-4 w-4 mr-2" /> Escanear otra entrada
        </Button>
      </div>
    )

    if (!ok && reason === 'not_found') return (
      <div className="flex flex-col items-center gap-4 py-6 animate-fade-in">
        <div className="h-20 w-20 rounded-full bg-red-500/10 flex items-center justify-center">
          <XCircle className="h-10 w-10 text-red-500" />
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-red-500">Entrada No Encontrada</p>
          <p className="text-sm text-muted-foreground mt-1">Este código QR no corresponde a ninguna entrada.</p>
        </div>
        <Button onClick={handleScanAnother} variant="outline" className="w-full mt-2">
          <RotateCcw className="h-4 w-4 mr-2" /> Intentar de nuevo
        </Button>
      </div>
    )

    if (!ok && reason === 'not_approved') return (
      <div className="flex flex-col items-center gap-4 py-6 animate-fade-in">
        <div className="h-20 w-20 rounded-full bg-yellow-500/10 flex items-center justify-center">
          <AlertCircle className="h-10 w-10 text-yellow-500" />
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-yellow-500">Pago No Aprobado</p>
          <p className="text-sm text-muted-foreground mt-1">{order.buyer_name}</p>
          <p className="text-xs text-muted-foreground capitalize">Estado: {order.status}</p>
        </div>
        <Button onClick={handleScanAnother} variant="outline" className="w-full mt-2">
          <RotateCcw className="h-4 w-4 mr-2" /> Escanear otra
        </Button>
      </div>
    )

    if (!ok && reason === 'already_used') return (
      <div className="flex flex-col items-center gap-4 py-6 animate-fade-in">
        <div className="h-20 w-20 rounded-full bg-orange-500/10 flex items-center justify-center">
          <AlertCircle className="h-10 w-10 text-orange-500" />
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-orange-500">Entrada Ya Usada</p>
          <p className="text-sm text-muted-foreground mt-1">{order.buyer_name}</p>
          <p className="text-xs text-muted-foreground">
            Usada el {format(new Date(order.used_at), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
          </p>
        </div>
        <Button onClick={handleScanAnother} variant="outline" className="w-full mt-2">
          <RotateCcw className="h-4 w-4 mr-2" /> Escanear otra
        </Button>
      </div>
    )

    // ok = true, not yet confirmed
    return (
      <div className="flex flex-col gap-4 py-4 animate-fade-in">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
          <CheckCircle className="h-8 w-8 text-green-500 shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-green-400">Entrada Válida ✓</p>
            <p className="text-sm font-medium truncate">{order.buyer_name}</p>
            <p className="text-xs text-muted-foreground truncate">{order.buyer_email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">Evento</p>
            <p className="font-medium leading-tight">{order.events?.name}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">Tipo de Entrada</p>
            <p className="font-medium leading-tight">{order.ticket_types?.name}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">Fecha del Evento</p>
            <p className="font-medium leading-tight">
              {order.events?.date
                ? format(new Date(order.events.date), 'dd MMM yyyy', { locale: es })
                : '—'}
            </p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">Código</p>
            <p className="font-mono text-xs font-medium leading-tight truncate">{order.qr_code?.slice(-9)}</p>
          </div>
        </div>

        <div className="flex gap-3 mt-2">
          <Button variant="outline" onClick={handleScanAnother} className="flex-1">
            <RotateCcw className="h-4 w-4 mr-2" /> Cancelar
          </Button>
          <Button onClick={handleMarkUsed} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
            <CheckCircle className="h-4 w-4 mr-2" /> Marcar Usada
          </Button>
        </div>
      </div>
    )
  }

  // ─── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ScanLine className="h-6 w-6" /> Escáner QR
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Escanea las entradas en la puerta del evento para registrar el ingreso.
        </p>
      </div>

      {/* Scanner area */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        {/* Camera viewport */}
        <div className="relative bg-black" style={{ minHeight: 320 }}>
          {/* html5-qrcode mounts here */}
          <div id={SCANNER_ID} className="w-full" />

          {/* Overlay when idle */}
          {scannerState === 'idle' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80">
              <Camera className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Cámara desactivada</p>
              <Button onClick={startScanner} size="lg" className="mt-2">
                <ScanLine className="h-5 w-5 mr-2" /> Iniciar Escáner
              </Button>
            </div>
          )}

          {/* Scanning overlay frame */}
          {scannerState === 'scanning' && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-52 h-52 relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
                {/* Scanning line animation */}
                <div className="absolute left-0 right-0 h-0.5 bg-primary/80 animate-[scan_2s_ease-in-out_infinite]" style={{ top: '50%' }} />
              </div>
              <p className="absolute bottom-4 text-xs text-white/70 bg-black/40 px-3 py-1 rounded-full">
                Apunta al código QR de la entrada
              </p>
            </div>
          )}

          {/* Loading overlay */}
          {scannerState === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Verificando entrada...</p>
            </div>
          )}
        </div>

        {/* Result panel */}
        {scannerState === 'result' && (
          <div className="p-5">
            <ResultCard />
          </div>
        )}

        {/* Stop button while scanning */}
        {scannerState === 'scanning' && (
          <div className="p-4 flex justify-center border-t">
            <Button variant="outline" onClick={async () => { await stopScanner(); setScannerState('idle') }}>
              Detener cámara
            </Button>
          </div>
        )}
      </div>

      {/* Scan history */}
      {history.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Historial de esta sesión
          </p>
          <div className="space-y-2">
            {history.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card text-sm">
                <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{entry.buyer_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{entry.events?.name} · {entry.ticket_types?.name}</p>
                </div>
                <p className="text-xs text-muted-foreground shrink-0">
                  {format(entry.confirmed_at, 'HH:mm')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
