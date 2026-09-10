import { useState, useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { KeyRound, ArrowLeft } from 'lucide-react'
import AuthLayout from '@components/layout/AuthLayout'
import { Button, Input, Badge } from '@components/ui'
import { verifyAdminLogin } from '@api/auth'
import { useAuthStore } from '@store/authStore'
import './auth.css'

export default function TwoFactorPage() {
  const location = useLocation()
  const navigate = useNavigate()
  
  // Traemos la función de login del store (la que quitamos del LoginPage)
  const login = useAuthStore(s => s.login)

  // Recuperamos el correo que enviamos desde el LoginPage
  const email = location.state?.emailIngresado || ''

  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Efecto de seguridad: Si alguien entra a la URL directo sin pasar por el login,
  // no tendrá un 'email' en el state, así que lo devolvemos al login.
  useEffect(() => {
    if (!email) {
      navigate('/login', { replace: true })
    }
  }, [email, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validamos que el código tenga la longitud correcta
    if (code.length !== 6) {
      setError('El código debe tener 6 dígitos.')
      return
    }

    setLoading(true)

    try {
      // Consumimos el endpoint que creamos en api/auth.ts
      const data = await verifyAdminLogin(email, code)

      // Verificamos que el backend nos haya enviado el usuario y el token definitivos
      if (data.usuario && data.token) {
        // Guardamos la sesión en el store y localStorage
        login(data.usuario, data.token)
        
        // ¡Acceso concedido al Dashboard!
        navigate('/dashboard', { replace: true })
      } else {
        setError('Error al obtener los datos de la sesión.')
        setLoading(false)
      }
    } catch (err: unknown) {
      setLoading(false)
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Código incorrecto o expirado.')
    }
  }

  return (
    <AuthLayout
      leftTitle={<>Seguridad<br /><em>Avanzada</em></>}
      leftDescription="Protegiendo el acceso al panel centralizado de Click&Serve. Sistema de autenticación de dos factores activado."
    >
      <div className="auth-form-header">
        <h2 className="auth-form-title">Verificación 2FA</h2>
        <p className="auth-form-subtitle">CÓDIGO DE SEGURIDAD REQUERIDO</p>
      </div>

      <Badge variant="online" dot>CÓDIGO ENVIADO AL CORREO</Badge>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <p className="auth-hint" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          Hemos enviado un código de 6 dígitos a <br/><strong>{email}</strong>
        </p>

        <Input
          label="Código de Seguridad"
          type="text"
          placeholder="123456"
          value={code}
          onChange={e => {
            // Expresión regular para permitir SOLO NÚMEROS y máximo 6 caracteres
            const val = e.target.value.replace(/\D/g, '').slice(0, 6)
            setCode(val)
            setError('')
          }}
          iconRight={<KeyRound size={15} />}
          required
          autoFocus // Pone el cursor automáticamente en este campo
        />

        {error && (
          <div className="auth-error-box">
            <span>⚠</span> {error}
          </div>
        )}

        <Button type="submit" fullWidth loading={loading} size="lg">
          VALIDAR ACCESO →
        </Button>
      </form>

      <div className="auth-divider">
        <Link to="/login" replace>
          <Button variant="outline" fullWidth size="md">
            <ArrowLeft size={16} style={{ marginRight: '8px' }} /> VOLVER AL INICIO
          </Button>
        </Link>
      </div>
    </AuthLayout>
  )
}