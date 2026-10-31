import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Search, Star, ChevronLeft, ChevronRight, Filter, UserPlus } from 'lucide-react'
import { Badge } from '@components/ui'
import TechProfileModal from '@components/modals/TechProfileModal'
import AdvancedFiltersModal from '@components/modals/AdvancedFiltersModal'
import CoAdminModal from '@components/modals/CoAdminModal'
import './tecnicos.css'

import { useAdminUsers } from '../../hooks/useAdminQueries'

// Categorías de servicio de la app (tabla categorias_servicio)
const CATEGORIAS = ['Cómputo y redes', 'Electricidad', 'Plomería', 'Climatización', 'Línea blanca', 'Cerrajería', 'Pintura e impermeabilización', 'Mecánica automotriz']

// estado_cuenta de la app → etiqueta del filtro
function estadoLegible(estado?: string | null) {
  const e = (estado || '').toUpperCase()
  if (e === 'ACTIVO' || e === 'APROBADO') return 'ACTIVO'
  if (e === 'SUSPENDIDO' || e === 'RECHAZADO') return e
  return 'EN REVISIÓN'
}

export default function TecnicosPage() {
  const location = useLocation()
  const [tab, setTab] = useState<'tecnicos' | 'clientes' | 'admins'>('tecnicos')
  const [isCoAdminOpen, setIsCoAdminOpen] = useState(false)
  const [search, setSearch] = useState('')

  // Búsqueda enviada desde el buscador global de la barra superior
  useEffect(() => {
    const q = (location.state as { q?: string } | null)?.q
    if (q) setSearch(q)
  }, [location.key])
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [specFilter, setSpecFilter] = useState('ALL')
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const { data: usersData, isLoading, isError } = useAdminUsers({
    role: tab === 'tecnicos' ? '2' : tab === 'clientes' ? '1' : '3',
  })

  // Normalize API data to component structure
  const data = (usersData || []).map(u => ({
    id: `ID-${u.id_usuario}`,
    realId: u.id_usuario,
    name: `${u.nombre} ${u.apellido}`,
    phone: u.telefono,
    email: u.correo,
    specialty: u.especialidad || (tab === 'clientes' ? 'Cliente' : tab === 'admins' ? 'Administrador' : 'Sin especialidades'),
    status: estadoLegible(u.estado_cuenta),
    statusV: ['activo', 'aprobado'].includes(u.estado_cuenta?.toLowerCase() ?? '') ? 'success' : u.estado_cuenta?.toLowerCase() === 'suspendido' ? 'danger' : 'warning',
    rating: u.metricas?.calificacion || null,
    jobs: u.metricas?.trabajos ?? null
  }))

  const filtered = data.filter(r => {
    const s = search.toLowerCase()
    const matchSearch = !search || r.name.toLowerCase().includes(s) || r.id.toLowerCase().includes(s) || (r.email ?? '').toLowerCase().includes(s)
    const matchStatus = statusFilter === 'ALL' || r.status === statusFilter
    const matchSpec = specFilter === 'ALL' || r.specialty.includes(specFilter)
    return matchSearch && matchStatus && matchSpec
  })

  const handleOpenProfile = (row: any) => {
    setSelectedItem(row)
    setIsProfileOpen(true)
  }

  return (
    <div className="tec-page fade-in">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Directorio de Cuentas</h1>
          <p className="dash-page-sub">GESTIÓN DE RED LÁZARO CÁRDENAS</p>
        </div>
        <button className="fin-approve-batch" onClick={() => setIsCoAdminOpen(true)}>
          <UserPlus size={14} /> Nuevo coadministrador
        </button>
      </div>

      {/* Tabs (RF-37) */}
      <div className="tec-tabs">
        <button className={`tec-tab ${tab === 'tecnicos' ? 'tec-tab--active' : ''}`} onClick={() => setTab('tecnicos')}>
          PRESTADORES DE SERVICIO
        </button>
        <button className={`tec-tab ${tab === 'clientes' ? 'tec-tab--active' : ''}`} onClick={() => setTab('clientes')}>
          CLIENTES (USUARIOS)
        </button>
        <button className={`tec-tab ${tab === 'admins' ? 'tec-tab--active' : ''}`} onClick={() => setTab('admins')}>
          ADMINISTRADORES
        </button>
      </div>

      {/* Toolbar (RF-38, RF-39) */}
      <div className="val-toolbar">
        <div className="val-search">
          <Search size={14} />
          <input placeholder="Buscar por ID, nombre o correo..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="tec-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="ALL">Estado: Todo</option>
          <option value="ACTIVO">Activo</option>
          <option value="EN REVISIÓN">En revisión</option>
          <option value="RECHAZADO">Rechazado</option>
          <option value="SUSPENDIDO">Suspendido</option>
        </select>
        <select className="tec-select" value={specFilter} onChange={e => setSpecFilter(e.target.value)}>
          <option value="ALL">Especialidad: Todo</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="dash-export-btn" onClick={() => setIsFilterOpen(true)}>
          <Filter size={13} /> FILTROS AVANZADOS
        </button>
      </div>

      {/* Table */}
      <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando datos...</div>
        ) : isError ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>Error al cargar los datos</div>
        ) : (
          <table className="dash-table tec-table">
            <thead>
              <tr>
                <th>{tab === 'tecnicos' ? 'TÉCNICO / CONTACTO' : tab === 'clientes' ? 'CLIENTE / CONTACTO' : 'ADMINISTRADOR / CONTACTO'}</th>
                <th>ESPECIALIDAD PRINCIPAL</th>
                <th>ESTADO DE CUENTA</th>
                <th>MÉTRICAS</th>
                <th>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{textAlign: 'center', padding: '1rem'}}>No hay registros</td></tr>
              )}
              {filtered.map(row => (
                <tr key={row.id}>
                  <td>
                    <div className="val-tech-cell">
                      <div className="tec-avatar">{row.name[0]}</div>
                      <div>
                        <p className="dash-table-name">{row.name}</p>
                        <p className="dash-table-id">
                          {row.id}
                          {row.phone && <> · {row.phone}</>}
                          {row.email && <> · {row.email}</>}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td><span className="dash-table-spec">{row.specialty}</span></td>
                  <td>
                    <Badge variant={row.statusV as any}>▲ {row.status}</Badge>
                  </td>
                  <td>
                    {row.rating ? (
                      <div className="tec-rating">
                        <Star size={12} fill="currentColor" />
                        <strong>{row.rating}</strong>
                        <span>{row.jobs}</span>
                      </div>
                    ) : <span className="dash-table-id">Sin historial</span>}
                  </td>
                  <td>
                    <button className="tec-action-btn" onClick={() => handleOpenProfile(row)}>
                      VER PERFIL
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        <div className="tec-pagination">
          <p className="tec-page-info">MOSTRANDO {filtered.length} REGISTROS</p>
          <div className="tec-page-controls">
            <button className="tec-page-btn"><ChevronLeft size={13} /></button>
            {[1].map(n => (
              <button key={n} className={`tec-page-btn ${n === 1 ? 'tec-page-btn--active' : ''}`}>{n}</button>
            ))}
            <button className="tec-page-btn"><ChevronRight size={13} /></button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <TechProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        userId={selectedItem?.realId ?? null}
      />

      <CoAdminModal isOpen={isCoAdminOpen} onClose={() => setIsCoAdminOpen(false)} />

      <AdvancedFiltersModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApplyFilters={f => {
          if (f.status) setStatusFilter(f.status)
          if (f.specialty) setSpecFilter(f.specialty)
        }}
      />
    </div>
  )
}
