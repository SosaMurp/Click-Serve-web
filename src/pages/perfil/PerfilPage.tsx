import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Shield, Key, Monitor, Smartphone, Globe, X, Lock, CheckCircle, AlertCircle } from 'lucide-react'
import { Badge, Button } from '@components/ui'
import { getActiveSessions, revokeSession, revokeAllSessions, updatePassword } from '@api/auth'
import { useAuthStore } from '@store/authStore'
import './perfil.css'

// Interfaz para mapear lo que devuelve tu backend
interface SesionActiva {
  id_sesion: string
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
  const user = useAuthStore(s => s.user)
  
  // Estados para manejar las sesiones reales
  const [sessions, setSessions] = useState<SesionActiva[]>([])
  const [loading, setLoading] = useState(true)

  // Cargar las sesiones al montar el componente
  // Estados para Modal de Cambio de Contraseña
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Cargar sesiones al montar
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
  const handleRevoke = async (sessionId: string) => {
    try {
      await revokeSession(sessionId)
      // Si la API responde con éxito, quitamos la sesión de la vista localmente
      setSessions(prev => prev.filter(s => s.id_sesion !== sessionId))
    } catch (error) {
      console.error('Error al intentar desvincular el dispositivo:', error)
      alert('No se pudo desvincular el dispositivo. Intenta de nuevo.')
    }
  }

  // Función para cerrar todas las demás sesiones
  const handleRevokeAll = async () => {
    // Es buena práctica pedir confirmación para acciones destructivas masivas
    if (!window.confirm('¿Estás seguro de que deseas desconectar todos los demás dispositivos?')) return

    try {
      await revokeAllSessions()
      // Filtramos el estado local para dejar únicamente la sesión actual en la pantalla
      setSessions(prev => prev.filter(s => s.es_sesion_actual))
    } catch (error) {
      console.error('Error al cerrar todas las sesiones:', error)
      alert('No se pudieron cerrar las sesiones. Intenta de nuevo.')
    }
  }

  const handleLogout = () => {
    useAuthStore.getState().logout()
    navigate('/login')
  }

  // Manejador del cambio de contraseña
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)

    if (!currentPassword) {
      setPasswordError('Ingresa tu contraseña actual.')
      return
    }
    if (!newPassword || newPassword.length < 8) {
      setPasswordError('La nueva contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden.')
      return
    }

    try {
      setIsSubmitting(true)
      const res = await updatePassword(currentPassword, newPassword)
      
      if (res.token) {
        useAuthStore.getState().updateToken(res.token)
      }

      setPasswordSuccess(res.mensaje || 'Contraseña actualizada exitosamente.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      setTimeout(() => {
        setIsPasswordModalOpen(false)
        setPasswordSuccess(null)
      }, 2000)

    } catch (error: any) {
      console.error('Error al cambiar contraseña:', error)
      const msg = error.response?.data?.error || 'Error al intentar cambiar la contraseña. Verifica tus datos.'
      setPasswordError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

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
              <div className="perfil-avatar">
                {user ? `${user.nombre?.[0] ?? ''}${user.apellido?.[0] ?? ''}`.toUpperCase() : 'AD'}
              </div>
              <div>
                <p className="perfil-name">
                  {user ? `${user.nombre} ${user.apellido}` : 'Administrador'}
                </p>
                <span className="perfil-role-badge">
                  {user?.id_rol === 1 ? 'SUPERADMINISTRADOR' : 'ADMINISTRADOR'}
                </span>
              </div>
            </div>

            <div className="perfil-fields-row">
              <div className="perfil-field">
                <label className="cfg-label">ID</label>
                <input
                  className="perfil-input"
                  value={user?.id_usuario ? `ADM-LZC-${String(user.id_usuario).padStart(3, '0')}` : ''}
                  readOnly
                />
              </div>
              <div className="perfil-field">
                <label className="cfg-label">CORREO DE ACCESO</label>
                <input
                  className="perfil-input"
                  value={user?.correo ?? ''}
                  readOnly
                />
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
                  <p className="perfil-security-sub">Protegido mediante Verificación por Correo</p>
                </div>
              </div>
              <button className="perfil-action-btn">RECONFIGURAR</button>
            </div>

            <div className="perfil-security-row">
              <div>
                <p className="perfil-security-title">CONTRASEÑA PRINCIPAL</p>
                <p className="perfil-security-sub">Actualiza tu clave de acceso de forma segura</p>
              </div>
              <button 
                className="perfil-action-btn"
                onClick={() => {
                  setPasswordError(null)
                  setPasswordSuccess(null)
                  setIsPasswordModalOpen(true)
                }}
              >
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

      {/* MODAL PARA CAMBIO DE CONTRASEÑA */}
      {isPasswordModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-container modal-container--sm fade-in" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <h3 className="modal-title">Cambio de Contraseña Maestra</h3>
                <p className="modal-subtitle">ACTUALIZACIÓN DE SEGURIDAD</p>
              </div>
              <button className="modal-close-btn" onClick={() => setIsPasswordModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdatePassword}>
              <div className="modal-body" style={{ gap: 14 }}>
                {passwordError && (
                  <div style={{ background: '#FDE8E6', border: '1px solid #F4C7C2', padding: '10px 12px', borderRadius: 6, fontSize: 13, color: '#D92D20', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{passwordError}</span>
                  </div>
                )}

                {passwordSuccess && (
                  <div style={{ background: '#E3F4EA', border: '1px solid #BFE3CD', padding: '10px 12px', borderRadius: 6, fontSize: 13, color: '#0E7A42', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <CheckCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{passwordSuccess}</span>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>
                    Contraseña Actual *
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CDD3E0', fontSize: 13 }}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>
                    Nueva Contraseña *
                  </label>
                  <input
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CDD3E0', fontSize: 13 }}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>
                    Confirmar Nueva Contraseña *
                  </label>
                  <input
                    type="password"
                    placeholder="Repite la nueva contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CDD3E0', fontSize: 13 }}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ justifyContent: 'flex-end', gap: 8 }}>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsPasswordModalOpen(false)}
                  disabled={isSubmitting}
                >
                  CANCELAR
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
                  size="sm"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'GUARDANDO...' : 'GUARDAR NUEVA CLAVE'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}