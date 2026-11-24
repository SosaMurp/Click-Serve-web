import { useState } from 'react'
import { X, UserPlus } from 'lucide-react'
import { Button, Input } from '@components/ui'
import { useCreateCoAdmin } from '../../hooks/useAdminQueries'
import { correoValido, normalizarCorreo, normalizarTelefono, nombreValido } from '../../lib/formatos'
import { mensajeDeError } from '../../lib/errores'
import './modals.css'

// RF-26: un administrador da de alta a otro. El registro público no crea administradores.
export default function CoAdminModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const crear = useCreateCoAdmin()
  const [form, setForm] = useState({ nombre: '', apellidos: '', email: '', telefono: '' })
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState('')

  if (!isOpen) return null

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }))
    setError('')
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    const nombre = nombreValido(form.nombre)
    const apellidos = nombreValido(form.apellidos, 80)
    const telefono = form.telefono.trim() ? normalizarTelefono(form.telefono) : undefined
    if (!nombre || !apellidos) return setError('Escribe nombre y apellidos usando solo letras.')
    if (!correoValido(form.email)) return setError('Escribe un correo electrónico válido, por ejemplo ana@correo.mx.')
    if (telefono === null) return setError('El teléfono debe tener 10 dígitos, por ejemplo 753 123 4567.')
    try {
      const res = await crear.mutateAsync({
        nombre,
        apellidos,
        email: normalizarCorreo(form.email),
        telefono: telefono ?? undefined,
      })
      setHecho(res.mensaje)
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo registrar al coadministrador.'))
    }
  }

  const cerrar = () => {
    setForm({ nombre: '', apellidos: '', email: '', telefono: '' })
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
                En su primer acceso usará esa contraseña temporal, recibirá un código de verificación en el mismo correo y deberá crear su propia contraseña.
              </p>
            </div>
            <div className="modal-footer"><Button variant="primary" size="sm" onClick={cerrar}>Listo</Button></div>
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
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-mid)', lineHeight: 1.5, background: 'var(--bg-sunk)', padding: '10px 12px', borderRadius: 8 }}>
                No necesitas elegir una contraseña: le enviaremos una <strong>contraseña temporal</strong> a este correo. Sirve solo para su
                primer acceso (vence en 48 horas) y tendrá que cambiarla al entrar.
              </p>
              {error && <p role="alert" style={{ margin: 0, fontSize: 12, color: 'var(--danger-ink)' }}>{error}</p>}
            </div>
            <div className="modal-footer">
              <Button type="button" variant="ghost" size="sm" onClick={cerrar}>Cancelar</Button>
              <Button type="submit" variant="primary" size="sm" loading={crear.isPending}>
                <UserPlus size={13} /> REGISTRAR Y ENVIAR ACCESO
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
