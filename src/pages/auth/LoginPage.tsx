import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, User } from 'lucide-react'
import AuthLayout from '@components/layout/AuthLayout'
import { Button, Input } from '@components/ui'
import { loginAdmin } from '@api/auth'
import './auth.css'

// Componente principal de la página de Login
export default function LoginPage() {
  const navigate = useNavigate()

  // Estados locales para manejar los datos del formulario y la UI
  const [showPass, setShowPass] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Función que se ejecuta al presionar el botón "AUTENTICAR EN EL SISTEMA"
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Por favor ingresa un correo electrónico institucional válido.')
      return
    }

    if (!password) {
      setError('Por favor ingresa tu clave de acceso.')
      return
    }

    setLoading(true)

    try {
      // Paso 1: Enviar credenciales
      const data = await loginAdmin({ email: cleanEmail, password })

      if (data.requiere2FA) {
        navigate('/verify-2fa', { 
          state: { emailIngresado: cleanEmail },
          replace: true 
        })
      }

    } catch (err: unknown) {
      setLoading(false)
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error

      // Mitigación OWASP contra Enumeración de Usuarios (CWE-204):
      // No revelar si el correo existe o si la clave fue el elemento que falló
      if (msg?.includes('denegado') || msg?.includes('verificada') || msg?.includes('suspendida') || msg?.includes('inactiva')) {
        setError(msg)
      } else if (msg?.includes('incorrectos') || msg?.includes('credenciales') || msg?.includes('contraseña') || msg?.includes('correo')) {
        setError('Credenciales incorrectas. Verifica tu correo y contraseña.')
      } else {
        setError(msg || 'Error al conectar con el servidor.')
      }
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
            <label className="field-label">Clave de Acceso</label>
            <button
              type="button"
              className="auth-forgot"
              onClick={() => navigate('/recover')}
            >
              Recuperar IDs
            </button>
          </div>
          <div className="field-wrap">
            <input
              className="field-input pr-icon"
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••••••"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              required
              autoComplete="current-password"
            />
            <span className="field-icon field-icon--right" onClick={() => setShowPass(!showPass)}>
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </span>
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
