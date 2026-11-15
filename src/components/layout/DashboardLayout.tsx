import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@store/authStore'
import {
  LayoutDashboard, ShieldCheck, Users, ClipboardList, Map, DollarSign,
  Settings, Bell, ChevronDown, LogOut, MessageSquare,
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

const NAV_ITEMS = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard',           badge: null },
  { to: '/validaciones',  icon: ShieldCheck,     label: 'Validaciones',        badge: 'validaciones' },
  { to: '/tecnicos',      icon: Users,           label: 'Técnicos y usuarios', badge: null },
  { to: '/servicios',     icon: ClipboardList,   label: 'Servicios',           badge: null },
  { to: '/soporte',       icon: MessageSquare,   label: 'Soporte',             badge: null },
  { to: '/mapa',          icon: Map,             label: 'Mapa en vivo',        badge: null },
  { to: '/finanzas',      icon: DollarSign,      label: 'Finanzas',            badge: null },
  { to: '/configuracion', icon: Settings,        label: 'Configuración',       badge: null },
]

export default function DashboardLayout() {
  const navigate = useNavigate()
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

  useEffect(() => {
    if (!bellOpen) return
    const fuera = (e: MouseEvent) => { if (!bellRef.current?.contains(e.target as Node)) setBellOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setBellOpen(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [bellOpen])

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    void cerrarSesion()
  }

  // Cierre automático tras VITE_SESSION_TIMEOUT minutos sin actividad (RNF-05)
  const porInactividad = useCallback(() => {
    void cerrarSesion({ motivo: `Cerramos tu sesión tras ${env.VITE_SESSION_TIMEOUT} minutos sin actividad.` })
  }, [])
  useInactividad(env.VITE_SESSION_TIMEOUT, porInactividad)

  const fullName = user ? `${user.nombre} ${user.apellido}` : 'Administrador'

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
            <button className="dash-notif-btn" title="Pendientes" aria-haspopup="true" aria-expanded={bellOpen}
              aria-label={totalPorAtender > 0 ? `Pendientes: ${totalPorAtender} por atender` : 'Pendientes: todo al día'}
              onClick={() => setBellOpen(o => !o)}>
              <Bell size={16} />
              {totalPorAtender > 0 && <span className="dash-notif-dot" />}
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
          <div className="dash-topbar-user" role="button" tabIndex={0} aria-label="Mi perfil" onClick={() => navigate('/perfil')}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/perfil') } }}>
            <div className="dash-avatar">{user?.nombre ? user.nombre[0] : 'A'}</div>
            <div className="dash-user-info">
              <p className="dash-user-name">{fullName}</p>
              <p className="dash-user-role">Administrador</p>
            </div>
            <ChevronDown size={14} />
          </div>
        </div>
      </header>

      <div className="dash-body">
        {/* ── RAIL DE NAVEGACIÓN ── */}
        <aside className="dash-rail">
          <nav className="dash-rail-group" aria-label="Secciones">
            {NAV_ITEMS.map(({ to, icon: Icon, label, badge }) => (
              <NavLink
                key={to}
                to={to}
                end
                aria-label={label}
                className={({ isActive }) => `dash-rail-link ${isActive ? 'dash-rail-link--active' : ''}`}
              >
                <Icon size={18} />
                {badge === 'validaciones' && pendientes > 0 && <span className="dash-rail-badge">{pendientes > 99 ? '99+' : pendientes}</span>}
                <span className="dash-rail-tip">{label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Logout Transversal (RF-01) */}
          <div className="dash-rail-group">
            <button className="dash-rail-link" aria-label="Cerrar sesión" onClick={handleLogout}>
              <LogOut size={18} />
              <span className="dash-rail-tip">Cerrar sesión</span>
            </button>
          </div>
        </aside>

        <main className="dash-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
