import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Shield, Key, Monitor, Smartphone, Globe, X } from 'lucide-react'
import { Badge } from '@components/ui'
import { getActiveSessions, revokeSession, revokeAllSessions } from '@api/auth'
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
  
  // Estados para manejar las sesiones reales
  const [sessions, setSessions] = useState<SesionActiva[]>([])
  const [loading, setLoading] = useState(true)

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

  // Cerrar sesión general (limpia localstorage y redirige)
  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    navigate('/login')
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
              <div className="perfil-avatar">AR</div>
              <div>
                <p className="perfil-name">Alejandro Ramírez</p>
                <span className="perfil-role-badge">SUPERADMINISTRADOR</span>
              </div>
            </div>

            <div className="perfil-fields-row">
              <div className="perfil-field">
                <label className="cfg-label">ID INSTITUCIONAL</label>
                <input className="perfil-input" value="ADM-LZC-001" readOnly />
              </div>
              <div className="perfil-field">
                <label className="cfg-label">CORREO DE ACCESO</label>
                <input className="perfil-input" value="admin.lzc@clickserve.com" readOnly />
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
                <p className="perfil-security-sub">Última actualización: hace 49 días</p>
              </div>
              <button className="perfil-action-btn">ACTUALIZAR CLAVE</button>
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
    </div>
  )
}