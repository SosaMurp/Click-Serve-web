import { useState } from 'react'
import { Search, Filter, FileText, Eye, RotateCcw } from 'lucide-react'
import { Badge } from '@components/ui'
import TechProfileModal from '@components/modals/TechProfileModal'
import ValidationDecisionModal from '@components/modals/ValidationDecisionModal'
import AdvancedFiltersModal from '@components/modals/AdvancedFiltersModal'
import './validaciones.css'
import { useVerifications, useApproveTechnician, useRejectTechnician } from '../../hooks/useAdminQueries'

export default function ValidacionesPage() {
  const [search, setSearch] = useState('')
  const [selectedTech, setSelectedTech] = useState<any>(null)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isDecisionOpen, setIsDecisionOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [vista, setVista] = useState<'pendientes' | 'todos'>('pendientes')

  // Técnicos que se registraron en la app (backend de la app): pendientes de revisión o el historial completo
  const { data: expedientes, isLoading, isError } = useVerifications(vista)
  const approveMutation = useApproveTechnician()
  const rejectMutation = useRejectTechnician()

  const QUEUE = (expedientes || []).map(e => ({
    date: new Date(e.fecha_solicitud).toLocaleDateString(),
    time: new Date(e.fecha_solicitud).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    name: `${e.nombre} ${e.apellido}`,
    id: `ID-${e.id_usuario}`,
    realId: e.id_usuario, // Using realId to identify the technician correctly
    contact: e.telefono || e.correo,
    specialty: e.especialidad || 'Sin especialidades',
    documentos: e.documentos_pendientes ?? 0,
    matchLabel: e.documentos_pendientes ? `${e.documentos_pendientes} POR REVISAR` : 'SIN PENDIENTES',
    matchColor: (e.documentos_pendientes ? 'warning' : 'neutral') as any,
    cedula: e.verificado_sep ? 'VERIFICADA EN SEP' : 'SIN CÉDULA',
    cedulaColor: (e.verificado_sep ? 'success' : 'neutral') as any,
    action: 'REVISAR TODO',
    actionColor: 'dark',
    status: e.estatus
  }))

  const STATS = [
    { label: vista === 'pendientes' ? 'EN COLA' : 'TÉCNICOS', value: QUEUE.length.toString(), sub: null, color: 'default' },
    { label: 'DOCUMENTOS POR REVISAR', value: QUEUE.reduce((s, r) => s + r.documentos, 0).toString(), sub: null, color: 'default' },
    { label: 'CON CÉDULA SEP', value: QUEUE.filter(r => r.cedula === 'VERIFICADA EN SEP').length.toString(), sub: null, color: 'accent' },
  ]

  const handleOpenProfile = (row: any) => {
    setSelectedTech(row)
    setIsProfileOpen(true)
  }

  const handleOpenDecision = (row: any) => {
    setSelectedTech(row)
    setIsDecisionOpen(true)
  }

  const handleResolve = async (approved: boolean, reason?: string, blockUser?: boolean) => {
    if (!selectedTech) return
    const id = selectedTech.realId
    try {
      if (approved) {
        await approveMutation.mutateAsync(id)
      } else {
        await rejectMutation.mutateAsync({
          id,
          payload: { motivoRechazo: reason || 'Rechazado', bloquearUsuario: blockUser || false }
        })
      }
      setIsDecisionOpen(false)
    } catch (error) {
      console.error('Error on resolve', error)
      alert('Hubo un error al procesar la resolución.')
    }
  }

  return (
    <div className="val-page fade-in">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Centro de Validaciones</h1>
          <p className="dash-page-sub">AUDITORÍA DE IDENTIDAD Y CREDENCIALES</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="dash-export-btn" onClick={() => setVista('pendientes')}
            style={vista === 'pendientes' ? { background: 'var(--text-dark)', color: '#fff', border: 'none' } : undefined}>
            <RotateCcw size={13} /> PENDIENTES
          </button>
          <button className="dash-export-btn" onClick={() => setVista('todos')}
            style={vista === 'todos' ? { background: 'var(--text-dark)', color: '#fff', border: 'none' } : undefined}>
            HISTORIAL
          </button>
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
        <button className="dash-export-btn" onClick={() => setIsFilterOpen(true)}>
          <Filter size={13} /> FILTRAR
        </button>
      </div>

      {/* Table */}
      <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando expedientes...</div>
        ) : isError ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>Error al cargar los expedientes</div>
        ) : (
          <table className="dash-table val-table">
            <thead>
              <tr>
                <th>FECHA</th>
                <th>TÉCNICO / CONTACTO</th>
                <th>ESPECIALIDAD A VALIDAR</th>
                <th>DOCUMENTOS</th>
                <th>ESTADO CÉDULA</th>
                <th>ACCIÓN DE AUDITORÍA</th>
              </tr>
            </thead>
            <tbody>
              {QUEUE.length === 0 && (
                <tr><td colSpan={6} style={{textAlign: 'center', padding: '1rem'}}>{vista === 'pendientes' ? 'No hay técnicos pendientes de revisión' : 'Todavía no hay técnicos registrados'}</td></tr>
              )}
              {QUEUE.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase())).map((row, i) => (
                <tr key={i}>
                  <td>
                    <p className="val-date">{row.date}</p>
                    <p className="val-time">{row.time}</p>
                  </td>
                  <td>
                    <div className="val-tech-cell" style={{ cursor: 'pointer' }} onClick={() => handleOpenProfile(row)}>
                      <div className="val-avatar">{row.name[0]}</div>
                      <div>
                        <p className="dash-table-name">{row.name}</p>
                        <p className="dash-table-id">{row.id} · {row.contact}</p>
                      </div>
                    </div>
                  </td>
                  <td><span className="dash-table-spec">{row.specialty}</span></td>
                  <td>
                    <Badge variant={row.matchColor}>{row.matchLabel}</Badge>
                  </td>
                  <td>
                    <Badge variant={row.cedulaColor}>{row.cedula}</Badge>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className={`val-action-btn val-action-btn--${row.actionColor}`} onClick={() => handleOpenProfile(row)}>
                        <Eye size={11} /> EXPEDIENTE
                      </button>
                      <button className="val-action-btn val-action-btn--dark" onClick={() => handleOpenDecision(row)}>
                        <FileText size={11} /> RESOLVER
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      <TechProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        userId={selectedTech?.realId ?? null}
      />

      <ValidationDecisionModal
        isOpen={isDecisionOpen}
        onClose={() => setIsDecisionOpen(false)}
        techId={selectedTech?.id}
        techName={selectedTech?.name}
        onResolve={handleResolve}
      />

      <AdvancedFiltersModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
      />
    </div>
  )
}
