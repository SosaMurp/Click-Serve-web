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
import TemaToggle from '@components/ui/TemaToggle'
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

// `corto` se lee bajo el ícono; `label` es el nombre completo (lector de pantalla y aviso flotante)
type NavItem = { to: string; icon: typeof LayoutDashboard; label: string; corto: string; badge?: 'validaciones' }
type NavGrupo = { titulo: string; items: NavItem[] }

const NAV: NavGrupo[] = [
  {
    titulo: 'Operación',
    items: [
      { to: '/dashboard',    icon: LayoutDashboard, label: 'Inicio', corto: 'Inicio' },
      { to: '/validaciones', icon: ShieldCheck,     label: 'Validaciones', corto: 'Validar', badge: 'validaciones' },
      { to: '/servicios',    icon: ClipboardList,   label: 'Servicios', corto: 'Servicios' },
      { to: '/mapa',         icon: Map,             label: 'Mapa en vivo', corto: 'Mapa' },
    ],
  },
  {
    titulo: 'Personas y dinero',
    items: [
      { to: '/tecnicos', icon: Users,         label: 'Técnicos y clientes', corto: 'Usuarios' },
      { to: '/soporte',  icon: MessageSquare, label: 'Soporte', corto: 'Soporte' },
      { to: '/finanzas', icon: DollarSign,    label: 'Finanzas', corto: 'Finanzas' },
    ],
  },
  {
    titulo: 'Panel',
    items: [
      { to: '/administradores', icon: UserCog,  label: 'Administradores', corto: 'Admins' },
      { to: '/configuracion',   icon: Settings, label: 'Configuración', corto: 'Ajustes' },
    ],
  },
]
const TODAS = NAV.flatMap(g => g.items)

/** Cierra un menú desplegable al hacer clic fuera o pulsar Escape */
function useCierreFuera(abierto: boolean, ref: React.RefObject<HTMLElement | null>, cerrar: () => void) {
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) cerrar() }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar() }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [abierto, ref, cerrar])
}

export default function DashboardLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const enPerfil = pathname === '/perfil'
  const seccion = enPerfil ? 'Mi perfil' : TODAS.find(i => pathname.startsWith(i.to))?.label ?? 'Panel'
  const user = useAuthStore(s => s.user)
  const pend = usePendientes().data
  const pendientes = pend?.validaciones ?? 0

  // ── Pendientes: lo que espera una decisión del administrador ──
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)
  const porAtender: { label: string; n: number; to: string; state?: { seccion: string } }[] = [
    { label: 'Técnicos por validar', n: pend?.validaciones ?? 0, to: '/validaciones' },
    { label: 'Retiros por autorizar', n: pend?.retiros ?? 0, to: '/finanzas' },
    { label: 'Incidencias abiertas', n: pend?.incidencias ?? 0, to: '/soporte' },
    { label: 'Tickets sin responder', n: pend?.tickets ?? 0, to: '/soporte', state: { seccion: 'tickets' } },
  ]
  const totalPorAtender = porAtender.reduce((s, p) => s + p.n, 0)
  useCierreFuera(bellOpen, bellRef, useCallback(() => setBellOpen(false), []))

  // ── Menú de la cuenta: perfil y la única salida del panel ──
  const [userOpen, setUserOpen] = useState(false)
  const userRef = useRef<HTMLDivElement>(null)
  useCierreFuera(userOpen, userRef, useCallback(() => setUserOpen(false), []))

  const handleLogout = () => { setUserOpen(false); void cerrarSesion() }

  // Cierre automático tras VITE_SESSION_TIMEOUT minutos sin actividad (RNF-05)
  const porInactividad = useCallback(() => {
    void cerrarSesion({ motivo: `Cerramos tu sesión tras ${env.VITE_SESSION_TIMEOUT} minutos sin actividad.` })
  }, [])
  useInactividad(env.VITE_SESSION_TIMEOUT, porInactividad)

  const fullName = user ? `${user.nombre} ${user.apellido}` : 'Administrador'
  const iniciales = user ? `${user.nombre?.[0] ?? ''}${user.apellido?.[0] ?? ''}`.toUpperCase() || 'A' : 'A'

  return (
    <div className="mx-root">
      <NetworkStatusBanner />

      {/* ── MENÚ LATERAL (angosto: ícono y nombre corto) ── */}
      <aside className="mx-rail" aria-label="Menú principal">
        <span className="mx-rail-logo" title="Click & Serve · Panel de administración"><LogoMark size={26} /></span>

        <nav className="mx-rail-nav" aria-label="Secciones">
          {NAV.map(g => (
            <div key={g.titulo} className="mx-rail-group" role="group" aria-label={g.titulo}>
              {g.items.map(({ to, icon: Icon, label, corto, badge }) => (
                <NavLink key={to} to={to} end aria-label={label}
                  className={({ isActive }) => `mx-rl ${isActive ? 'mx-rl--on' : ''}`}>
                  <span className="mx-rl-ico">
                    <Icon size={19} aria-hidden />
                    {badge === 'validaciones' && pendientes > 0 && <span className="mx-rl-badge">{pendientes > 99 ? '99+' : pendientes}</span>}
                  </span>
                  <span className="mx-rl-text" aria-hidden>{corto}</span>
                  {corto !== label && <span className="mx-rl-tip" aria-hidden>{label}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="mx-account" ref={userRef}>
          <button type="button" className={`mx-rail-acct ${enPerfil ? 'mx-rail-acct--on' : ''}`} aria-haspopup="menu"
            aria-expanded={userOpen} aria-label={`Mi cuenta: ${fullName}`} onClick={() => setUserOpen(o => !o)}>
            <span className="mx-avatar">{iniciales}</span>
            <span className="mx-rl-text" aria-hidden>Cuenta</span>
          </button>
          {userOpen && (
            <div className="mx-account-menu" role="menu">
              <div className="mx-account-head">
                <span className="mx-avatar">{iniciales}</span>
                <span className="mx-account-who">
                  <span className="mx-account-name">{fullName}</span>
                  <span className="mx-account-mail">{user?.correo ?? 'Administrador'}</span>
                </span>
              </div>
              <button type="button" role="menuitem" className="mx-account-item" onClick={() => { setUserOpen(false); navigate('/perfil') }}>
                <UserRound size={16} aria-hidden /> Mi perfil y seguridad
              </button>
              <button type="button" role="menuitem" className="mx-account-item mx-account-item--out" onClick={handleLogout}>
                <LogOut size={16} aria-hidden /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── ÁREA DE TRABAJO ── */}
      <div className="mx-main">
        <header className="mx-top">
          <p className="mx-crumb"><span>Panel</span><span aria-hidden>/</span><strong>{seccion}</strong></p>

          <div className="mx-top-right">
            <TemaToggle />
            <div className="mx-pend" ref={bellRef}>
              <button type="button" className={`mx-pend-btn ${totalPorAtender > 0 ? 'mx-pend-btn--on' : ''}`} aria-haspopup="menu" aria-expanded={bellOpen}
                aria-label={totalPorAtender > 0 ? `Pendientes: ${totalPorAtender} por atender` : 'Pendientes: todo al día'}
                onClick={() => setBellOpen(o => !o)}>
                <Bell size={16} aria-hidden />
                <span className="mx-pend-text" aria-hidden>Pendientes</span>
                <span className="mx-pend-n" aria-hidden>{totalPorAtender > 99 ? '99+' : totalPorAtender}</span>
              </button>
              {bellOpen && (
                <div className="mx-pend-menu" role="menu">
                  <p className="mx-pend-title">Por atender</p>
                  {totalPorAtender === 0 && <p className="mx-pend-empty">Todo al día: no hay nada pendiente.</p>}
                  {porAtender.map(p => (
                    <button key={p.label} type="button" role="menuitem" className={`mx-pend-item ${p.n === 0 ? 'mx-pend-item--zero' : ''}`}
                      onClick={() => { setBellOpen(false); navigate(p.to, p.state ? { state: p.state } : undefined) }}>
                      <span className="mx-pend-count">{p.n}</span>{p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-content dash-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
