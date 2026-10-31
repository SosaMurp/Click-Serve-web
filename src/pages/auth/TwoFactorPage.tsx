import { useState, useEffect, useRef } from 'react'
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
  
  const login = useAuthStore(s => s.login)
  const email = location.state?.emailIngresado || ''

  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!email) {
      navigate('/login', { replace: true })
    }
  }, [email, navigate])

  const executeVerify = async (codeToVerify: string) => {
    setError('')
    if (codeToVerify.length !== 6) {
      setError('El código debe tener 6 dígitos.')
      return
    }

    setLoading(true)

    try {
      const data = await verifyAdminLogin(email, codeToVerify)
      if (data.usuario && data.token) {
        // Reemplazar historial para no-repudio (RNF-40)
        window.history.replaceState(null, '', '/dashboard')
        login(data.usuario, data.token)
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    executeVerify(code)
  }

  // Auto-verificación al completar el 6º dígito en < 100ms (RNF-18)
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    setCode(val)
    setError('')

    if (val.length === 6 && !loading) {
      executeVerify(val)
    }
  }

  return (
    <AuthLayout
      leftTitle={<>Seguridad<br /><em>Avanzada</em></>}
      leftDescription="Protegiendo el acceso al panel centralizado de Click & Serve. Sistema de autenticación de dos factores activado."
    >
      <div className="auth-form-header">
        <h2 className="auth-form-title">Verificación 2FA</h2>
        <p className="auth-form-subtitle">CÓDIGO DE SEGURIDAD REQUERIDO</p>
      </div>

      <Badge variant="online" dot>CÓDIGO ENVIADO AL CORREO</Badge>

      <form ref={formRef} className="auth-form" onSubmit={handleSubmit} noValidate>
        <p className="auth-hint" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          Hemos enviado un código de 6 dígitos a <br/><strong>{email}</strong>
        </p>

        <Input
          label="Código de Seguridad"
          type="text"
          placeholder="123456"
          value={code}
          onChange={handleCodeChange}
          iconRight={<KeyRound size={15} />}
          required
          autoFocus
          maxLength={6}
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