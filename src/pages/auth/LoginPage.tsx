import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, User } from 'lucide-react'
import AuthLayout from '@components/layout/AuthLayout'
import { Button, Input } from '@components/ui'
import { loginAdmin } from '@api/auth'
import { correoValido } from '@/lib/formatos'
import { mensajeDeError, codigoDeError } from '@/lib/errores'
import './auth.css'

export default function LoginPage() {
  const navigate = useNavigate()

  const [showPass, setShowPass] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Aviso que deja el cierre de sesión (vencida, por inactividad o revocada desde otro dispositivo)
  const [aviso] = useState(() => {
    try {
      const v = sessionStorage.getItem('login_aviso')
      sessionStorage.removeItem('login_aviso')
      return v
    } catch {
      return null
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const cleanEmail = email.trim().toLowerCase()
    if (!correoValido(cleanEmail)) {
      setError('Ingresa un correo electrónico válido.')
      return
    }
    if (!password) {
      setError('Ingresa tu contraseña.')
      return
    }

    setLoading(true)
    try {
      // Paso 1: credenciales; el servidor envía el código de acceso al correo
      const data = await loginAdmin({ email: cleanEmail, password })
      if (data.requiere2FA) {
        navigate('/verify-2fa', { state: { emailIngresado: cleanEmail }, replace: true })
        return
      }
      setError('Respuesta inesperada del servidor. Intenta de nuevo.')
    } catch (err: unknown) {
      // El backend ya responde con mensajes que no revelan si el correo existe (CWE-204).
      const code = codigoDeError(err)
      setError(code === 'INVALID_CREDENTIALS'
        ? 'Credenciales incorrectas. Verifica tu correo y contraseña.'
        : mensajeDeError(err, 'No se pudo iniciar sesión. Intenta de nuevo.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      leftTitle={<>Gestión Centralizada<br /><em>Lázaro Cárdenas</em></>}
      leftDescription="Acceso seguro al panel de control. Monitoreo en tiempo real de técnicos, validaciones de identidad y servicios activos."
    >
      <div className="auth-form-header">
        <h2 className="auth-form-title">Bienvenido de nuevo</h2>
        <p className="auth-form-subtitle">AUTENTICACIÓN REQUERIDA</p>
      </div>

      {aviso && (
        <p className="auth-hint" role="status" style={{ marginBottom: 12, color: 'var(--accent-ink)' }}>{aviso}</p>
      )}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <Input
          label="ID de Operador o Correo"
          type="email"
          placeholder="admin.lzc@clickserve.com"
          value={email}
          onChange={e => { setEmail(e.target.value); setError('') }}
          iconRight={<User size={15} />}
          required
          autoComplete="email"
        />

        <div className="field">
          <div className="field-row-label">
            <label className="field-label" htmlFor="login-password">Clave de Acceso</label>
            <button
              type="button"
              className="auth-forgot"
              onClick={() => navigate('/recover')}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
          <div className="field-wrap">
            <input
              id="login-password"
              className="field-input pr-icon"
              type={showPass ? 'text' : 'password'}
              placeholder="Tu contraseña"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              required
              autoComplete="current-password"
            />
            <button type="button" className="field-icon field-icon--right" onClick={() => setShowPass(!showPass)}
              aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPass}>
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="auth-error-box">
            <span>⚠</span> {error}
          </div>
        )}

        <Button type="submit" fullWidth loading={loading} size="lg">
          AUTENTICAR EN EL SISTEMA →
        </Button>
      </form>

      <div className="auth-divider">
        <p className="auth-hint">¿Eres un nuevo operador asignado a esta zona?</p>
        <Link to="/register">
          <Button variant="outline" fullWidth size="md">
            ⊕ &nbsp;SOLICITAR REGISTRO DE ACCESO
          </Button>
        </Link>
      </div>
    </AuthLayout>
  )
}
