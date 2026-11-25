import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@store/authStore'
import {
  LayoutDashboard, ShieldCheck, Users, ClipboardList, Map, DollarSign,
  Settings, Bell, LogOut, MessageSquare, UserCog, UserRound,
} from 'lucide-react'
import { NetworkStatusBanner } from '@components/ui/NetworkStatusBanner'
import { usePendientes } from '@hooks/useDashboard'
import { LogoMark } from '@components/ui/Logo'
import { cerrarSesion } from '@/lib/sesion'
import { useInactividad } from '@hooks/useInactividad'
import { env } from '@/config/env'
import './dashboard-layout.css'
// Estas hojas definen clases que usan varias páginas (encabezados, tablas, pestañas, barras de búsqueda…).
// Se cargan con el layout —no con cada página— para que cualquier ruta se vea bien aunque se abra directamente.
// El orden es el de siempre, porque unas reglas se apoyan en otras.
import '@pages/dashboard/dashboard.css'
import '@pages/validaciones/validaciones.css'
import '@pages/tecnicos/tecnicos.css'
import '@pages/finanzas/finanzas.css'
import '@pages/configuracion/configuracion.css'
import '@pages/soporte/soporte.css'

// `corto` es lo que se lee bajo el ícono; `label` es el nombre completo (lector de pantalla y aviso flotante)
type NavItem = { to: string; icon: typeof LayoutDashboard; label: string; corto: string; badge?: 'validaciones' }

// La operación diaria arriba; lo que solo toca la administración del panel, en un grupo aparte
const NAV_OPERACION: NavItem[] = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Inicio',              corto: 'Inicio' },
  { to: '/validaciones', icon: ShieldCheck,     label: 'Validaciones',        corto: 'Validar', badge: 'validaciones' },
  { to: '/servicios',    icon: ClipboardList,   label: 'Servicios',           corto: 'Servicios' },
  { to: '/mapa',         icon: Map,             label: 'Mapa en vivo',        corto: 'Mapa' },
  { to: '/tecnicos',     icon: Users,           label: 'Técnicos y clientes', corto: 'Usuarios' },
  { to: '/soporte',      icon: MessageSquare,   label: 'Soporte',             corto: 'Soporte' },
  { to: '/finanzas',     icon: DollarSign,      label: 'Finanzas',            corto: 'Finanzas' },
]
const NAV_ADMIN: NavItem[] = [
  { to: '/administradores', icon: UserCog,  label: 'Administradores', corto: 'Admins' },
  { to: '/configuracion',   icon: Settings, label: 'Configuración',   corto: 'Ajustes' },
]

export default function DashboardLayout() {
  const navigate = useNavigate()
  const enPerfil = useLocation().pathname === '/perfil'
  const user = useAuthStore(s => s.user)
  const pend = usePendientes().data
  const pendientes = pend?.validaciones ?? 0

  // ── Campana: lo que espera una decisión del administrador ──
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)
  const porAtender: { label: string; n: number; to: string; state?: { seccion: string } }[] = [
    { label: 'Técnicos por validar', n: pend?.validaciones ?? 0, to: '/validaciones' },
    { label: 'Retiros por autorizar', n: pend?.retiros ?? 0, to: '/finanzas' },
    { label: 'Incidencias abiertas', n: pend?.incidencias ?? 0, to: '/soporte' },
    { label: 'Tickets sin responder', n: pend?.tickets ?? 0, to: '/soporte', state: { seccion: 'tickets' } },
  ]
  const totalPorAtender = porAtender.reduce((s, p) => s + p.n, 0)

  // ── Menú de la cuenta (abajo del menú lateral): perfil y la única salida del panel ──
  const [userOpen, setUserOpen] = useState(false)
  const userRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!userOpen) return
    const fuera = (e: MouseEvent) => { if (!userRef.current?.contains(e.target as Node)) setUserOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setUserOpen(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [userOpen])

  useEffect(() => {
    if (!bellOpen) return
    const fuera = (e: MouseEvent) => { if (!bellRef.current?.contains(e.target as Node)) setBellOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setBellOpen(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [bellOpen])

  const handleLogout = () => { setUserOpen(false); void cerrarSesion() }

  // Cierre automático tras VITE_SESSION_TIMEOUT minutos sin actividad (RNF-05)
  const porInactividad = useCallback(() => {
    void cerrarSesion({ motivo: `Cerramos tu sesión tras ${env.VITE_SESSION_TIMEOUT} minutos sin actividad.` })
  }, [])
  useInactividad(env.VITE_SESSION_TIMEOUT, porInactividad)

  const fullName = user ? `${user.nombre} ${user.apellido}` : 'Administrador'
  const iniciales = user ? `${user.nombre?.[0] ?? ''}${user.apellido?.[0] ?? ''}`.toUpperCase() || 'A' : 'A'

  const enlace = ({ to, icon: Icon, label, corto, badge }: NavItem) => (
    <NavLink key={to} to={to} end aria-label={label}
      className={({ isActive }) => `dash-rail-link ${isActive ? 'dash-rail-link--active' : ''}`}>
      <span className="dash-rail-icon">
        <Icon size={18} aria-hidden />
        {badge === 'validaciones' && pendientes > 0 && <span className="dash-rail-badge">{pendientes > 99 ? '99+' : pendientes}</span>}
      </span>
      <span className="dash-rail-label" aria-hidden>{corto}</span>
      {corto !== label && <span className="dash-rail-tip" aria-hidden>{label}</span>}
    </NavLink>
  )

  return (
    <div className="dash-root">
      {/* Banner de Estado de Red (RNF-19, RNF-28) */}
      <NetworkStatusBanner />

      {/* ── TOPBAR ── */}
      <header className="dash-topbar">
        <div className="dash-topbar-left">
          <div className="dash-logo" title="Click & Serve · Panel de administración">
            <LogoMark size={30} />
          </div>
          <p className="dash-brand">Click &amp; Serve <span>Panel de administración</span></p>
        </div>

        <div className="dash-topbar-right">
          <div className="dash-notif-wrap" ref={bellRef}>
            <button type="button" className={`dash-notif-btn ${totalPorAtender > 0 ? 'dash-notif-btn--on' : ''}`} aria-haspopup="menu" aria-expanded={bellOpen}
              aria-label={totalPorAtender > 0 ? `Pendientes: ${totalPorAtender} por atender` : 'Pendientes: todo al día'}
              onClick={() => setBellOpen(o => !o)}>
              <Bell size={16} aria-hidden />
              <span className="dash-notif-text" aria-hidden>Pendientes</span>
              <span className="dash-notif-n" aria-hidden>{totalPorAtender > 99 ? '99+' : totalPorAtender}</span>
            </button>
            {bellOpen && (
              <div className="dash-notif-menu" role="menu">
                <p className="dash-notif-title">Por atender</p>
                {totalPorAtender === 0 && <p className="dash-notif-empty">Todo al día: no hay nada pendiente.</p>}
                {porAtender.map(p => (
                  <button key={p.label} role="menuitem" className={`dash-notif-item ${p.n === 0 ? 'dash-notif-item--zero' : ''}`}
                    onClick={() => { setBellOpen(false); navigate(p.to, p.state ? { state: p.state } : undefined) }}>
                    <span className="dash-notif-count">{p.n}</span>{p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="dash-body">
        {/* ── RAIL DE NAVEGACIÓN ── */}
        <aside className="dash-rail">
          <nav className="dash-rail-nav" aria-label="Secciones">
            <div className="dash-rail-group">{NAV_OPERACION.map(enlace)}</div>
            <div className="dash-rail-group" role="group" aria-label="Administración del panel">
              <p className="dash-rail-heading" aria-hidden>Panel</p>
              {NAV_ADMIN.map(enlace)}
            </div>
          </nav>

          {/* Cuenta: perfil y cierre de sesión en un solo lugar */}
          <div className="dash-account" ref={userRef}>
            <button type="button" className={`dash-account-btn ${enPerfil ? 'dash-account-btn--on' : ''}`} aria-haspopup="menu" aria-expanded={userOpen}
              aria-label={`Mi cuenta: ${fullName}`} onClick={() => setUserOpen(o => !o)}>
              <span className="dash-avatar">{iniciales}</span>
              <span className="dash-rail-label" aria-hidden>Cuenta</span>
            </button>
            {userOpen && (
              <div className="dash-account-menu" role="menu">
                <div className="dash-account-who">
                  <span className="dash-avatar dash-avatar--lg">{iniciales}</span>
                  <div className="dash-user-info">
                    <p className="dash-user-name">{fullName}</p>
                    <p className="dash-user-role">{user?.correo ?? 'Administrador'}</p>
                  </div>
                </div>
                <button type="button" role="menuitem" className="dash-account-item" onClick={() => { setUserOpen(false); navigate('/perfil') }}>
                  <UserRound size={16} aria-hidden /> Mi perfil y seguridad
                </button>
                <button type="button" role="menuitem" className="dash-account-item dash-account-item--out" onClick={handleLogout}>
                  <LogOut size={16} aria-hidden /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </aside>

        <main className="dash-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
