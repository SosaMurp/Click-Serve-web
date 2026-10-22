import { useState } from 'react'
import { Search, Star, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { Badge } from '@components/ui'
import TechProfileModal from '@components/modals/TechProfileModal'
import AdvancedFiltersModal from '@components/modals/AdvancedFiltersModal'
import './tecnicos.css'

import { useAdminUsers } from '../../hooks/useAdminQueries'

export default function TecnicosPage() {
  const [tab, setTab] = useState<'tecnicos' | 'clientes'>('tecnicos')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [specFilter, setSpecFilter] = useState('ALL')
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const { data: usersData, isLoading, isError } = useAdminUsers({
    role: tab === 'tecnicos' ? '2' : '1', // Assuming 2=Technician, 1=Client based on profiles
  })

  // Normalize API data to component structure
  const data = (usersData || []).map(u => ({
    id: `ID-${u.id_usuario}`,
    realId: u.id_usuario,
    name: `${u.nombre} ${u.apellido}`,
    phone: u.telefono,
    email: u.correo,
    specialty: u.especialidad || (tab === 'clientes' ? 'Cliente' : 'General'),
    status: u.estado_cuenta?.toUpperCase() || 'ACTIVO',
    statusV: u.estado_cuenta?.toLowerCase() === 'activo' ? 'success' : u.estado_cuenta?.toLowerCase() === 'suspendido' ? 'danger' : 'warning',
    rating: u.metricas?.calificacion || null,
    jobs: u.metricas?.trabajos_completados || null
  }))

  const filtered = data.filter(r => {
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.id.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'ALL' || r.status === statusFilter
    const matchSpec = specFilter === 'ALL' || r.specialty === specFilter
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
          <h1 className="dash-page-title">Directorio de Cuentas (RF-18, RF-37, RF-38)</h1>
          <p className="dash-page-sub">GESTIÓN DE RED LÁZARO CÁRDENAS</p>
        </div>
      </div>

      {/* Tabs (RF-37) */}
      <div className="tec-tabs">
        <button className={`tec-tab ${tab === 'tecnicos' ? 'tec-tab--active' : ''}`} onClick={() => setTab('tecnicos')}>
          PRESTADORES DE SERVICIO
        </button>
        <button className={`tec-tab ${tab === 'clientes' ? 'tec-tab--active' : ''}`} onClick={() => setTab('clientes')}>
          CLIENTES (USUARIOS)
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
          <option value="EN REVISIÓN">En Revisión</option>
          <option value="SUSPENDIDO">Suspendido</option>
        </select>
        <select className="tec-select" value={specFilter} onChange={e => setSpecFilter(e.target.value)}>
          <option value="ALL">Especialidad: Todo</option>
          <option value="Soporte y Hardware">Soporte y Hardware</option>
          <option value="Desarrollo Web">Desarrollo Web</option>
          <option value="Redes y Conectividad">Redes y Conectividad</option>
        </select>
        <button className="dash-export-btn" onClick={() => setIsFilterOpen(true)}>
          <Filter size={13} /> FILTROS AVANZADOS (RF-39)
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
                <th>{tab === 'tecnicos' ? 'TÉCNICO / CONTACTO' : 'CLIENTE / CONTACTO'}</th>
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
                      VER PERFIL (RF-36)
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
        techData={selectedItem ? {
          id: selectedItem.id,
          name: selectedItem.name,
          email: selectedItem.email || undefined,
          phone: selectedItem.phone || undefined,
          specialty: selectedItem.specialty,
          status: selectedItem.status,
          rating: selectedItem.rating,
          jobs: selectedItem.jobs
        } : undefined}
      />

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
