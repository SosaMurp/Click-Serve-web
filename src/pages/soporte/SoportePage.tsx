import { useMemo, useState } from 'react'
import { Search, Inbox, CheckCircle2, AlertTriangle, ShieldAlert, X, Download } from 'lucide-react'
import { Badge, Button, StatCard } from '@components/ui'
import { useIncidencias, useUpdateIncidencia } from '../../hooks/useAdminQueries'
import type { AccionIncidencia, IncidenciaRow, IncidenciaTipo, Prioridad } from '../../types/api'
import '@components/modals/modals.css'
import TicketsPanel from './TicketsPanel'
import api from '../../api/axios'
import { abrirImprimible, escapeHtml, tablaHtml } from '../../utils/printable'
import '../tecnicos/tecnicos.css'
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
  const [seccion, setSeccion] = useState<'incidencias' | 'tickets'>('incidencias')
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
          <p className="dash-page-sub">Reportes y tickets de clientes y técnicos desde la app</p>
        </div>
        <div style={{ display: seccion === 'incidencias' ? 'flex' : 'none', gap: 8 }}>
          <button className={`sop-filter-pill ${filtro === 'ABIERTA' ? 'sop-filter-pill--active' : ''}`} onClick={() => setFiltro('ABIERTA')}>
            Abiertas{abiertas.data ? ` (${abiertas.data.length})` : ''}
          </button>
          <button className={`sop-filter-pill ${filtro === 'RESUELTA' ? 'sop-filter-pill--active' : ''}`} onClick={() => setFiltro('RESUELTA')}>
            Resueltas
          </button>
        </div>
      </div>

      <div className="tec-tabs">
        <button className={`tec-tab ${seccion === 'incidencias' ? 'tec-tab--active' : ''}`} onClick={() => setSeccion('incidencias')}>
          INCIDENCIAS DE SERVICIOS
        </button>
        <button className={`tec-tab ${seccion === 'tickets' ? 'tec-tab--active' : ''}`} onClick={() => setSeccion('tickets')}>
          TICKETS DE SOPORTE
        </button>
      </div>

      {seccion === 'tickets' ? <TicketsPanel /> : (
      <>
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
        <div className="table-scroll"><table className="dash-table sop-table">
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
        </table></div>
      </div>

      </>
      )}

      {selected && <IncidenciaModal key={selected.id_incidencia} incidencia={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// RF-80: expediente del caso para imprimir o guardar como PDF (datos, orden, cotización, evidencias y chat).
async function exportarCaso(id: number) {
  const { data } = await api.get(`/admin/incidencias/${id}/expediente`)
  const inc = data.incidencia
  const campo = (k: string, v: unknown) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v ?? '—')}</dd>`
  const f = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('es-MX') : '—')
  abrirImprimible(`Incidencia ${inc.folio}`, `Orden ${inc.folio_solicitud ?? '—'} · generado ${f(data.generado)}`, `
    <h2>Reporte</h2><dl>${[
      campo('Tipo', TIPO_LABEL[inc.tipo as IncidenciaTipo] ?? inc.tipo), campo('Prioridad', inc.prioridad), campo('Estado', inc.estado),
      campo('Reportó', inc.reporta), campo('Fecha', f(inc.fecha_creacion)), campo('Descripción', inc.descripcion),
      campo('Resolución', inc.resolucion ? ACCION_LABEL[inc.resolucion as AccionIncidencia] : 'Pendiente'),
      campo('Fecha de resolución', f(inc.fecha_resolucion)), campo('Atendió', inc.atendio?.trim() || '—'), campo('Notas internas', inc.notas_admin),
    ].join('')}</dl>
    <h2>Orden de servicio</h2><dl>${[
      campo('Categoría', inc.categoria), campo('Estado', inc.estado_solicitud), campo('Pago', inc.estado_pago), campo('Monto (MXN)', inc.monto),
      campo('Cliente', `${inc.cliente} · ${inc.cliente_correo ?? ''}`), campo('Técnico', inc.tecnico?.trim() ? `${inc.tecnico} · ${inc.tecnico_correo ?? ''}` : 'Sin asignar'),
      campo('Dirección', inc.direccion), campo('Solicitada', f(inc.fecha_solicitud)), campo('Llegada del técnico', f(inc.fecha_llegada)),
    ].join('')}</dl>
    <h2>Cotización</h2>${tablaHtml(['Tipo', 'Concepto', 'Monto (MXN)'], data.conceptos.map((c: { tipo: string; descripcion: string; monto: string }) => [c.tipo, c.descripcion, c.monto]))}
    <h2>Evidencias</h2>${tablaHtml(['Momento', 'Descripción', 'Fecha'], data.evidencias.map((e: { tipo: string; descripcion: string; fecha: string }) => [e.tipo, e.descripcion, f(e.fecha)]))}
    <h2>Chat del servicio (últimos 30 mensajes)</h2>${tablaHtml(['Fecha', 'Quién', 'Mensaje'], data.chat.map((m: { fecha_envio: string; emisor: string; mensaje: string }) => [f(m.fecha_envio), m.emisor, m.mensaje]))}`)
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
          <Button variant="outline" size="sm" style={{ marginRight: 'auto' }}
            onClick={() => exportarCaso(i.id_incidencia).catch(() => setError('No se pudo generar el expediente.'))}>
            <Download size={13} /> EXPORTAR PDF
          </Button>
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
