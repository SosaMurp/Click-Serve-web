import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@store/authStore'
import {
  LayoutDashboard, ShieldCheck, Users, Map, DollarSign,
  Settings, Bell, Search, ChevronDown, LogOut, X, MessageSquare, Download
} from 'lucide-react'
import ReportGeneratorModal from '@components/modals/ReportGeneratorModal'
import { NetworkStatusBanner } from '@components/ui/NetworkStatusBanner'
import './dashboard-layout.css'

const NAV_ITEMS = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard',           badge: null },
  { to: '/validaciones', icon: ShieldCheck,     label: 'Validaciones',        badge: '3' },
  { to: '/tecnicos',     icon: Users,           label: 'Técnicos & Usuarios', badge: null },
  { to: '/soporte',      icon: MessageSquare,   label: 'Soporte & Tickets',   badge: null },
  { to: '/mapa',         icon: Map,             label: 'Mapa LZC (Live)',     badge: null },
]
const NAV_SECONDARY = [
  { to: '/finanzas',       icon: DollarSign,  label: 'Finanzas & Retiros' },
  { to: '/configuracion',  icon: Settings,    label: 'Configuración Global' },
]

export default function DashboardLayout() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={`dash-root ${collapsed ? 'dash-root--collapsed' : ''}`}>
      {/* Banner de Estado de Red (RNF-19, RNF-28) */}
      <NetworkStatusBanner />

      {/* ── SIDEBAR ── */}
      <aside className="dash-sidebar">
        <div
          className="dash-sidebar-brand"
          onClick={() => collapsed && setCollapsed(false)}
          style={{ cursor: collapsed ? 'pointer' : 'default' }}
          title={collapsed ? "Expandir menú lateral" : undefined}
        >
          <div className="dash-logo" title={collapsed ? "Expandir menú lateral" : "Click&Serve Admin"}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          {!collapsed && (
            <div className="dash-brand-info">
              <p className="dash-brand-name">Click&amp;Serve</p>
              <p className="dash-brand-sub">ADMIN / NODO LZC</p>
            </div>
          )}
          {!collapsed && (
            <button
              className="dash-collapse-btn"
              onClick={(e) => { e.stopPropagation(); setCollapsed(true); }}
              title="Colapsar menú"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <nav className="dash-nav">
          <p className="dash-nav-section">PRINCIPAL</p>
          {NAV_ITEMS.map(({ to, icon: Icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              end
              title={label}
              className={({ isActive }) => `dash-nav-link ${isActive ? 'dash-nav-link--active' : ''}`}
            >
              <Icon size={16} />
              <span>{label}</span>
              {badge && <span className="dash-badge">{badge}</span>}
            </NavLink>
          ))}

          <p className="dash-nav-section" style={{ marginTop: 20 }}>ADMINISTRACIÓN</p>
          {NAV_SECONDARY.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              className={({ isActive }) => `dash-nav-link ${isActive ? 'dash-nav-link--active' : ''}`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Perfil & Logout Transversal (RF-01, RF-86) */}
        <NavLink
          to="/perfil"
          title={user ? `${user.nombre} ${user.apellido} (Perfil)` : 'Perfil Administrador'}
          className={({ isActive }) => `dash-sidebar-user ${isActive ? 'dash-sidebar-user--active' : ''}`}
        >
          <div className="dash-avatar">{user?.nombre ? user.nombre[0] : 'A'}</div>
          <div className="dash-user-info">
            <p className="dash-user-name">{user ? `${user.nombre} ${user.apellido}` : 'Admin LZC'}</p>
            <p className="dash-user-role">{user?.id_rol === 1 ? 'Superadministrador' : 'Administrador'}</p>
          </div>
          <button className="dash-logout" title="Cerrar Sesión Global (RF-01)" onClick={handleLogout}>
            <LogOut size={14} />
          </button>
        </NavLink>
      </aside>

      {/* ── TOPBAR + CONTENT ── */}
      <div className="dash-main">
        <header className="dash-topbar">
          <div className="dash-search">
            <Search size={14} />
            <input placeholder="Buscar técnico, cliente o # de servicio (Ctrl+K) (RF-44)" />
          </div>
          <div className="dash-topbar-right">
            <button
              onClick={() => setIsReportOpen(true)}
              style={{ padding: '6px 12px', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,.85)' }}
            >
              <Download size={13} /> EXPORTAR REPORTE (RF-93)
            </button>

            <p className="dash-topbar-date">16 FEB 2026 • 10:13 AM</p>

            <button className="dash-notif-btn" title="Alertas de Sistema (RF-89)">
              <Bell size={16} />
              <span className="dash-notif-dot" />
            </button>

            <div className="dash-topbar-user" style={{ cursor: 'pointer' }} onClick={() => navigate('/perfil')}>
              <div className="dash-avatar dash-avatar--sm">{user?.nombre ? user.nombre[0] : 'A'}</div>
              <ChevronDown size={12} />
            </div>
          </div>
        </header>

        <main className="dash-content">
          <Outlet />
        </main>
      </div>

      <ReportGeneratorModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
      />
    </div>
  )
}
