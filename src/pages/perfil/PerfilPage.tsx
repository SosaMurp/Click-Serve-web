import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Shield, Key, Monitor, Smartphone, Globe, X, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { Badge, Button } from '@components/ui'
import { getActiveSessions, revokeSession, revokeAllSessions, updateAdminPassword } from '@api/auth'
import { useAuthStore } from '@store/authStore'
import './perfil.css'

// Interfaz para mapear lo que devuelve tu backend
interface SesionActiva {
  id_sesion: number
  dispositivo: string
  fecha_creacion: string
  es_sesion_actual: boolean
}

// Función auxiliar para leer el User-Agent y asignar un icono y nombre legible
const parseDevice = (userAgent: string) => {
  const ua = userAgent.toLowerCase()
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return { icon: Smartphone, name: 'Dispositivo Móvil' }
  }
  if (ua.includes('mac') || ua.includes('windows')) {
    return { icon: Monitor, name: 'Computadora de Escritorio' }
  }
  return { icon: Globe, name: 'Navegador Web' }
}

export default function PerfilPage() {
  const navigate = useNavigate()
  const { user, logout, setToken } = useAuthStore()
  
  // Estados para manejar las sesiones reales
  const [sessions, setSessions] = useState<SesionActiva[]>([])
  const [loading, setLoading] = useState(true)

  // Estados para modal de cambio de contraseña
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [passError, setPassError] = useState('')
  const [passSuccess, setPassSuccess] = useState('')
  const [passLoading, setPassLoading] = useState(false)

  // Cargar las sesiones al montar el componente
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const data = await getActiveSessions()
        setSessions(data.sesiones)
      } catch (error) {
        console.error('Error al cargar sesiones activas:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchSessions()
  }, [])

  // Función para desconectar un dispositivo consumiendo tu API (Ruta 11)
  const handleRevoke = async (sessionId: number) => {
    try {
      await revokeSession(sessionId.toString())
      setSessions(prev => prev.filter(s => s.id_sesion !== sessionId))
    } catch (error) {
      console.error('Error al intentar desvincular el dispositivo:', error)
      alert('No se pudo desvincular el dispositivo. Intenta de nuevo.')
    }
  }

  // Función para cerrar todas las demás sesiones
  const handleRevokeAll = async () => {
    if (!window.confirm('¿Estás seguro de que deseas desconectar todos los demás dispositivos?')) return

    try {
      await revokeAllSessions()
      setSessions(prev => prev.filter(s => s.es_sesion_actual))
    } catch (error) {
      console.error('Error al cerrar todas las sesiones:', error)
      alert('No se pudieron cerrar las sesiones. Intenta de nuevo.')
    }
  }

  // Cerrar sesión general en el servidor
  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  // Manejador para actualizar contraseña
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPassError('')
    setPassSuccess('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPassError('Por favor completa todos los campos.')
      return
    }
    if (newPassword.length < 8) {
      setPassError('La nueva contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPassError('La nueva contraseña y su confirmación no coinciden.')
      return
    }

    setPassLoading(true)
    try {
      const email = user?.correo || ''
      const res = await updateAdminPassword({ email, currentPassword, newPassword })

      if (res.token) {
        setToken(res.token)
      }
      setPassSuccess('¡Contraseña actualizada exitosamente! Las demás sesiones han sido revocadas.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      // Refrescar sesiones activas
      const data = await getActiveSessions()
      setSessions(data.sesiones)

      setTimeout(() => {
        setShowPasswordModal(false)
        setPassSuccess('')
      }, 2000)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      if (msg?.includes('incorrecta')) {
        setPassError('La contraseña actual es incorrecta.')
      } else {
        setPassError(msg || 'Error al intentar actualizar la contraseña.')
      }
    } finally {
      setPassLoading(false)
    }
  }

  const initials = user ? `${user.nombre?.[0] || 'A'}${user.apellido?.[0] || 'R'}`.toUpperCase() : 'AR'
  const fullName = user ? `${user.nombre} ${user.apellido || ''}`.trim() : 'Alejandro Ramírez'
  const userEmail = user?.correo || 'admin.lzc@clickserve.com'
  const userId = user ? `ADM-LZC-${String(user.id_usuario).padStart(3, '0')}` : 'ADM-LZC-001'

  return (
    <div className="perfil-page fade-in">
      {/* Header */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Perfil Administrativo</h1>
          <p className="dash-page-sub">GESTIÓN DE CUENTA Y SEGURIDAD</p>
        </div>
        <button className="perfil-logout" onClick={handleLogout}>
          <LogOut size={13} /> CERRAR SESIÓN SEGURA
        </button>
      </div>

      <div className="perfil-grid">
        {/* Left col */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Identity */}
          <div className="dash-card">
            <div className="perfil-section-head">
              <Shield size={14} />
              <p className="perfil-section-title">IDENTIDAD DEL OPERADOR</p>
            </div>

            <div className="perfil-identity-row">
              <div className="perfil-avatar">{initials}</div>
              <div>
                <p className="perfil-name">{fullName}</p>
                <span className="perfil-role-badge">SUPERADMINISTRADOR</span>
              </div>
            </div>

            <div className="perfil-fields-row">
              <div className="perfil-field">
                <label className="cfg-label">ID INSTITUCIONAL</label>
                <input className="perfil-input" value={userId} readOnly />
              </div>
              <div className="perfil-field">
                <label className="cfg-label">CORREO DE ACCESO</label>
                <input className="perfil-input" value={userEmail} readOnly />
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="dash-card">
            <div className="perfil-section-head">
              <Key size={14} />
              <p className="perfil-section-title">SEGURIDAD DE LA CUENTA</p>
            </div>

            <div className="perfil-security-row perfil-security-row--active">
              <div className="perfil-security-left">
                <Shield size={18} className="perfil-shield-icon" />
                <div>
                  <p className="perfil-security-title">Autenticación en 2 Pasos (Activa)</p>
                  <p className="perfil-security-sub">Protegido mediante Verificación por Correo al Iniciar Sesión</p>
                </div>
              </div>
              <Badge variant="success">ACTIVO</Badge>
            </div>

            <div className="perfil-security-row">
              <div>
                <p className="perfil-security-title">CONTRASEÑA PRINCIPAL</p>
                <p className="perfil-security-sub">Actualiza tu clave periódicamente para mantener tu cuenta protegida</p>
              </div>
              <button className="perfil-action-btn" onClick={() => setShowPasswordModal(true)}>
                ACTUALIZAR CLAVE
              </button>
            </div>
          </div>
        </div>

        {/* Right col — Devices */}
        <div className="dash-card perfil-devices-card">
          <div className="perfil-section-head">
            <Monitor size={14} />
            <p className="perfil-section-title">DISPOSITIVOS ACTIVOS</p>
          </div>
          <p className="cfg-hint" style={{ marginTop: -6, marginBottom: 16 }}>
            Monitorea tus conexiones recientes y revoca accesos sospechosos.
          </p>

          {loading ? (
            <p className="cfg-hint" style={{ textAlign: 'center', padding: '20px' }}>Cargando sesiones...</p>
          ) : (
            sessions.map((sesion) => {
              // Parseamos los datos del backend para la UI
              const { icon: Icon, name } = parseDevice(sesion.dispositivo)
              const fecha = new Date(sesion.fecha_creacion).toLocaleDateString('es-MX', { 
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
              })

              return (
                <div key={sesion.id_sesion} className="perfil-device">
                  <div className={`perfil-device-icon perfil-device-icon--${sesion.es_sesion_actual ? 'online' : 'ok'}`}>
                    <Icon size={15} />
                  </div>
                  
                  <div className="perfil-device-info">
                    <p className="perfil-device-name" title={sesion.dispositivo}>
                      {name}
                    </p>
                    <p className="perfil-device-meta" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                      {sesion.dispositivo}
                    </p>
                    <p className="perfil-device-meta">Iniciada: {fecha}</p>
                  </div>
                  
                  <div className="perfil-device-right">
                    {sesion.es_sesion_actual ? (
                      <Badge variant="success">ACTUAL</Badge>
                    ) : (
                      <button 
                        className="perfil-revoke" 
                        onClick={() => handleRevoke(sesion.id_sesion)}
                        title="Cerrar esta sesión remotamente"
                      >
                        <X size={10} /> Desconectar
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}

          {/* 👇 MODIFICACIÓN DEL INCISO C 👇 */}
          {sessions.length > 1 && (
            <button 
              className="perfil-revoke-all" 
              onClick={handleRevokeAll}
            >
              CERRAR TODAS LAS DEMÁS SESIONES
            </button>
          )}
          {/* 👆 -------------------------- 👆 */}

        </div>
      </div>

      {/* Modal de Cambio de Contraseña */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => !passLoading && setShowPasswordModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Actualizar Clave Maestra</h3>
              <button className="modal-close" onClick={() => !passLoading && setShowPasswordModal(false)}>
                <X size={16} />
              </button>
            </div>

            <p className="cfg-hint" style={{ marginTop: -8 }}>
              Por seguridad, debes ingresar tu contraseña actual para confirmar tu identidad. Al actualizar la clave, se cerrarán todas las demás sesiones activas.
            </p>

            {passSuccess ? (
              <div className="auth-success-wrap" style={{ textAlign: 'center', padding: '16px 0' }}>
                <CheckCircle size={32} color="var(--accent-teal)" style={{ margin: '0 auto 12px' }} />
                <p style={{ fontSize: '13px', color: 'var(--text-dark)', fontWeight: '600' }}>{passSuccess}</p>
              </div>
            ) : (
              <form className="modal-form" onSubmit={handleUpdatePassword}>
                <div className="field">
                  <label className="field-label">Contraseña Actual</label>
                  <div className="field-wrap">
                    <input
                      className="field-input pr-icon"
                      type={showPass ? 'text' : 'password'}
                      placeholder="Tu clave actual"
                      value={currentPassword}
                      onChange={e => { setCurrentPassword(e.target.value); setPassError('') }}
                      required
                      autoFocus
                    />
                    <span className="field-icon field-icon--right" onClick={() => setShowPass(!showPass)}>
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </span>
                  </div>
                </div>

                <div className="field">
                  <label className="field-label">Nueva Contraseña</label>
                  <div className="field-wrap">
                    <input
                      className="field-input pr-icon"
                      type={showPass ? 'text' : 'password'}
                      placeholder="Mínimo 8 caracteres"
                      value={newPassword}
                      onChange={e => { setNewPassword(e.target.value); setPassError('') }}
                      required
                    />
                    <span className="field-icon field-icon--right" onClick={() => setShowPass(!showPass)}>
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </span>
                  </div>
                </div>

                <div className="field">
                  <label className="field-label">Confirmar Nueva Contraseña</label>
                  <div className="field-wrap">
                    <input
                      className="field-input pr-icon"
                      type={showPass ? 'text' : 'password'}
                      placeholder="Repite la nueva clave"
                      value={confirmPassword}
                      onChange={e => { setConfirmPassword(e.target.value); setPassError('') }}
                      required
                    />
                    <span className="field-icon field-icon--right" onClick={() => setShowPass(!showPass)}>
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </span>
                  </div>
                </div>

                {passError && (
                  <div className="auth-error-box">
                    <span>⚠</span> {passError}
                  </div>
                )}

                <div className="modal-actions">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={() => setShowPasswordModal(false)}
                    disabled={passLoading}
                  >
                    CANCELAR
                  </Button>
                  <Button
                    type="submit"
                    size="md"
                    loading={passLoading}
                  >
                    GUARDAR NUEVA CLAVE
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}