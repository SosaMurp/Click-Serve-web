import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, KeyRound, CheckCircle, Mail, Eye, EyeOff } from 'lucide-react'
import AuthLayout from '@components/layout/AuthLayout'
import { Button, Input, Badge } from '@components/ui'
import { requestRecovery, verifyRecovery, resetPassword } from '@api/auth'
import './auth.css'

export default function RecoverPasswordPage() {
  const navigate = useNavigate()

  // Step 1: 'request' (enter email) | Step 2: 'reset' (enter code + new password) | Step 3: 'success'
  const [step, setStep] = useState<'request' | 'reset' | 'success'>('request')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // Paso 1: Enviar código al correo
  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !email.includes('@')) {
      setError('Por favor ingresa un correo electrónico válido.')
      return
    }

    setLoading(true)
    try {
      await requestRecovery(email.trim().toLowerCase())
      setMessage(`Código enviado a ${email.trim()}`)
      setStep('reset')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'No se pudo procesar la solicitud de recuperación.')
    } finally {
      setLoading(false)
    }
  }

  // Paso 2: Verificar código de 4 dígitos y guardar nueva contraseña
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (code.length !== 4) {
      setError('El código de seguridad debe tener 4 dígitos.')
      return
    }
    if (newPassword.length < 8) {
      setError('La nueva clave debe tener al menos 8 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    try {
      // 1. Verificar token
      await verifyRecovery(email.trim().toLowerCase(), code.trim())
      // 2. Restablecer clave
      await resetPassword(email.trim().toLowerCase(), newPassword)
      setStep('success')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Código inválido o error al restablecer la contraseña.')
    } finally {
      setLoading(false)
    }
  }

  // Reenviar código
  const handleResend = async () => {
    setError('')
    setLoading(true)
    try {
      await requestRecovery(email.trim().toLowerCase())
      setMessage('Nuevo código de recuperación enviado a tu correo.')
    } catch {
      setError('Error al reenviar el código. Intenta más tarde.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      leftTitle={<>Recuperación de<br /><em>Acceso</em></>}
      leftDescription="Restablece tus credenciales administrativas de forma segura mediante validación de un solo uso."
      nodeLabel="SEGURIDAD DE CUENTA"
    >
      <Link to="/login" className="auth-back">
        <ArrowLeft size={13} /> VOLVER AL LOGIN
      </Link>

      {step === 'request' && (
        <>
          <div className="auth-form-header">
            <h2 className="auth-form-title">Recuperar Acceso</h2>
            <p className="auth-form-subtitle">IDENTIFICACIÓN DE OPERADOR</p>
          </div>

          <form className="auth-form" onSubmit={handleRequest} noValidate style={{ marginTop: 20 }}>
            <p className="auth-hint" style={{ marginBottom: 16 }}>
              Ingresa el correo registrado asociado a tu cuenta de operador. Te enviaremos un código temporal de 4 dígitos.
            </p>

            <Input
              label="Correo Institucional o de Operador"
              type="email"
              placeholder="admin@clickserve.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              iconRight={<Mail size={15} />}
              required
              autoFocus
            />

            {error && (
              <div className="auth-error-box">
                <span>⚠</span> {error}
              </div>
            )}

            <Button type="submit" fullWidth loading={loading} size="lg">
              ENVIAR CÓDIGO DE SEGURIDAD →
            </Button>
          </form>
        </>
      )}

      {step === 'reset' && (
        <>
          <div className="auth-form-header">
            <h2 className="auth-form-title">Nueva Clave</h2>
            <p className="auth-form-subtitle">CÓDIGO ENVIADO A {email}</p>
          </div>

          <Badge variant="online" dot>CÓDIGO DE 4 DÍGITOS ACTIVO</Badge>

          {message && (
            <p className="auth-hint" style={{ marginTop: 12, color: 'var(--accent-teal)' }}>
              ✓ {message}
            </p>
          )}

          <form className="auth-form" onSubmit={handleReset} noValidate style={{ marginTop: 16 }}>
            <Input
              label="Código de Seguridad (4 dígitos)"
              type="text"
              placeholder="1234"
              value={code}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4)
                setCode(val)
                setError('')
              }}
              iconRight={<KeyRound size={15} />}
              required
              autoFocus
            />

            <div className="field">
              <label className="field-label">Nueva Clave de Acceso</label>
              <div className="field-wrap">
                <input
                  className="field-input pr-icon"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setError('') }}
                  required
                />
                <span className="field-icon field-icon--right" onClick={() => setShowPass(!showPass)}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </span>
              </div>
            </div>

            <div className="field">
              <label className="field-label">Confirmar Nueva Clave</label>
              <div className="field-wrap">
                <input
                  className="field-input pr-icon"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Repite la nueva clave"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError('') }}
                  required
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
              RESTABLECER Y ACTIVAR CLAVE →
            </Button>

            <button
              type="button"
              className="auth-hint"
              style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', marginTop: 10, width: '100%' }}
              onClick={handleResend}
              disabled={loading}
            >
              ¿No recibiste el código? <u>Reenviar código</u>
            </button>
          </form>
        </>
      )}

      {step === 'success' && (
        <div className="auth-success-wrap" style={{ textAlign: 'center', padding: '20px 0' }}>
          <div className="auth-success-icon" style={{ margin: '0 auto 16px' }}>
            <CheckCircle size={36} color="var(--accent-teal)" />
          </div>
          <h2 className="auth-form-title">¡Clave Restablecida!</h2>
          <p className="auth-form-subtitle" style={{ margin: '8px 0 24px' }}>
            Tu contraseña se ha actualizado exitosamente. Todas las sesiones anteriores han sido revocadas por seguridad.
          </p>
          <Button fullWidth size="lg" onClick={() => navigate('/login', { replace: true })}>
            INICIAR SESIÓN CON NUEVA CLAVE →
          </Button>
        </div>
      )}
    </AuthLayout>
  )
}
