import { useState } from 'react'
import { Search, Filter, ChevronLeft, ChevronRight, MessageSquare, AlertCircle, Inbox, Loader, Clock, CheckCircle2 } from 'lucide-react'
import { Badge, StatCard } from '@components/ui'
import DisputeResolutionModal from '@components/modals/DisputeResolutionModal'
import './soporte.css'

const STATS = [
  { label: 'Tickets abiertos', value: '4',  icon: <Inbox size={15} />,        tone: 'amber', note: 'Esperando respuesta' },
  { label: 'En progreso',      value: '0',  icon: <Loader size={15} />,       tone: 'blue',  note: 'Asignados a un agente' },
  { label: 'Tiempo medio',     value: '14', icon: <Clock size={15} />,        tone: 'navy',  note: 'Hasta la resolución', suffix: 'h' },
  { label: 'Resueltos',        value: '29', icon: <CheckCircle2 size={15} />, tone: 'green', note: 'En este mes' },
] as const

type TicketStatus = 'PENDIENTE DE RESOLUCIÓN' | 'SANS ACCIONES' | 'ESCALADO A TI URGENTE'
type StatusVariant = 'warning' | 'neutral' | 'danger'

const STATUS_MAP: Record<TicketStatus, StatusVariant> = {
  'PENDIENTE DE RESOLUCIÓN': 'warning',
  'SANS ACCIONES':           'neutral',
  'ESCALADO A TI URGENTE':  'danger',
}

const TICKETS = [
  {
    id: 'ICS-399', date: 'May, 22:15',
    user: 'José López', userId: null, role: 'Cliente',
    subject: 'Cancelación en Guacamayas',
    desc: 'Cliente canceló servicio; cobro ya fue procesado en cuenta.',
    status: 'PENDIENTE DE RESOLUCIÓN' as TicketStatus,
    time: 'SIN ACCIÓN', techName: 'Roberto García'
  },
  {
    id: 'ICS-001', date: 'Abril, 10:20',
    user: 'Roberto García', userId: 'PTEC-0001', role: 'Técnico',
    subject: 'Consulta de Facturación',
    desc: 'Necesita factura del mes de Abril.',
    status: 'SANS ACCIONES' as TicketStatus,
    time: 'SIN CASO', techName: 'N/A'
  },
  {
    id: 'ICS-002', date: 'Abr, 09:46',
    user: 'Andrea López', userId: null, role: 'Cliente',
    subject: 'Error al cargar tarjeta No.',
    desc: 'Cuando intenta agregar tarjeta de crédito en pasarela.',
    status: 'ESCALADO A TI URGENTE' as TicketStatus,
    time: 'SIN DETALLE', techName: 'Carlos V.'
  },
]

export default function SoportePage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedTicket, setSelectedTicket] = useState<typeof TICKETS[0] | null>(null)
  const [isDisputeOpen, setIsDisputeOpen] = useState(false)

  const filtered = TICKETS.filter(t =>
    (!search || t.subject.toLowerCase().includes(search.toLowerCase()) || t.user.toLowerCase().includes(search.toLowerCase())) &&
    (statusFilter === 'ALL' || t.status === statusFilter)
  )

  const handleOpenDispute = (ticket: typeof TICKETS[0]) => {
    setSelectedTicket(ticket)
    setIsDisputeOpen(true)
  }

  return (
    <div className="sop-page fade-in">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Soporte y disputas</h1>
          <p className="dash-page-sub">Atención a clientes y técnicos</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="sop-filter-pill sop-filter-pill--active">Abiertos (4)</button>
          <button className="sop-filter-pill">En progreso (0)</button>
          <button className="sop-filter-pill">Resueltos</button>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        {STATS.map(s => (
          <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} tone={s.tone}
            note={s.note} suffix={'suffix' in s ? s.suffix : undefined} />
        ))}
      </div>

      {/* Toolbar */}
      <div className="val-toolbar">
        <div className="val-search">
          <Search size={14} />
          <input placeholder="Buscar usuario, caso o # de resolución..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="tec-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="ALL">Canal: Todos</option>
          <option value="PENDIENTE DE RESOLUCIÓN">Pendiente</option>
          <option value="ESCALADO A TI URGENTE">Urgente</option>
        </select>
        <button className="dash-export-btn"><Filter size={13} /> TIPOLOGÍA: TODOS</button>
      </div>

      {/* Table */}
      <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="dash-table sop-table">
          <thead>
            <tr>
              <th>FOLIO / REGISTRO</th>
              <th>USUARIO / TÉCNICO</th>
              <th>ASUNTO / RESUMEN</th>
              <th>ESTADO RESOLUCIÓN</th>
              <th>RESOLUCIÓN (HS)</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={i}>
                <td>
                  <p className="sop-folio">{row.id}</p>
                  <p className="dash-table-id">{row.date}</p>
                </td>
                <td>
                  <div className="val-tech-cell">
                    <div className="sop-avatar">{row.user[0]}</div>
                    <div>
                      <p className="dash-table-name">{row.user}</p>
                      <p className="dash-table-id">{row.userId || row.role || ''}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <p className="dash-table-name">{row.subject}</p>
                  <p className="dash-table-id">{row.desc}</p>
                </td>
                <td>
                  <Badge variant={STATUS_MAP[row.status]}>{row.status}</Badge>
                </td>
                <td><span className="dash-table-id">{row.time}</span></td>
                <td>
                  <button className="sop-view-btn" onClick={() => handleOpenDispute(row)}>
                    VER CASO (RF-109)
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="tec-pagination">
          <p className="tec-page-info">MOSTRANDO {filtered.length} TICKETS TOTAL ABIERTOS</p>
          <div className="tec-page-controls">
            <button className="tec-page-btn"><ChevronLeft size={13} /></button>
            {[1,2,3,4].map(n => (
              <button key={n} className={`tec-page-btn ${n === 1 ? 'tec-page-btn--active' : ''}`}>{n}</button>
            ))}
            <button className="tec-page-btn"><ChevronRight size={13} /></button>
          </div>
        </div>
      </div>

      {/* Modal Disputa */}
      <DisputeResolutionModal
        isOpen={isDisputeOpen}
        onClose={() => setIsDisputeOpen(false)}
        ticketId={selectedTicket?.id}
        userName={selectedTicket?.user}
        techName={selectedTicket?.techName}
      />
    </div>
  )
}
