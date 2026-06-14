import { useState, useEffect } from 'react'
import { Save, Bell } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

const BANKS = ['Banco de Venezuela', 'Banesco', 'Mercantil', 'BBVA Provincial', 'Bicentenario', 'BNC', 'Banco Exterior', 'Banplus', 'Sofitasa', 'Otro']

export default function Settings() {
  const { user, profile, fetchProfile } = useAuth()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ full_name: '', org_name: '', phone: '', payment_phone: '', payment_bank: '', payment_ci: '', email_notifications: true })

  useEffect(() => {
    if (profile) setForm(f => ({ ...f, full_name: profile.full_name||'', org_name: profile.org_name||'', phone: profile.phone||'', payment_phone: profile.payment_phone||'', payment_bank: profile.payment_bank||'', payment_ci: profile.payment_ci||'', email_notifications: profile.email_notifications ?? true }))
  }, [profile])

  const set = f => e => setForm(v => ({ ...v, [f]: e.target.value }))
  const setSelect = f => v => setForm(v2 => ({ ...v2, [f]: v }))

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase.from('organizer_profiles').upsert({ id: user.id, ...form }, { onConflict: 'id' })
    if (error) toast.error('Error al guardar los cambios')
    else { toast.success('✅ Perfil actualizado'); fetchProfile(user.id) }
    setSaving(false)
  }

  return (
    <div className="p-4 md:p-8 space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-muted-foreground">Gestiona tu perfil y preferencias</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información Personal</CardTitle>
          <CardDescription>Tu nombre y datos de contacto</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre completo</Label>
              <Input placeholder="Juan Pérez" value={form.full_name} onChange={set('full_name')} />
            </div>
            <div className="space-y-2">
              <Label>Organización</Label>
              <Input placeholder="Mi Empresa" value={form.org_name} onChange={set('org_name')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Correo electrónico</Label>
            <Input value={user?.email || ''} disabled className="opacity-60" />
            <p className="text-xs text-muted-foreground">El correo no puede modificarse desde aquí</p>
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input type="tel" placeholder="0412-1234567" value={form.phone} onChange={set('phone')} />
          </div>
        </CardContent>
      </Card>

      {/* Payment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de Pago Móvil (por defecto)</CardTitle>
          <CardDescription>Se pre-rellenarán al crear nuevos eventos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Teléfono de Pago Móvil</Label>
            <Input type="tel" placeholder="0412-1234567" value={form.payment_phone} onChange={set('payment_phone')} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Banco</Label>
              <Select value={form.payment_bank} onValueChange={setSelect('payment_bank')}>
                <SelectTrigger><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
                <SelectContent>{BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cédula / RIF</Label>
              <Input placeholder="V-12345678" value={form.payment_ci} onChange={set('payment_ci')} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notificaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.email_notifications}
              onChange={e => setForm(f => ({ ...f, email_notifications: e.target.checked }))}
              className="h-4 w-4 accent-foreground cursor-pointer"
            />
            <div>
              <div className="text-sm font-medium">Notificaciones por email</div>
              <div className="text-xs text-muted-foreground">Recibe un email cuando llegue un nuevo pago para revisar</div>
            </div>
          </label>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} size="lg">
        {saving
          ? <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
          : <><Save className="h-4 w-4" /> Guardar cambios</>}
      </Button>

      {/* Danger zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Zona de peligro</CardTitle>
          <CardDescription>Estas acciones son irreversibles</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" size="sm" onClick={() => toast.error('Contacta soporte para eliminar tu cuenta')}>
            Eliminar cuenta
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
