import { Download, Users, Briefcase, ShieldAlert, DollarSign, ChevronRight, Eye, FileText } from 'lucide-react'
import { StatCard, Badge } from '@components/ui'
import './dashboard.css'

/* ── Mock data ── */
const VALIDATION_QUEUE = [
  { id: 'OP-PSC-0041', name: 'Roberto García', specialty: 'Soporte y Hardware', match: 78, matchStatus: 'warning', cedulaStatus: 'VALIDADA (SAT)', action: 'REVISAR' },
  { id: 'OP-PSC-0011', name: 'Ana Martínez', specialty: 'Desarrollo Web', match: 88, matchStatus: 'success', cedulaStatus: 'POR ARCHIVO', action: 'REVISAR PDF' },
]

const ACTIVITY = [
  { time: 'HACE 5 MIN', color: 'accent', text: 'Servicio de Redes completado exitosamente en Zona Centro.', sub: '+$40USD MXN producidos', urgent: false },
  { time: 'HACE 20 MIN', color: 'warning', text: 'Nuevo registro de técnico: Carlos V.', sub: 'Evaluación biométrica iniciada', urgent: true },
  { time: 'HACE 3 HORA', color: 'danger', text: 'Cancelación de servicio en Guanajuato por parte del cliente.', sub: 'Ticket #C0-000 generado', urgent: true },
]

export default function DashboardPage() {
  return (
    <div className="dash-page fade-in">
      {/* ── Page Header ── */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Visión General</h1>
          <p className="dash-page-sub">MÉTRICAS EN TIEMPO REAL DE LÁZARO CÁRDENAS</p>
        </div>
        <button className="dash-export-btn">
          <Download size={13} />
          EXPORTAR REPORTE
        </button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="dash-stats-grid">
        <StatCard label="Técnicos Online" value="42" icon={<Users size={20} />} change="+ 12%" changePositive />
        <StatCard label="Servicios en Curso" value="18" icon={<Briefcase size={20} />} change="en toda la ciudad" />
        <StatCard label="Validaciones Pendientes" value="3" icon={<ShieldAlert size={20} />} change="Requieren revisión manual" changePositive={false} alert />
        <StatCard label="Ingresos (HOY)" value="$4,280" icon={<DollarSign size={20} />} />
      </div>

      {/* ── Lower Grid ── */}
      <div className="dash-lower-grid">
        {/* Validation Queue */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div>
              <h2 className="dash-card-title">Cola de Verificación (OpenCV &amp; SEP)</h2>
              <p className="dash-card-sub">PRIORIDAD DE ATENCIÓN MANUAL</p>
            </div>
            <button className="dash-link-btn"><ChevronRight size={14} /> VER HISTORIAL</button>
          </div>

          <table className="dash-table">
            <thead>
              <tr>
                <th>TÉCNICO</th>
                <th>ESPECIALIDAD A VALIDAR</th>
                <th>MATCH VISUAL</th>
                <th>ESTADO CÉDULA</th>
                <th>ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              {VALIDATION_QUEUE.map(row => (
                <tr key={row.id}>
                  <td>
                    <p className="dash-table-name">{row.name}</p>
                    <p className="dash-table-id">{row.id}</p>
                  </td>
                  <td><span className="dash-table-spec">{row.specialty}</span></td>
                  <td>
                    <span className={`dash-match dash-match--${row.matchStatus}`}>
                      {row.matchStatus === 'warning' ? '⚠' : '✓'} {row.match}% ({row.matchStatus === 'warning' ? 'DUDA' : 'MATCH'})
                    </span>
                  </td>
                  <td>
                    <Badge variant={row.matchStatus as 'success' | 'warning'}>{row.cedulaStatus}</Badge>
                  </td>
                  <td>
                    <button className={`dash-action-btn ${row.action === 'REVISAR PDF' ? 'dash-action-btn--outline' : ''}`}>
                      {row.action === 'REVISAR' ? <Eye size={12} /> : <FileText size={12} />}
                      {row.action}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Activity Feed */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Actividad LZC</h2>
          </div>
          <div className="dash-feed">
            {ACTIVITY.map((item, i) => (
              <div key={i} className="dash-feed-item">
                <div className={`dash-feed-dot dash-feed-dot--${item.color}`} />
                <div className="dash-feed-body">
                  <p className="dash-feed-time">{item.time}</p>
                  <p className="dash-feed-text">{item.text}</p>
                  <p className="dash-feed-sub">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
