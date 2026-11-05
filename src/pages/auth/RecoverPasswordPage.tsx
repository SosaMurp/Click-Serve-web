import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, KeyRound, CheckCircle, Mail, Eye, EyeOff } from 'lucide-react'
import AuthLayout from '@components/layout/AuthLayout'
import { Button, Input, Badge } from '@components/ui'
import { requestRecovery, verifyRecovery, resetPassword } from '@api/auth'
import { contrasenaFuerte, correoValido } from '@/lib/formatos'
import { mensajeDeError, codigoDeError } from '@/lib/errores'
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
  // Token de un solo uso que entrega el servidor al verificar el código. Se conserva si la contraseña nueva
  // es rechazada, para no gastar el código (vale 10 minutos).
  const [resetToken, setResetToken] = useState<string | null>(null)
  const CODE_LENGTH = 6

  // Paso 1: Enviar código al correo (Anti-User Enumeration)
  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const cleanEmail = email.trim().toLowerCase()
    if (!correoValido(cleanEmail)) {
      setError('Por favor ingresa un correo electrónico válido.')
      return
    }

    setLoading(true)
    try {
      const res = await requestRecovery(cleanEmail)
      setMessage(res?.mensaje || `Si el correo está registrado y activo, se ha enviado un código a ${cleanEmail}`)
      setStep('reset')
    } catch (err: unknown) {
      setError(mensajeDeError(err, 'No se pudo procesar la solicitud de recuperación.'))
    } finally {
      setLoading(false)
    }
  }

  // Paso 2: verificar el código de 6 dígitos y guardar la nueva contraseña
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!resetToken && code.length !== CODE_LENGTH) {
      setError(`El código de seguridad tiene ${CODE_LENGTH} dígitos.`)
      return
    }
    if (!contrasenaFuerte(newPassword)) {
      setError('La contraseña debe tener de 8 a 64 caracteres, con mayúscula, minúscula y número.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    const correo = email.trim().toLowerCase()
    let token = resetToken
    try {
      // 1. Verificar el código (una sola vez): el servidor devuelve un reset_token de un solo uso
      if (!token) {
        token = (await verifyRecovery(correo, code.trim())).reset_token
        setResetToken(token)
      }
      // 2. Restablecer la clave con ese reset_token
      await resetPassword(correo, token, newPassword)
      setStep('success')
    } catch (err: unknown) {
      // Si el token venció, hay que pedir un código nuevo.
      if (codigoDeError(err) === 'RESET_NOT_VERIFIED') {
        setResetToken(null)
        setCode('')
      }
      setError(mensajeDeError(err, 'Código inválido o error al restablecer la contraseña.'))
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
      setResetToken(null)
      setCode('')
      setMessage('Si el correo está registrado y activo, se ha enviado un nuevo código de recuperación.')
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
              Ingresa el correo registrado asociado a tu cuenta de operador. Si el correo cuenta con un rol asignado y activo, te enviaremos un código temporal de 6 dígitos.
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
            <p className="auth-form-subtitle">VALIDACIÓN DE ACCESO PARA {email}</p>
          </div>

          <Badge variant="online" dot>{resetToken ? 'CÓDIGO VERIFICADO' : 'CÓDIGO DE 6 DÍGITOS ACTIVO'}</Badge>

          {message && (
            <p className="auth-hint" style={{ marginTop: 12, color: 'var(--success)' }}>
              ✓ {message}
            </p>
          )}

          <form className="auth-form" onSubmit={handleReset} noValidate style={{ marginTop: 16 }}>
            {!resetToken && (
              <Input
                label="Código de seguridad (6 dígitos)"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={CODE_LENGTH}
                value={code}
                onChange={e => {
                  setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))
                  setError('')
                }}
                iconRight={<KeyRound size={15} />}
                required
                autoFocus
              />
            )}

            <div className="field">
              <label className="field-label" htmlFor="nueva-clave">Nueva clave de acceso</label>
              <div className="field-wrap">
                <input
                  className="field-input pr-icon"
                  type={showPass ? 'text' : 'password'}
                  id="nueva-clave"
                  autoComplete="new-password"
                  placeholder="8+ caracteres, mayúscula, minúscula y número"
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setError('') }}
                  required
                />
                <button type="button" className="field-icon field-icon--right" onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPass}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="confirmar-clave">Confirmar nueva clave</label>
              <div className="field-wrap">
                <input
                  className="field-input pr-icon"
                  type={showPass ? 'text' : 'password'}
                  id="confirmar-clave"
                  autoComplete="new-password"
                  placeholder="Repite la nueva clave"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError('') }}
                  required
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
            <CheckCircle size={36} color="var(--success)" />
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
