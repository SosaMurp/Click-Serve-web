import { useState } from 'react'
import { Search, Star, ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@components/ui'
import './tecnicos.css'

const TECHNICIANS = [
  { id: 'PTEC-0041', name: 'Roberto García', phone: '+52 333 *** 0041', email: null, specialty: 'Soporte y Hardware', status: 'ACTIVO', statusV: 'success', rating: 4.9, jobs: '120' },
  { id: 'PTEC-0011', name: 'Ana Martínez',   phone: null, email: 'ana@email.com', specialty: 'Desarrollo Web', status: 'EN REVISIÓN', statusV: 'warning', rating: null, jobs: null },
  { id: 'PTEC-2471', name: 'Carlos V.',       phone: null, email: null, specialty: 'Redes y Telecom', status: 'SUSPENDIDO', statusV: 'danger', rating: 4.2, jobs: '85' },
]

const CLIENTS = [
  { id: 'CLI-0011', name: 'Empresa Ejemplo SA', phone: null, email: 'contacto@empresa.com', specialty: 'Cliente Corporativo', status: 'ACTIVO', statusV: 'success', rating: null, jobs: '12 servicios' },
]

export default function TecnicosPage() {
  const [tab, setTab] = useState<'tecnicos' | 'clientes'>('tecnicos')
  const [search, setSearch] = useState('')

  const data = tab === 'tecnicos' ? TECHNICIANS : CLIENTS
  const filtered = data.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="tec-page fade-in">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Directorio de Cuentas</h1>
          <p className="dash-page-sub">GESTIÓN DE RED LÁZARO CÁRDENAS</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tec-tabs">
        <button className={`tec-tab ${tab === 'tecnicos' ? 'tec-tab--active' : ''}`} onClick={() => setTab('tecnicos')}>
          PRESTADORES DE SERVICIO <span className="tec-tab-count">195</span>
        </button>
        <button className={`tec-tab ${tab === 'clientes' ? 'tec-tab--active' : ''}`} onClick={() => setTab('clientes')}>
          CLIENTES (USUARIOS) <span className="tec-tab-count">844</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="val-toolbar">
        <div className="val-search">
          <Search size={14} />
          <input placeholder="Buscar por ID, nombre o correo..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="tec-select">
          <option>Estado: Todo</option>
          <option>Activo</option>
          <option>En Revisión</option>
          <option>Suspendido</option>
        </select>
        <select className="tec-select">
          <option>Especialidad: Todo</option>
          <option>Soporte y Hardware</option>
          <option>Desarrollo Web</option>
          <option>Redes y Telecom</option>
        </select>
      </div>

      {/* Table */}
      <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="dash-table tec-table">
          <thead>
            <tr>
              <th>TÉCNICO / CONTACTO</th>
              <th>ESPECIALIDAD PRINCIPAL</th>
              <th>ESTADO DE CUENTA</th>
              <th>MÉTRICAS</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
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
                  <Badge variant={row.statusV as 'success' | 'warning' | 'danger'}>▲ {row.status}</Badge>
                </td>
                <td>
                  {row.rating ? (
                    <div className="tec-rating">
                      <Star size={12} fill="currentColor" />
                      <strong>{row.rating}</strong>
                      <span>{row.jobs} serv.</span>
                    </div>
                  ) : <span className="dash-table-id">Sin historial</span>}
                </td>
                <td>
                  <button className="tec-action-btn">VER PERFIL</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="tec-pagination">
          <p className="tec-page-info">MOSTRANDO 3 DE 195 TÉCNICOS</p>
          <div className="tec-page-controls">
            <button className="tec-page-btn"><ChevronLeft size={13} /></button>
            {[1,2,3,4].map(n => (
              <button key={n} className={`tec-page-btn ${n === 1 ? 'tec-page-btn--active' : ''}`}>{n}</button>
            ))}
            <button className="tec-page-btn"><ChevronRight size={13} /></button>
          </div>
        </div>
      </div>
    </div>
  )
}
