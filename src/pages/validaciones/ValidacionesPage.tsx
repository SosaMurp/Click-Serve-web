import { useState } from 'react'
import { Search, Filter, FileText, Eye, RotateCcw } from 'lucide-react'
import { Badge } from '@components/ui'
import './validaciones.css'

const STATS = [
  { label: 'EN COLA HOY',       value: '3',  sub: null,           color: 'default' },
  { label: 'DÍAS PROMEDIO',     value: '1',  sub: 'Tiempo approx. 48h', color: 'default' },
  { label: 'RECHAZOS PER. SEMANA', value: '2', sub: 'Requieren atención', color: 'default' },
  { label: 'APROBADOS HOY',    value: '12', sub: '+ 4 validados',  color: 'accent' },
]

const QUEUE = [
  {
    date: 'Hoy', time: '03:45',
    name: 'Roberto García', id: 'PTEC-0041', contact: '+ extras...', specialty: 'Soporte y Hardware',
    match: null, matchLabel: 'DISCREPANCIA EN CEDULA', matchColor: 'warning',
    cedula: 'SIN VALIDAR', cedulaColor: 'warning',
    action: 'REVISAR TODO', actionColor: 'dark',
  },
  {
    date: 'Hoy', time: '02:30',
    name: 'Ana Martínez', id: 'PTEC-0011', contact: 'ana@email.com', specialty: 'Desarrollo Web',
    match: null, matchLabel: 'BIOMETRÍA EN PDF', matchColor: 'info',
    cedula: 'VALIDADA SEP', cedulaColor: 'success',
    action: 'REVISAR PDF', actionColor: 'outline',
  },
  {
    date: 'Ayer', time: '14:05',
    name: 'Carlos G.', id: 'PTEC-2071', contact: '...otros', specialty: '...',
    match: null, matchLabel: 'ALERTA DE SISTEMA', matchColor: 'danger',
    cedula: 'CONTRATO ILEGAL', cedulaColor: 'danger',
    action: 'CONTINUAR REVISIÓN', actionColor: 'danger',
  },
]

export default function ValidacionesPage() {
  const [search, setSearch] = useState('')

  return (
    <div className="val-page fade-in">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Centro de Validaciones</h1>
          <p className="dash-page-sub">AUDITORÍA DE IDENTIDAD Y CREDENCIALES</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="dash-export-btn"><RotateCcw size={13} /> PENDIENTES (3)</button>
          <button className="dash-export-btn" style={{ background: 'var(--text-dark)', color: '#fff', border: 'none' }}>HISTORIAL</button>
        </div>
      </div>

      {/* Stats */}
      <div className="val-stats-grid">
        {STATS.map(s => (
          <div key={s.label} className={`val-stat ${s.color === 'accent' ? 'val-stat--accent' : ''}`}>
            <p className="val-stat-value">{s.value}</p>
            <p className="val-stat-label">{s.label}</p>
            {s.sub && <p className="val-stat-sub">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Search bar */}
      <div className="val-toolbar">
        <div className="val-search">
          <Search size={14} />
          <input placeholder="Buscar técnico o ID..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="dash-export-btn"><Filter size={13} /> FILTRAR</button>
      </div>

      {/* Table */}
      <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="dash-table val-table">
          <thead>
            <tr>
              <th>FECHA</th>
              <th>TÉCNICO / CONTACTO</th>
              <th>SERVICIO A VALIDAR</th>
              <th>MATCH BIOMÉTRICO</th>
              <th>ESTADO CÉDULA</th>
              <th>ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            {QUEUE.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase())).map((row, i) => (
              <tr key={i}>
                <td>
                  <p className="val-date">{row.date}</p>
                  <p className="val-time">{row.time}</p>
                </td>
                <td>
                  <div className="val-tech-cell">
                    <div className="val-avatar">{row.name[0]}</div>
                    <div>
                      <p className="dash-table-name">{row.name}</p>
                      <p className="dash-table-id">{row.id} · {row.contact}</p>
                    </div>
                  </div>
                </td>
                <td><span className="dash-table-spec">{row.specialty}</span></td>
                <td>
                  <Badge variant={row.matchColor as 'warning' | 'info' | 'danger'}>{row.matchLabel}</Badge>
                </td>
                <td>
                  <Badge variant={row.cedulaColor as 'success' | 'warning' | 'danger'}>{row.cedula}</Badge>
                </td>
                <td>
                  <button className={`val-action-btn val-action-btn--${row.actionColor}`}>
                    {row.actionColor === 'outline' ? <FileText size={11} /> : <Eye size={11} />}
                    {row.action}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
