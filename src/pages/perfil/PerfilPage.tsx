import { useState, useEffect } from 'react'
import { Shield, Key, Monitor, Smartphone, Globe, X, Lock, CheckCircle, AlertCircle } from 'lucide-react'
import { Badge, Button, Input } from '@components/ui'
import { getActiveSessions, revokeSession, revokeAllSessions, updatePassword } from '@api/auth'
import { useAuthStore } from '@store/authStore'
import { toast } from '@components/ui/Toaster'
import { contrasenaFuerte } from '@/lib/formatos'
import { mensajeDeError } from '@/lib/errores'
import '@components/modals/modals.css'
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
        toast.error(mensajeDeError(error, 'No se pudieron cargar tus sesiones activas.'))
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
      toast.success('Dispositivo desvinculado.')
    } catch (error) {
      toast.error(mensajeDeError(error, 'No se pudo desvincular el dispositivo. Intenta de nuevo.'))
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
      toast.success('Cerramos tus sesiones en los demás dispositivos.')
    } catch (error) {
      toast.error(mensajeDeError(error, 'No se pudieron cerrar las sesiones. Intenta de nuevo.'))
    }
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
    if (!contrasenaFuerte(newPassword)) {
      setPasswordError('La nueva contraseña debe tener de 8 a 64 caracteres, con mayúscula, minúscula y número.')
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

    } catch (error) {
      setPasswordError(mensajeDeError(error, 'No se pudo cambiar la contraseña. Verifica tus datos.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="perfil-page fade-in">
      {/* Header */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Perfil administrativo</h1>
          <p className="dash-page-sub">Gestión de cuenta y seguridad</p>
        </div>
      </div>

      <div className="perfil-grid">
        {/* Left col */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Identity */}
          <div className="dash-card">
            <div className="perfil-section-head">
              <Shield size={14} />
              <p className="perfil-section-title">Identidad del operador</p>
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

            {/* Datos de solo lectura: se muestran como texto, no como campos que parecen editables */}
            <dl className="perfil-facts">
              <div>
                <dt>ID de administrador</dt>
                <dd>{user?.id_usuario ? `ADM-LZC-${String(user.id_usuario).padStart(3, '0')}` : '—'}</dd>
              </div>
              <div>
                <dt>Correo de acceso</dt>
                <dd>{user?.correo ?? '—'}</dd>
              </div>
            </dl>

          </div>

          {/* Security */}
          <div className="dash-card">
            <div className="perfil-section-head">
              <Key size={14} />
              <p className="perfil-section-title">Seguridad de la cuenta</p>
            </div>

            <div className="perfil-security-row perfil-security-row--active">
              <div className="perfil-security-left">
                <Shield size={18} className="perfil-shield-icon" />
                <div>
                  <p className="perfil-security-title">Autenticación en dos pasos (activa)</p>
                  <p className="perfil-security-sub">Protegida con un código enviado a tu correo</p>
                </div>
              </div>
            </div>

            <div className="perfil-security-row">
              <div>
                <p className="perfil-security-title">Contraseña principal</p>
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
                Actualizar clave
              </button>
            </div>
          </div>
        </div>

        {/* Right col — Devices */}
        <div className="dash-card perfil-devices-card">
          <div className="perfil-section-head">
            <Monitor size={14} />
            <p className="perfil-section-title">Dispositivos activos</p>
          </div>
          <p className="cfg-hint" style={{ marginTop: -6, marginBottom: 16 }}>
            Monitorea tus conexiones recientes y revoca accesos sospechosos.
          </p>

          {loading ? (
            <p className="cfg-hint" style={{ textAlign: 'center', padding: '20px' }}>Cargando sesiones…</p>
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
                    <p className="perfil-device-meta perfil-device-ua">
                      {sesion.dispositivo}
                    </p>
                    <p className="perfil-device-meta">Iniciada: {fecha}</p>
                  </div>
                  
                  <div className="perfil-device-right">
                    {sesion.es_sesion_actual ? (
                      <Badge variant="success">Actual</Badge>
                    ) : (
                      <button 
                        className="perfil-revoke" 
                        onClick={() => handleRevoke(sesion.id_sesion)}
                        title="Cerrar esta sesión remotamente"
                      >
                        <X size={12} aria-hidden="true" /> Desconectar
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
              Cerrar todas las demás sesiones
            </button>
          )}
        </div>
      </div>

      {/* MODAL PARA CAMBIO DE CONTRASEÑA */}
      {isPasswordModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-container modal-container--sm fade-in" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <h3 className="modal-title">Cambio de contraseña</h3>
                <p className="modal-subtitle">Actualización de seguridad</p>
              </div>
              <button className="modal-close-btn" onClick={() => setIsPasswordModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdatePassword}>
              <div className="modal-body" style={{ gap: 14 }}>
                {passwordError && (
                  <div className="perfil-msg perfil-msg--error" role="alert">
                    <AlertCircle size={16} aria-hidden="true" />
                    <span>{passwordError}</span>
                  </div>
                )}

                {passwordSuccess && (
                  <div className="perfil-msg perfil-msg--ok" role="status">
                    <CheckCircle size={16} aria-hidden="true" />
                    <span>{passwordSuccess}</span>
                  </div>
                )}

                <Input id="pass-actual" label="Contraseña actual *" type="password" autoComplete="current-password"
                  value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                <Input id="pass-nueva" label="Nueva contraseña *" type="password" autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres" hint="Con mayúscula, minúscula y número."
                  value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                <Input id="pass-confirmar" label="Confirmar nueva contraseña *" type="password" autoComplete="new-password"
                  placeholder="Repite la nueva contraseña"
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
              </div>

              <div className="modal-footer" style={{ justifyContent: 'flex-end', gap: 8 }}>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsPasswordModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
                  size="sm"
                  loading={isSubmitting}
                >
                  Guardar nueva clave
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}