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
import { useDashboardStats } from '@hooks/useDashboard'
import api from '@api/axios'
import TechProfileModal from '@components/modals/TechProfileModal'
import { useWithdrawals, useIncidencias, useTickets } from '@hooks/useAdminQueries'
import { LogoMark } from '@components/ui/Logo'
import type { RecentService } from '@/types/dashboard'
import './dashboard-layout.css'

// "SRV-108", "srv108", "#108" o un número corto → búsqueda por servicio
const SERVICE_CODE = /^(?:srv-?|#)?(\d{1,6})$/i

// Resultados de la búsqueda global segmentados por tipo (RF-44)
type Segmento = 'todos' | 'tecnicos' | 'clientes' | 'servicios'
const SEGMENTOS: { id: Segmento; label: string }[] = [
  { id: 'todos', label: 'Todos' }, { id: 'tecnicos', label: 'Técnicos' },
  { id: 'clientes', label: 'Clientes' }, { id: 'servicios', label: 'Servicios' },
]
interface Persona { id_usuario: number; nombre: string; apellido: string; correo: string; telefono: string | null }
interface Hallazgo { id_solicitud: number; folio: string; estado: string; categoria: string | null; cliente: string; tecnico: string }
interface Hallazgos { tecnicos: Persona[]; clientes: Persona[]; servicios: Hallazgo[] }

const NAV_ITEMS = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard',            badge: null },
  { to: '/validaciones',  icon: ShieldCheck,     label: 'Validaciones',         badge: 'validaciones' },
  { to: '/tecnicos',      icon: Users,           label: 'Técnicos y usuarios',  badge: null },
  { to: '/soporte',       icon: MessageSquare,   label: 'Soporte y tickets',    badge: null },
  { to: '/mapa',          icon: Map,             label: 'Mapa en vivo',         badge: null },
  { to: '/finanzas',      icon: DollarSign,      label: 'Finanzas y retiros',   badge: null },
  { to: '/configuracion', icon: Settings,        label: 'Configuración',        badge: null },
]

export default function DashboardLayout() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  // Pendientes reales de validación (antes era un 3 fijo)
  const pendientes = useDashboardStats().data?.validaciones_pendientes ?? 0

  // ── Campana: lo que espera una decisión del administrador ──
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)
  const retiros = useWithdrawals('Pendiente').data?.length ?? 0
  const incidencias = useIncidencias('ABIERTA').data?.length ?? 0
  const ticketsSinResponder = (useTickets('ACTIVOS').data ?? []).filter(t => !t.ultimo_es_asesor).length
  const porAtender = [
    { label: 'Técnicos por validar', n: pendientes, to: '/validaciones' },
    { label: 'Retiros por autorizar', n: retiros, to: '/finanzas' },
    { label: 'Incidencias abiertas', n: incidencias, to: '/soporte' },
    { label: 'Tickets sin responder', n: ticketsSinResponder, to: '/soporte' },
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
    logout()
    navigate('/login', { replace: true })
  }

  // ── Buscador global (RF-44) ──
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [foundService, setFoundService] = useState<RecentService | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [segmento, setSegmento] = useState<Segmento>('todos')
  const [hallazgos, setHallazgos] = useState<Hallazgos | null>(null)
  const [listaAbierta, setListaAbierta] = useState(false)
  const [perfilId, setPerfilId] = useState<number | null>(null)

  // Mientras se escribe se buscan técnicos, clientes y servicios (con una pausa para no consultar en cada letra)
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setHallazgos(null); return }
    let vigente = true
    const t = window.setTimeout(async () => {
      try {
        const { data } = await api.get<Hallazgos>('/admin/buscar', { params: { q, tipo: segmento } })
        if (vigente) { setHallazgos(data); setListaAbierta(true) }
      } catch {
        if (vigente) setHallazgos(null)
      }
    }, 250)
    return () => { vigente = false; window.clearTimeout(t) }
  }, [query, segmento])

  useEffect(() => {
    if (!listaAbierta) return
    const fuera = (e: MouseEvent) => { if (!formRef.current?.contains(e.target as Node)) setListaAbierta(false) }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [listaAbierta])

  const abrirServicio = async (id: number) => {
    setListaAbierta(false)
    try {
      setFoundService(await getServicioById(id))
      setQuery('')
    } catch {
      setSearchError('No se pudo abrir el servicio')
    }
  }
  const abrirPersona = (id: number) => { setListaAbierta(false); setPerfilId(id) }
  const totalHallazgos = hallazgos ? hallazgos.tecnicos.length + hallazgos.clientes.length + hallazgos.servicios.length : 0

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
          <div className="dash-logo" title="Click & Serve · Panel de administración">
            <LogoMark size={30} />
          </div>
          <form className="dash-search" role="search" onSubmit={handleSearch} ref={formRef}>
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
            {listaAbierta && hallazgos && !searchError && (
              <div className="dash-search-results" aria-label="Resultados de la búsqueda">
                <div className="dash-search-tabs">
                  {SEGMENTOS.map(s => (
                    <button type="button" key={s.id} className={`dash-search-tab ${segmento === s.id ? 'dash-search-tab--active' : ''}`}
                      onClick={() => setSegmento(s.id)}>{s.label}</button>
                  ))}
                </div>
                {totalHallazgos === 0 && <p className="dash-search-empty">Sin resultados para «{query.trim()}».</p>}
                {([['Técnicos', hallazgos.tecnicos], ['Clientes', hallazgos.clientes]] as const).map(([titulo, lista]) => lista.length > 0 && (
                  <div key={titulo}>
                    <p className="dash-search-group">{titulo}</p>
                    {lista.map(u => (
                      <button type="button" key={u.id_usuario} className="dash-search-item" onClick={() => abrirPersona(u.id_usuario)}>
                        <span className="dash-search-item-title">{u.nombre} {u.apellido}</span>
                        <span className="dash-search-item-sub">ID-{u.id_usuario} · {u.correo}</span>
                      </button>
                    ))}
                  </div>
                ))}
                {hallazgos.servicios.length > 0 && (
                  <div>
                    <p className="dash-search-group">Servicios</p>
                    {hallazgos.servicios.map(s => (
                      <button type="button" key={s.id_solicitud} className="dash-search-item" onClick={() => abrirServicio(s.id_solicitud)}>
                        <span className="dash-search-item-title">{s.folio} · {s.categoria ?? 'Servicio'}</span>
                        <span className="dash-search-item-sub">{s.estado} · {s.cliente.trim() || 'Sin cliente'}{s.tecnico.trim() ? ` → ${s.tecnico.trim()}` : ''}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </form>
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
                    onClick={() => { setBellOpen(false); navigate(p.to) }}>
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

      <TechProfileModal isOpen={perfilId != null} onClose={() => setPerfilId(null)} userId={perfilId} />

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
