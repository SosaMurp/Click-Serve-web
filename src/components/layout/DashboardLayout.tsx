import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@store/authStore'
import {
  LayoutDashboard, ShieldCheck, Users, Map, DollarSign,
  Settings, Bell, Search, ChevronDown, LogOut, Menu, X, MessageSquare
} from 'lucide-react'
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

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault()
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={`dash-root ${collapsed ? 'dash-root--collapsed' : ''}`}>
      {/* ── SIDEBAR ── */}
      <aside className="dash-sidebar">
        <div className="dash-sidebar-brand">
          <div className="dash-logo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          {!collapsed && (
            <div>
              <p className="dash-brand-name">Click&amp;Serve</p>
              <p className="dash-brand-sub">ADMIN / NODO LZC</p>
            </div>
          )}
          <button className="dash-collapse-btn" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <Menu size={15} /> : <X size={15} />}
          </button>
        </div>

        <nav className="dash-nav">
          <p className="dash-nav-section">PRINCIPAL</p>
          {NAV_ITEMS.map(({ to, icon: Icon, label, badge }) => (
            <NavLink key={to} to={to} end className={({ isActive }) => `dash-nav-link ${isActive ? 'dash-nav-link--active' : ''}`}>
              <Icon size={16} />
              {!collapsed && <span>{label}</span>}
              {!collapsed && badge && <span className="dash-badge">{badge}</span>}
            </NavLink>
          ))}

          <p className="dash-nav-section" style={{ marginTop: 20 }}>ADMINISTRACIÓN</p>
          {NAV_SECONDARY.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `dash-nav-link ${isActive ? 'dash-nav-link--active' : ''}`}>
              <Icon size={16} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <NavLink to="/perfil" className={({ isActive }) => `dash-sidebar-user ${isActive ? 'dash-sidebar-user--active' : ''}`}>
          <div className="dash-avatar">A</div>
          {!collapsed && (
            <div className="dash-user-info">
              <p className="dash-user-name">{user ? `${user.nombre} ${user.apellido}` : 'Admin LZC'}</p>
              <p className="dash-user-role">{user?.id_rol === 1 ? 'Superadministrador' : 'Administrador'}</p>
            </div>
          )}
          {!collapsed && (
            <button className="dash-logout" onClick={handleLogout}>
              <LogOut size={14} />
            </button>
          )}
        </NavLink>
      </aside>

      {/* ── TOPBAR + CONTENT ── */}
      <div className="dash-main">
        <header className="dash-topbar">
          <div className="dash-search">
            <Search size={14} />
            <input placeholder="Buscar técnico, cliente o # de servicio (Ctrl+K)" />
          </div>
          <div className="dash-topbar-right">
            <p className="dash-topbar-date">16 FEB 2026 • 10:13 AM</p>
            <button className="dash-notif-btn">
              <Bell size={16} />
              <span className="dash-notif-dot" />
            </button>
            <div className="dash-topbar-user">
              <div className="dash-avatar dash-avatar--sm">A</div>
              <ChevronDown size={12} />
            </div>
          </div>
        </header>

        <main className="dash-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
