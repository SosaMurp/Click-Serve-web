import { useState } from 'react'
import { X, UserPlus } from 'lucide-react'
import { Button, Input } from '@components/ui'
import { useCreateCoAdmin } from '../../hooks/useAdminQueries'
import './modals.css'

// RF-26: un administrador da de alta a otro. El registro público no crea administradores.
export default function CoAdminModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const crear = useCreateCoAdmin()
  const [form, setForm] = useState({ nombre: '', apellidos: '', email: '', telefono: '', password: '', confirmar: '' })
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState('')

  if (!isOpen) return null

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }))
    setError('')
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirmar) return setError('Las contraseñas no coinciden.')
    try {
      const res = await crear.mutateAsync({
        nombre: form.nombre.trim(),
        apellidos: form.apellidos.trim(),
        email: form.email.trim().toLowerCase(),
        telefono: form.telefono.trim() || undefined,
        password: form.password,
      })
      setHecho(res.mensaje)
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'No se pudo registrar al coadministrador.')
    }
  }

  const cerrar = () => {
    setForm({ nombre: '', apellidos: '', email: '', telefono: '', password: '', confirmar: '' })
    setError('')
    setHecho('')
    onClose()
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-container--sm fade-in">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">Nuevo coadministrador</h3>
            <p className="modal-subtitle">ACCESO AL PANEL DE ADMINISTRACIÓN</p>
          </div>
          <button className="modal-close-btn" onClick={cerrar}><X size={18} /></button>
        </div>

        {hecho ? (
          <>
            <div className="modal-body">
              <p style={{ margin: 0, fontSize: 14 }}>{hecho}</p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-mid)' }}>
                Comparte la contraseña por un medio seguro. Al entrar recibirá un código de acceso en su correo.
              </p>
            </div>
            <div className="modal-footer"><Button variant="primary" size="sm" onClick={cerrar}>LISTO</Button></div>
          </>
        ) : (
          <form onSubmit={guardar}>
            <div className="modal-body" style={{ gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Input label="Nombre" value={form.nombre} onChange={set('nombre')} required />
                <Input label="Apellidos" value={form.apellidos} onChange={set('apellidos')} required />
              </div>
              <Input label="Correo" type="email" value={form.email} onChange={set('email')} required />
              <Input label="Teléfono (opcional)" type="tel" value={form.telefono} onChange={set('telefono')} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Input label="Contraseña" type="password" value={form.password} onChange={set('password')} required />
                <Input label="Confirmar" type="password" value={form.confirmar} onChange={set('confirmar')} required />
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-mid)' }}>
                Mínimo 8 caracteres con una mayúscula, una minúscula y un número.
              </p>
              {error && <p style={{ margin: 0, fontSize: 12, color: 'var(--danger-ink)' }}>{error}</p>}
            </div>
            <div className="modal-footer">
              <Button type="button" variant="ghost" size="sm" onClick={cerrar}>CANCELAR</Button>
              <Button type="submit" variant="primary" size="sm" loading={crear.isPending}>
                <UserPlus size={13} /> REGISTRAR
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
