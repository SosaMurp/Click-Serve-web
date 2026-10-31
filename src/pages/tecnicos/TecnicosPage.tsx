import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Search, Star, Filter, UserPlus } from 'lucide-react'
import { Badge } from '@components/ui'
import TechProfileModal from '@components/modals/TechProfileModal'
import AdvancedFiltersModal from '@components/modals/AdvancedFiltersModal'
import CoAdminModal from '@components/modals/CoAdminModal'
import './tecnicos.css'

import { useAdminUsers } from '../../hooks/useAdminQueries'
import { CATEGORIAS, SIN_FILTROS, filtrosActivos, pasaFiltros, type Filtros } from '../../lib/filtros'

// estado_cuenta de la app → etiqueta del filtro. Un técnico sin identidad verificada sigue en revisión
// aunque su cuenta figure como activa.
function estadoLegible(estado?: string | null, sinVerificar = false) {
  const e = (estado || '').toUpperCase()
  if (e === 'SUSPENDIDO' || e === 'RECHAZADO') return e
  if (sinVerificar) return 'EN REVISIÓN'
  if (e === 'ACTIVO' || e === 'APROBADO') return 'ACTIVO'
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
  const [filters, setFilters] = useState<Filtros>(SIN_FILTROS)
  const setFiltro = (k: keyof Filtros, v: string) => setFilters(f => ({ ...f, [k]: v }))
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const { data: usersData, isLoading, isError } = useAdminUsers({
    role: tab === 'tecnicos' ? '2' : tab === 'clientes' ? '1' : '3',
  })

  // Normalize API data to component structure
  const data = (usersData || []).map(u => {
    const status = estadoLegible(u.estado_cuenta, u.id_rol === 2 && !u.identidad_verificada)
    return {
      id: `ID-${u.id_usuario}`,
      realId: u.id_usuario,
      name: `${u.nombre} ${u.apellido}`,
      phone: u.telefono,
      email: u.correo,
      specialty: u.especialidad || (tab === 'clientes' ? 'Cliente' : tab === 'admins' ? 'Administrador' : 'Sin especialidades'),
      status,
      statusV: status === 'ACTIVO' ? 'success' : status === 'EN REVISIÓN' ? 'warning' : 'danger',
      rating: u.metricas?.calificacion || null,
      jobs: u.metricas?.trabajos ?? null,
      verificado: !!u.identidad_verificada,
      registro: u.fecha_registro ?? null,
    }
  })

  const filtered = data.filter(r => {
    const s = search.toLowerCase()
    const matchSearch = !search || r.name.toLowerCase().includes(s) || r.id.toLowerCase().includes(s) || (r.email ?? '').toLowerCase().includes(s)
    return matchSearch && pasaFiltros(filters, {
      specialty: r.specialty, rating: r.rating != null ? Number(r.rating) : null,
      verificado: r.verificado, fecha: r.registro, status: r.status,
    })
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
        <select className="tec-select" aria-label="Filtrar por estado" value={filters.status} onChange={e => setFiltro('status', e.target.value)}>
          <option value="ALL">Estado: Todo</option>
          <option value="ACTIVO">Activo</option>
          <option value="EN REVISIÓN">En revisión</option>
          <option value="RECHAZADO">Rechazado</option>
          <option value="SUSPENDIDO">Suspendido</option>
        </select>
        <select className="tec-select" aria-label="Filtrar por especialidad" value={filters.specialty} onChange={e => setFiltro('specialty', e.target.value)}>
          <option value="ALL">Especialidad: Todo</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="dash-export-btn" onClick={() => setIsFilterOpen(true)}>
          <Filter size={13} /> FILTROS AVANZADOS{filtrosActivos(filters) > 0 ? ` (${filtrosActivos(filters)})` : ''}
        </button>
      </div>

      {/* Table */}
      <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando datos...</div>
        ) : isError ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>Error al cargar los datos</div>
        ) : (
          <div className="table-scroll"><table className="dash-table tec-table">
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
                        <span>{row.jobs} {row.jobs === 1 ? 'trabajo' : 'trabajos'}</span>
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
          </table></div>
        )}

        {/* El servidor entrega hasta 1000 cuentas por pestaña y la lista se filtra aquí: no hay páginas */}
        <div className="tec-pagination">
          <p className="tec-page-info">MOSTRANDO {filtered.length} DE {data.length} REGISTROS</p>
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
        value={filters}
        onApply={setFilters}
        verificationLabel="identidad verificada"
      />
    </div>
  )
}
