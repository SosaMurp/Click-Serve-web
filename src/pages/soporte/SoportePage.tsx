import { useMemo, useState } from 'react'
import { Search, Inbox, CheckCircle2, AlertTriangle, ShieldAlert, X } from 'lucide-react'
import { Badge, Button, StatCard } from '@components/ui'
import { useIncidencias, useUpdateIncidencia } from '../../hooks/useAdminQueries'
import type { AccionIncidencia, IncidenciaRow, IncidenciaTipo, Prioridad } from '../../types/api'
import '@components/modals/modals.css'
import './soporte.css'

// Incidencias que clientes y técnicos reportan desde la app (RF-56, RF-109/110) y que soporte atiende aquí
// (RF-114 clasificar, RF-118 historial, RF-121 revisar el caso).

const TIPO_LABEL: Record<IncidenciaTipo, string> = {
  NO_SE_PRESENTO: 'El técnico no llegó',
  COBRO_INDEBIDO: 'Cobro indebido',
  MALA_CALIDAD: 'Mala calidad',
  DANOS: 'Daños',
  SEGURIDAD: 'Seguridad / SOS',
  GARANTIA: 'Garantía',
  OTRO: 'Otro',
}

const PRIORIDAD_VARIANT: Record<Prioridad, 'danger' | 'warning' | 'neutral'> = { ALTA: 'danger', MEDIA: 'warning', BAJA: 'neutral' }

const ACCION_LABEL: Record<AccionIncidencia, string> = {
  CONTINUAR: 'Cerrar reporte, la orden continúa',
  REASIGNAR: 'Reasignar a otro técnico',
  CANCELAR: 'Cancelar la orden sin cargo',
}

const persona = (n?: string | null, a?: string | null) => [n, a].filter(Boolean).join(' ') || '—'
const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

type Filtro = 'ABIERTA' | 'RESUELTA'

export default function SoportePage() {
  const [filtro, setFiltro] = useState<Filtro>('ABIERTA')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<IncidenciaRow | null>(null)

  const abiertas = useIncidencias('ABIERTA')
  const resueltas = useIncidencias('RESUELTA')
  const actual = filtro === 'ABIERTA' ? abiertas : resueltas

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = actual.data ?? []
    if (!q) return rows
    return rows.filter(i =>
      [i.folio, i.folio_solicitud ?? '', persona(i.cliente_nombre, i.cliente_apellido), persona(i.tecnico_nombre, i.tecnico_apellido), i.descripcion]
        .some(v => v.toLowerCase().includes(q)),
    )
  }, [actual.data, search])

  const altas = (abiertas.data ?? []).filter(i => i.prioridad === 'ALTA').length
  const seguridad = (abiertas.data ?? []).filter(i => i.tipo === 'SEGURIDAD').length
  const valor = (n: number) => (abiertas.isError ? '—' : String(n))

  return (
    <div className="sop-page fade-in">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Soporte e incidencias</h1>
          <p className="dash-page-sub">Reportes de clientes y técnicos desde la app</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`sop-filter-pill ${filtro === 'ABIERTA' ? 'sop-filter-pill--active' : ''}`} onClick={() => setFiltro('ABIERTA')}>
            Abiertas{abiertas.data ? ` (${abiertas.data.length})` : ''}
          </button>
          <button className={`sop-filter-pill ${filtro === 'RESUELTA' ? 'sop-filter-pill--active' : ''}`} onClick={() => setFiltro('RESUELTA')}>
            Resueltas
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Abiertas" value={valor(abiertas.data?.length ?? 0)} icon={<Inbox size={15} />} tone="amber" note="Órdenes suspendidas o en revisión" />
        <StatCard label="Prioridad alta" value={valor(altas)} icon={<AlertTriangle size={15} />} tone="red" note="Atender primero" />
        <StatCard label="Seguridad / SOS" value={valor(seguridad)} icon={<ShieldAlert size={15} />} tone="red" note="Escaladas desde la app" />
        <StatCard label="Resueltas" value={resueltas.isError ? '—' : String(resueltas.data?.length ?? 0)} icon={<CheckCircle2 size={15} />} tone="green" note="Historial" />
      </div>

      <div className="val-toolbar">
        <div className="val-search">
          <Search size={14} />
          <input placeholder="Buscar por folio, orden, cliente, técnico o descripción..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="dash-table sop-table">
          <thead>
            <tr>
              <th>FOLIO / FECHA</th>
              <th>TIPO</th>
              <th>CLIENTE / TÉCNICO</th>
              <th>ORDEN</th>
              <th>PRIORIDAD</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {actual.isLoading && <tr><td colSpan={6} className="sop-empty">Cargando incidencias…</td></tr>}
            {actual.isError && (
              <tr><td colSpan={6} className="sop-empty">
                No se pudieron cargar las incidencias.{' '}
                <button className="sop-view-btn" onClick={() => actual.refetch()}>REINTENTAR</button>
              </td></tr>
            )}
            {!actual.isLoading && !actual.isError && filtered.length === 0 && (
              <tr><td colSpan={6} className="sop-empty">{filtro === 'ABIERTA' ? 'No hay incidencias abiertas.' : 'Todavía no hay incidencias resueltas.'}</td></tr>
            )}
            {filtered.map(i => (
              <tr key={i.id_incidencia}>
                <td>
                  <p className="sop-folio">{i.folio}</p>
                  <p className="dash-table-id">{fecha(i.fecha_creacion)}</p>
                </td>
                <td>
                  <p className="dash-table-name">{TIPO_LABEL[i.tipo] ?? i.tipo}</p>
                  <p className="dash-table-id">Reporta: {persona(i.reporta_nombre, i.reporta_apellido)}</p>
                </td>
                <td>
                  <p className="dash-table-name">{persona(i.cliente_nombre, i.cliente_apellido)}</p>
                  <p className="dash-table-id">{persona(i.tecnico_nombre, i.tecnico_apellido)}</p>
                </td>
                <td>
                  <p className="dash-table-name">{i.folio_solicitud ?? '—'}</p>
                  <p className="dash-table-id">{i.estado_solicitud ?? ''}</p>
                </td>
                <td><Badge variant={PRIORIDAD_VARIANT[i.prioridad]}>{i.prioridad}</Badge></td>
                <td>
                  <button className="sop-view-btn" onClick={() => setSelected(i)}>
                    {i.estado === 'ABIERTA' ? 'ATENDER' : 'VER CASO'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && <IncidenciaModal key={selected.id_incidencia} incidencia={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function IncidenciaModal({ incidencia: i, onClose }: { incidencia: IncidenciaRow; onClose: () => void }) {
  const update = useUpdateIncidencia()
  const [prioridad, setPrioridad] = useState<Prioridad>(i.prioridad)
  const [notas, setNotas] = useState(i.notas_admin ?? '')
  const [accion, setAccion] = useState<AccionIncidencia | ''>('')
  const [error, setError] = useState('')
  const abierta = i.estado === 'ABIERTA'
  // Solo una orden suspendida se puede reasignar o cancelar; si no, únicamente se cierra el reporte.
  const acciones: AccionIncidencia[] = i.estado_solicitud === 'SUSPENDIDA' ? ['CONTINUAR', 'REASIGNAR', 'CANCELAR'] : ['CONTINUAR']

  const guardar = async () => {
    setError('')
    try {
      await update.mutateAsync({
        id: i.id_incidencia,
        payload: { prioridad, notas_admin: notas.trim() || undefined, accion: accion || undefined },
      })
      onClose()
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'No se pudo guardar. Intenta de nuevo.')
    }
  }

  const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dark)', display: 'block', marginBottom: 6 }
  const field: React.CSSProperties = { width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border-strong, #8B93A1)', fontFamily: 'inherit', fontSize: 13, background: '#fff' }

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-container--sm fade-in">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">{TIPO_LABEL[i.tipo] ?? i.tipo}</h3>
            <p className="modal-subtitle">{i.folio} · ORDEN {i.folio_solicitud ?? '—'}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ gap: 14 }}>
          <div style={{ background: 'var(--bg-sunk, #F7F8F9)', border: '1px solid var(--border-light, #E6E9EE)', borderRadius: 8, padding: 12, fontSize: 13 }}>
            <p style={{ margin: '0 0 6px', color: 'var(--text-mid)' }}>
              {persona(i.reporta_nombre, i.reporta_apellido)} · {fecha(i.fecha_creacion)}
            </p>
            <p style={{ margin: 0, color: 'var(--text-dark)', whiteSpace: 'pre-wrap' }}>{i.descripcion}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
            <div><span style={{ color: 'var(--text-mid)' }}>Cliente</span><br /><strong>{persona(i.cliente_nombre, i.cliente_apellido)}</strong></div>
            <div><span style={{ color: 'var(--text-mid)' }}>Técnico</span><br /><strong>{persona(i.tecnico_nombre, i.tecnico_apellido)}</strong></div>
            <div><span style={{ color: 'var(--text-mid)' }}>Estado de la orden</span><br /><strong>{i.estado_solicitud ?? '—'}</strong></div>
            <div><span style={{ color: 'var(--text-mid)' }}>Pago</span><br /><strong>{i.estado_pago ?? '—'}</strong></div>
          </div>

          {abierta ? (
            <>
              <div>
                <label style={label}>Prioridad</label>
                <select style={field} value={prioridad} onChange={e => setPrioridad(e.target.value as Prioridad)}>
                  <option value="ALTA">Alta</option>
                  <option value="MEDIA">Media</option>
                  <option value="BAJA">Baja</option>
                </select>
              </div>
              <div>
                <label style={label}>Notas internas</label>
                <textarea style={{ ...field, minHeight: 64 }} value={notas} onChange={e => setNotas(e.target.value)}
                  placeholder="Qué se revisó, con quién se habló…" />
              </div>
              <div>
                <label style={label}>Resolver</label>
                <select style={field} value={accion} onChange={e => setAccion(e.target.value as AccionIncidencia | '')}>
                  <option value="">Solo guardar, sin resolver</option>
                  {acciones.map(a => <option key={a} value={a}>{ACCION_LABEL[a]}</option>)}
                </select>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13 }}>
              <p style={{ margin: '0 0 4px' }}><strong>Resolución:</strong> {i.resolucion ? ACCION_LABEL[i.resolucion] : '—'}</p>
              {i.fecha_resolucion && <p style={{ margin: '0 0 4px', color: 'var(--text-mid)' }}>{fecha(i.fecha_resolucion)}</p>}
              {i.notas_admin && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}><strong>Notas:</strong> {i.notas_admin}</p>}
            </div>
          )}
          {error && <p style={{ margin: 0, fontSize: 12, color: 'var(--danger-ink, #A41F15)' }}>{error}</p>}
        </div>

        <div className="modal-footer">
          <Button variant="ghost" size="sm" onClick={onClose}>{abierta ? 'CANCELAR' : 'CERRAR'}</Button>
          {abierta && (
            <Button variant="primary" size="sm" loading={update.isPending} onClick={guardar}>
              {accion ? 'GUARDAR Y RESOLVER' : 'GUARDAR'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
