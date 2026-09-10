import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, User } from 'lucide-react'
import AuthLayout from '@components/layout/AuthLayout'
import { Button, Input, Badge } from '@components/ui'
import { loginAdmin } from '@api/auth'
import { useAuthStore } from '@store/authStore'
import './auth.css'

// Rol de administrador en la BD (id_rol = 3)
const ADMIN_ROL_ID = 3

export default function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore(s => s.login)

  const [showPass, setShowPass] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
   e.preventDefault()
   setError('')
   setLoading(true)

   try {
      // Tu api/auth.ts debe apuntar ahora a '/api/login-admin'
   const data = await loginAdmin({ email, password })

      // Si el backend nos indica que las credenciales son correctas y mandó el código:
      if (data.requiere2FA) {
        // Redirigimos a la nueva vista de verificación pasándole el correo
        navigate('/verify-2fa', { 
          state: { emailIngresado: email },
          replace: true 
        })
      }

      } catch (err: unknown) {
      setLoading(false)
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
   
      if (msg?.includes('Contraseña') || msg?.includes('contraseña')) {
     setError('Contraseña incorrecta. Verifica tus credenciales.')
      } else if (msg?.includes('denegado')) {
        setError(msg) // Muestra el error de "Exclusivo para panel web"
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

      <Badge variant="online" dot>SISTEMAS EN LÍNEA • NODO LZC ACTIVO</Badge>

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
