import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@store/authStore'
import {
  LayoutDashboard, ShieldCheck, Users, Map, DollarSign,
  Settings, Bell, Search, ChevronDown, LogOut, MessageSquare
} from 'lucide-react'
import { NetworkStatusBanner } from '@components/ui/NetworkStatusBanner'
import ServiceDetailModal from '@components/modals/ServiceDetailModal'
import { getServicioById } from '@api/servicios'
import type { RecentService } from '@/types/dashboard'
import './dashboard-layout.css'

// "SRV-108", "srv108", "#108" o un número corto → búsqueda por servicio
const SERVICE_CODE = /^(?:srv-?|#)?(\d{1,6})$/i

const NAV_ITEMS = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard',            badge: null },
  { to: '/validaciones',  icon: ShieldCheck,     label: 'Validaciones',         badge: '3' },
  { to: '/tecnicos',      icon: Users,           label: 'Técnicos y usuarios',  badge: null },
  { to: '/soporte',       icon: MessageSquare,   label: 'Soporte y tickets',    badge: null },
  { to: '/mapa',          icon: Map,             label: 'Mapa en vivo',         badge: null },
  { to: '/finanzas',      icon: DollarSign,      label: 'Finanzas y retiros',   badge: null },
  { to: '/configuracion', icon: Settings,        label: 'Configuración',        badge: null },
]

export default function DashboardLayout() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    logout()
    navigate('/login', { replace: true })
  }

  // ── Buscador global (RF-44) ──
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [foundService, setFoundService] = useState<RecentService | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setSearchError('')

    const code = q.match(SERVICE_CODE)
    if (code) {
      setSearching(true)
      try {
        setFoundService(await getServicioById(Number(code[1])))
        setQuery('')
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status
        setSearchError(status === 404 ? `No existe el servicio SRV-${code[1].padStart(3, '0')}` : 'No se pudo buscar el servicio')
      } finally {
        setSearching(false)
      }
      return
    }

    // Nombre o correo: se pasa por el estado de navegación para no dejarlo en la URL
    navigate('/tecnicos', { state: { q } })
    setQuery('')
    searchRef.current?.blur()
  }

  const fullName = user ? `${user.nombre} ${user.apellido}` : 'Administrador'

  return (
    <div className="dash-root">
      {/* Banner de Estado de Red (RNF-19, RNF-28) */}
      <NetworkStatusBanner />

      {/* ── TOPBAR ── */}
      <header className="dash-topbar">
        <div className="dash-topbar-left">
          <div className="dash-logo" title="Click&Serve Admin">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <form className="dash-search" role="search" onSubmit={handleSearch}>
            <Search size={15} />
            <input
              ref={searchRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setSearchError('') }}
              onKeyDown={e => { if (e.key === 'Escape') { setQuery(''); setSearchError(''); e.currentTarget.blur() } }}
              placeholder="Buscar técnico, cliente o SRV-108"
              aria-label="Buscar técnico, cliente o servicio"
            />
            {searching
              ? <span className="dash-search-spin" aria-label="Buscando" />
              : <kbd className="dash-search-kbd">Ctrl K</kbd>}
            {searchError && <p className="dash-search-error" role="alert">{searchError}</p>}
          </form>
        </div>

        <div className="dash-topbar-right">
          <button className="dash-notif-btn" title="Alertas del sistema">
            <Bell size={16} />
            <span className="dash-notif-dot" />
          </button>
          <div className="dash-topbar-user" onClick={() => navigate('/perfil')}>
            <div className="dash-avatar">{user?.nombre ? user.nombre[0] : 'A'}</div>
            <div className="dash-user-info">
              <p className="dash-user-name">{fullName}</p>
              <p className="dash-user-role">{user?.id_rol === 1 ? 'Superadministrador' : 'Administrador'}</p>
            </div>
            <ChevronDown size={14} />
          </div>
        </div>
      </header>

      <div className="dash-body">
        {/* ── RAIL DE NAVEGACIÓN ── */}
        <aside className="dash-rail">
          <nav className="dash-rail-group">
            {NAV_ITEMS.map(({ to, icon: Icon, label, badge }) => (
              <NavLink
                key={to}
                to={to}
                end
                aria-label={label}
                className={({ isActive }) => `dash-rail-link ${isActive ? 'dash-rail-link--active' : ''}`}
              >
                <Icon size={18} />
                {badge && <span className="dash-rail-badge">{badge}</span>}
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

      {foundService && (
        <ServiceDetailModal
          key={foundService.id_servicio}
          isOpen
          onClose={() => setFoundService(null)}
          serviceId={foundService.id_servicio}
          title={foundService.titulo}
          clientName={`${foundService.cliente_nombre ?? ''} ${foundService.cliente_apellido ?? ''}`.trim() || 'Sin cliente'}
          techName={foundService.tecnico_nombre ? `${foundService.tecnico_nombre} ${foundService.tecnico_apellido ?? ''}` : 'Sin asignar'}
          status={foundService.estatus}
        />
      )}
    </div>
  )
}
