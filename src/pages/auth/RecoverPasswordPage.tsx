import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import AuthLayout from '@components/layout/AuthLayout'
import { Button, Input } from '@components/ui'
import { requestRecovery } from '@api/auth'
import './auth.css'

export default function RecoverPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await requestRecovery(email)
      setSent(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'No se pudo enviar la solicitud de recuperación. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      leftTitle={<>Restablecimiento de Acceso<br /><em>Nodo Lázaro Cárdenas</em></>}
      leftDescription="Recupera la clave de acceso a la plataforma administrativa sin intervención manual del equipo de soporte."
    >
      <div className="auth-form-header">
        <h2 className="auth-form-title">¿Olvidaste tu contraseña?</h2>
        <p className="auth-form-subtitle">RECUPERACIÓN AUTOMATIZADA DE CREDENCIALES</p>
      </div>

      {sent ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <CheckCircle2 size={48} color="var(--accent)" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text-dark)' }}>
            Instrucciones enviadas
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.5, marginBottom: 24 }}>
            Hemos enviado un código y enlace seguro de restauración a <strong>{email}</strong>. Revisa tu bandeja de entrada y carpeta de spam.
          </p>
          <Button fullWidth onClick={() => navigate('/login')}>
            VOLVER AL INICIO DE SESIÓN
          </Button>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <p style={{ fontSize: 13, color: 'var(--text-mid)', marginBottom: 16 }}>
            Ingresa la dirección de correo institucional vinculada a tu cuenta de operador o técnico para recibir un token de recuperación.
          </p>

          <Input
            label="Correo de Operador"
            type="email"
            placeholder="admin.lzc@clickserve.com"
            value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            iconRight={<Mail size={15} />}
            required
            autoComplete="email"
          />

          {error && (
            <div className="auth-error-box">
              <span>⚠</span> {error}
            </div>
          )}

          <Button type="submit" fullWidth loading={loading} size="lg">
            ENVIAR ENLACE DE RECUPERACIÓN →
          </Button>

          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Link to="/login" style={{ fontSize: 12, color: 'var(--text-mid)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
              <ArrowLeft size={14} /> Regresar a Iniciar Sesión
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  )
}

