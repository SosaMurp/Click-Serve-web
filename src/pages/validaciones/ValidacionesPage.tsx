import { useState } from 'react'
import { Search, Filter, FileText, Eye } from 'lucide-react'
import { Badge } from '@components/ui'
import PageHeader from '@components/ui/PageHeader'
import MetricStrip from '@components/ui/MetricStrip'
import TechProfileModal from '@components/modals/TechProfileModal'
import ValidationDecisionModal from '@components/modals/ValidationDecisionModal'
import AdvancedFiltersModal from '@components/modals/AdvancedFiltersModal'
import './validaciones.css'
import { SIN_FILTROS, CAMPOS_VALIDACION, filtrosActivos, pasaFiltros, type Filtros } from '../../lib/filtros'
import { useVerifications, useApproveTechnician, useRejectTechnician } from '../../hooks/useAdminQueries'
import type { ExpedienteTecnicoRow } from '../../types/api'

// Fila de la cola de validación a partir del expediente del técnico.
function aFila(e: ExpedienteTecnicoRow) {
  return {
    date: new Date(e.fecha_solicitud).toLocaleDateString(),
    time: new Date(e.fecha_solicitud).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    name: `${e.nombre} ${e.apellido}`,
    id: `ID-${e.id_usuario}`,
    realId: e.id_usuario,
    contact: e.telefono || e.correo,
    specialty: e.especialidad || 'Sin especialidades',
    documentos: e.documentos_pendientes ?? 0,
    matchLabel: e.documentos_pendientes ? `${e.documentos_pendientes} POR REVISAR` : 'SIN PENDIENTES',
    matchColor: (e.documentos_pendientes ? 'warning' : 'neutral') as 'warning' | 'neutral',
    cedula: e.verificado_sep ? 'VERIFICADA EN SEP' : 'SIN CÉDULA',
    cedulaColor: (e.verificado_sep ? 'success' : 'neutral') as 'success' | 'neutral',
    action: 'REVISAR TODO',
    actionColor: 'dark',
    status: e.estatus,
    calificacion: e.metricas?.calificacion != null ? Number(e.metricas.calificacion) : null,
    fechaIso: e.fecha_solicitud,
    sepOk: !!e.verificado_sep,
  }
}
type Fila = ReturnType<typeof aFila>

export default function ValidacionesPage() {
  const [search, setSearch] = useState('')
  const [selectedTech, setSelectedTech] = useState<Fila | null>(null)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isDecisionOpen, setIsDecisionOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [vista, setVista] = useState<'pendientes' | 'todos'>('pendientes')
  const [filters, setFilters] = useState<Filtros>(SIN_FILTROS)

  // Técnicos que se registraron en la app (backend de la app): pendientes de revisión o el historial completo
  const { data: expedientes, isLoading, isError } = useVerifications(vista)
  const approveMutation = useApproveTechnician()
  const rejectMutation = useRejectTechnician()

  const QUEUE: Fila[] = (expedientes || []).map(aFila)

  const visibles = QUEUE.filter(r =>
    (!search || r.name.toLowerCase().includes(search.toLowerCase())) &&
    pasaFiltros(filters, { specialty: r.specialty, rating: r.calificacion, verificado: r.sepOk, fecha: r.fechaIso }, CAMPOS_VALIDACION))

  const STATS = [
    { label: vista === 'pendientes' ? 'EN COLA' : 'TÉCNICOS', value: QUEUE.length.toString(), sub: null, color: 'default' },
    { label: 'DOCUMENTOS POR REVISAR', value: QUEUE.reduce((s, r) => s + r.documentos, 0).toString(), sub: null, color: 'default' },
    { label: 'CON CÉDULA SEP', value: QUEUE.filter(r => r.cedula === 'VERIFICADA EN SEP').length.toString(), sub: null, color: QUEUE.some(r => r.sepOk) ? 'accent' : 'default' },
  ]

  const handleOpenProfile = (row: Fila) => {
    setSelectedTech(row)
    setIsProfileOpen(true)
  }

  const handleOpenDecision = (row: Fila) => {
    setSelectedTech(row)
    setIsDecisionOpen(true)
  }

  // Lanza el error para que el modal lo muestre y siga abierto.
  const handleResolve = async (approved: boolean, reason?: string, blockUser?: boolean) => {
    if (!selectedTech) return
    const id = selectedTech.realId
    if (approved) {
      await approveMutation.mutateAsync(id)
    } else {
      await rejectMutation.mutateAsync({
        id,
        payload: { motivoRechazo: reason || 'Rechazado', bloquearUsuario: blockUser || false },
      })
    }
  }

  return (
    <div className="val-page fade-in">
      <PageHeader title="Validaciones" sub="Auditoría de identidad y credenciales de técnicos">
        <div className="fin-filter-tabs" style={{ padding: 0 }} role="tablist" aria-label="Vista de la cola">
          <button role="tab" aria-selected={vista === 'pendientes'} className={`fin-filter-tab ${vista === 'pendientes' ? 'active' : ''}`}
            onClick={() => setVista('pendientes')}>Pendientes</button>
          <button role="tab" aria-selected={vista === 'todos'} className={`fin-filter-tab ${vista === 'todos' ? 'active' : ''}`}
            onClick={() => setVista('todos')}>Historial</button>
        </div>
      </PageHeader>

      <MetricStrip label="Resumen de la cola" items={STATS.map((m, i) => ({
        id: String(i), label: ['En cola', 'Documentos por revisar', 'Con cédula SEP'][i] ?? m.label, value: m.value,
        tone: i === 0 && Number(m.value) > 0 ? 'alert' : 'default',
      }))} />

      {/* Search bar */}
      <div className="val-toolbar">
        <div className="val-search">
          <Search size={14} />
          <input type="search" aria-label="Buscar técnicos por validar" placeholder="Buscar técnico o ID…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="dash-export-btn" onClick={() => setIsFilterOpen(true)}>
          <Filter size={13} /> FILTRAR{filtrosActivos(filters, CAMPOS_VALIDACION) > 0 ? ` (${filtrosActivos(filters, CAMPOS_VALIDACION)})` : ''}
        </button>
      </div>

      {/* Table */}
      <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando expedientes...</div>
        ) : isError ? (
          <div role="alert" style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger-ink)' }}>No se pudieron cargar los expedientes. Revisa tu conexión y vuelve a abrir la sección.</div>
        ) : (
          <div className="table-scroll"><table className="dash-table val-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Técnico / contacto</th>
                <th>Especialidad a validar</th>
                <th>Documentos</th>
                <th>Estado de cédula</th>
                <th>Acción de auditoría</th>
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 && (
                <tr><td colSpan={6} className="table-empty">
                  {QUEUE.length > 0 ? 'Ningún técnico coincide con la búsqueda o los filtros'
                    : vista === 'pendientes' ? 'No hay técnicos pendientes de revisión' : 'Todavía no hay técnicos registrados'}
                </td></tr>
              )}
              {visibles.map((row, i) => (
                <tr key={i}>
                  <td>
                    <p className="val-date">{row.date}</p>
                    <p className="val-time">{row.time}</p>
                  </td>
                  <td>
                    <button type="button" className="val-tech-cell val-tech-btn" onClick={() => handleOpenProfile(row)} aria-label={`Ver expediente de ${row.name}`}>
                      <div className="val-avatar">{row.name[0]}</div>
                      <div>
                        <p className="dash-table-name">{row.name}</p>
                        <p className="dash-table-id">{row.id} · {row.contact}</p>
                      </div>
                    </button>
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
                        <Eye size={11} /> Expediente
                      </button>
                      <button className="val-action-btn val-action-btn--dark" onClick={() => handleOpenDecision(row)}>
                        <FileText size={11} /> Resolver
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {/* Modals */}
      <TechProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        userId={selectedTech?.realId ?? null}
      />

      {/* Se monta al abrir: cada resolución empieza sin decisión elegida */}
      {isDecisionOpen && <ValidationDecisionModal
        isOpen
        onClose={() => setIsDecisionOpen(false)}
        techId={selectedTech?.id}
        techName={selectedTech?.name}
        onResolve={handleResolve}
      />}

      <AdvancedFiltersModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        value={filters}
        onApply={setFilters}
        campos={CAMPOS_VALIDACION}
        contexto="técnicos por validar"
        verificationLabel="cédula validada en SEP"
      />
    </div>
  )
}
