import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle, Mail } from 'lucide-react'
import AuthLayout from '@components/layout/AuthLayout'
import { Button } from '@components/ui'
import { verifyToken, resendCode } from '@api/auth'
import './auth.css'

export default function RequestSentPage() {
  const navigate = useNavigate()
  const email = sessionStorage.getItem('pending_email') || 'tu correo institucional'

  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [resent, setResent] = useState(false)

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 4) { setError('El código debe ser de 4 dígitos.'); return }
    setError(''); setLoading(true)
    try {
      await verifyToken(email, code)
      sessionStorage.removeItem('pending_email')
      navigate('/login', { state: { verified: true } })
    } catch (err: unknown) {
      setLoading(false)
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Código incorrecto o expirado.')
    }
  }

  const handleResend = async () => {
    setResending(true); setError(''); setResent(false)
    try {
      await resendCode(email)
      setResent(true)
    } catch {
      setError('No se pudo reenviar el código. Intenta de nuevo.')
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthLayout
      leftTitle={<>Solicitud de<br /><em>Credenciales</em></>}
      leftDescription="El acceso al panel central está estrictamente regulado. Completa el formulario y espera la validación de tu gerente regional o del departamento de IT."
      nodeLabel="CONTROL DE ACCESO"
    >
      <div className="auth-success-wrap">
        <div className="auth-success-icon">
          <CheckCircle size={32} />
        </div>

        <div className="auth-form-header" style={{ textAlign: 'center' }}>
          <h2 className="auth-form-title">Solicitud Enviada</h2>
          <p className="auth-form-subtitle" style={{ marginTop: 8 }}>
            Hemos enviado un código de activación de 4 dígitos a tu correo institucional.
          </p>
        </div>

        <div className="auth-folio-box">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
            <Mail size={14} style={{ color: 'var(--text-muted)' }} />
            <p className="auth-folio-label" style={{ margin: 0 }}>CORREO DE ACTIVACIÓN</p>
          </div>
          <p className="auth-folio-num" style={{ fontSize: 15, letterSpacing: 0 }}>{email}</p>
        </div>

        {/* Verificación del código */}
        <form onSubmit={handleVerify} style={{ width: '100%' }}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field-label">CÓDIGO DE 4 DÍGITOS</label>
            <input
              className="field-input"
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="0000"
              value={code}
              onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError('') }}
              style={{ textAlign: 'center', fontSize: 24, fontWeight: 700, letterSpacing: 12 }}
            />
          </div>

          {error && <div className="auth-error-box" style={{ marginBottom: 12 }}><span>⚠</span> {error}</div>}
          {resent && <div className="auth-success-msg">✓ Nuevo código enviado a tu correo.</div>}

          <Button type="submit" fullWidth loading={loading} size="lg">
            ACTIVAR CUENTA
          </Button>
        </form>

        <button
          type="button"
          className="auth-backup-link"
          onClick={handleResend}
          disabled={resending}
        >
          {resending ? 'Enviando...' : '¿No recibiste el código? Reenviar'}
        </button>

        <Link to="/login">
          <Button variant="outline" fullWidth size="md">
            ← VOLVER A LA PANTALLA DE LOGIN
          </Button>
        </Link>
      </div>
    </AuthLayout>
  )
}
