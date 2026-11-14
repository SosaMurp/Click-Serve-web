import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogOut } from 'lucide-react'
import AuthLayout from '@components/layout/AuthLayout'
import { Button } from '@components/ui'
import { toast } from '@components/ui/Toaster'
import { updatePassword } from '@api/auth'
import { useAuthStore } from '@store/authStore'
import { contrasenaFuerte } from '@/lib/formatos'
import { mensajeDeError } from '@/lib/errores'
import { cerrarSesion } from '@/lib/sesion'
import './auth.css'

/**
 * Primer acceso de un coadministrador: la contraseña temporal solo sirve para llegar aquí.
 * Hasta que defina la suya, el servidor no deja usar ninguna otra parte del panel.
 */
export default function CambiarContrasenaPage() {
  const navigate = useNavigate()
  const nombre = useAuthStore(s => s.user?.nombre)
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [ver, setVer] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!actual) return setError('Escribe la contraseña temporal que recibiste por correo.')
    if (!contrasenaFuerte(nueva)) return setError('La contraseña nueva debe tener de 8 a 64 caracteres, con mayúscula, minúscula y número.')
    if (nueva === actual) return setError('La contraseña nueva debe ser distinta de la temporal.')
    if (nueva !== confirmar) return setError('Las contraseñas nuevas no coinciden.')

    setCargando(true)
    try {
      const res = await updatePassword(actual, nueva)
      useAuthStore.getState().contrasenaCambiada(res.token)
      toast.success('Listo: ya tienes tu propia contraseña.')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo cambiar la contraseña. Intenta de nuevo.'))
    } finally {
      setCargando(false)
    }
  }

  return (
    <AuthLayout
      leftTitle={<>Crea tu<br /><em>contraseña</em></>}
      leftDescription="La contraseña temporal que recibiste por correo solo sirve para este primer acceso. Define una propia para empezar a usar el panel."
      nodeLabel="PRIMER ACCESO"
    >
      <div className="auth-form-header">
        <h2 className="auth-form-title">{nombre ? `Hola, ${nombre}` : 'Cambia tu contraseña'}</h2>
        <p className="auth-form-subtitle">CAMBIO OBLIGATORIO DE CONTRASEÑA</p>
      </div>

      <form className="auth-form" onSubmit={enviar} noValidate style={{ marginTop: 16 }}>
        {([
          ['cp-actual', 'Contraseña temporal', actual, setActual, 'current-password'],
          ['cp-nueva', 'Contraseña nueva', nueva, setNueva, 'new-password'],
          ['cp-confirmar', 'Confirmar contraseña nueva', confirmar, setConfirmar, 'new-password'],
        ] as const).map(([id, etiqueta, valor, fijar, autocompletar], i) => (
          <div className="field" key={id}>
            <label className="field-label" htmlFor={id}>{etiqueta}</label>
            <div className="field-wrap">
              <input id={id} className="field-input pr-icon" type={ver ? 'text' : 'password'} value={valor} autoComplete={autocompletar}
                autoFocus={i === 0} onChange={e => { fijar(e.target.value); setError('') }} required />
              {i === 0 && (
                <button type="button" className="field-icon field-icon--right" onClick={() => setVer(v => !v)}
                  aria-label={ver ? 'Ocultar contraseñas' : 'Mostrar contraseñas'} aria-pressed={ver}>
                  {ver ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              )}
            </div>
          </div>
        ))}

        <p className="auth-hint">De 8 a 64 caracteres, con una mayúscula, una minúscula y un número.</p>

        {error && <div className="auth-error-box" role="alert"><span>⚠</span> {error}</div>}

        <Button type="submit" fullWidth loading={cargando} size="lg">GUARDAR Y ENTRAR →</Button>
        <button type="button" className="auth-hint" onClick={() => { void cerrarSesion() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', marginTop: 10, width: '100%' }}>
          <LogOut size={12} /> Salir sin cambiarla
        </button>
      </form>
    </AuthLayout>
  )
}
