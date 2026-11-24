import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Search, X, Download } from 'lucide-react'
import { Badge, Button } from '@components/ui'
import PageHeader from '@components/ui/PageHeader'
import MetricStrip from '@components/ui/MetricStrip'
import { useIncidencias, useUpdateIncidencia } from '../../hooks/useAdminQueries'
import type { AccionIncidencia, IncidenciaRow, IncidenciaTipo, Prioridad } from '../../types/api'
import '@components/modals/modals.css'
import TicketsPanel from './TicketsPanel'
import LiquidacionModal from '@components/modals/LiquidacionModal'
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

type Vista = 'abiertas' | 'alta' | 'sos' | 'resueltas'

export default function SoportePage() {
  const [seccion, setSeccion] = useState<'incidencias' | 'tickets'>('incidencias')
  const [vista, setVista] = useState<Vista>('abiertas')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<IncidenciaRow | null>(null)

  const abiertas = useIncidencias('ABIERTA')
  const resueltas = useIncidencias('RESUELTA')
  const actual = vista === 'resueltas' ? resueltas : abiertas

  // Llegar desde la actividad reciente del tablero: abre directamente esa incidencia (una sola vez)
  const location = useLocation()
  const navigate = useNavigate()
  const pedida = (location.state as { incidencia?: number } | null)?.incidencia
  const yaAbierta = useRef(false)
  const seccionPedida = (location.state as { seccion?: string } | null)?.seccion
  useEffect(() => {
    if (seccionPedida !== 'tickets') return
    setSeccion('tickets')
    navigate(location.pathname, { replace: true, state: null })
  }, [seccionPedida, navigate, location.pathname])
  useEffect(() => {
    if (pedida == null || yaAbierta.current) return
    const fila = abiertas.data?.find(i => i.id_incidencia === pedida) ?? resueltas.data?.find(i => i.id_incidencia === pedida)
    if (fila) {
      yaAbierta.current = true
      setVista(fila.estado === 'RESUELTA' ? 'resueltas' : 'abiertas')
      setSelected(fila)
      navigate(location.pathname, { replace: true, state: null }) // al recargar no se vuelve a abrir
    } else if (abiertas.isSuccess && resueltas.isSuccess) {
      yaAbierta.current = true // ya no existe o no es visible: se queda la lista
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [pedida, abiertas.data, resueltas.data, abiertas.isSuccess, resueltas.isSuccess, navigate, location.pathname])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = actual.data ?? []
    const rows = vista === 'alta' ? base.filter(i => i.prioridad === 'ALTA') : vista === 'sos' ? base.filter(i => i.tipo === 'SEGURIDAD') : base
    if (!q) return rows
    return rows.filter(i =>
      [i.folio, i.folio_solicitud ?? '', persona(i.cliente_nombre, i.cliente_apellido), persona(i.tecnico_nombre, i.tecnico_apellido), i.descripcion]
        .some(v => v.toLowerCase().includes(q)),
    )
  }, [actual.data, search, vista])

  const altas = (abiertas.data ?? []).filter(i => i.prioridad === 'ALTA').length
  const seguridad = (abiertas.data ?? []).filter(i => i.tipo === 'SEGURIDAD').length
  const valor = (n: number) => (abiertas.isError ? '—' : String(n))

  return (
    <div className="sop-page fade-in">
      <PageHeader title="Soporte" sub="Incidencias de servicios y tickets de clientes y técnicos" />

      <div className="tec-tabs" role="tablist" aria-label="Secciones de soporte">
        <button type="button" role="tab" aria-selected={seccion === 'incidencias'} className={`tec-tab ${seccion === 'incidencias' ? 'tec-tab--active' : ''}`} onClick={() => setSeccion('incidencias')}>
          Incidencias de servicios
        </button>
        <button type="button" role="tab" aria-selected={seccion === 'tickets'} className={`tec-tab ${seccion === 'tickets' ? 'tec-tab--active' : ''}`} onClick={() => setSeccion('tickets')}>
          Tickets de soporte
        </button>
      </div>

      {seccion === 'tickets' ? <TicketsPanel /> : (
      <>
      <MetricStrip label="Filtrar incidencias" active={vista} onSelect={id => setVista(id as Vista)} items={[
        { id: 'abiertas', label: 'Abiertas', value: valor(abiertas.data?.length ?? 0) },
        { id: 'alta', label: 'Prioridad alta', value: valor(altas), tone: altas > 0 ? 'alert' : 'default' },
        { id: 'sos', label: 'Seguridad / SOS', value: valor(seguridad), tone: seguridad > 0 ? 'alert' : 'default' },
        { id: 'resueltas', label: 'Resueltas', value: resueltas.isError ? '—' : String(resueltas.data?.length ?? 0) },
      ]} />

      <div className="val-toolbar">
        <div className="val-search">
          <Search size={14} />
          <input type="search" aria-label="Buscar incidencias" placeholder="Buscar por folio, orden, cliente, técnico o descripción…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-scroll"><table className="dash-table sop-table">
          <thead>
            <tr>
              <th>Folio / fecha</th>
              <th>Tipo</th>
              <th>Cliente / técnico</th>
              <th>Orden</th>
              <th>Prioridad</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {actual.isLoading && <tr><td colSpan={6} className="sop-empty table-empty">Cargando incidencias…</td></tr>}
            {actual.isError && (
              <tr><td colSpan={6} className="sop-empty table-empty">
                No se pudieron cargar las incidencias.{' '}
                <button className="sop-view-btn" onClick={() => actual.refetch()}>Reintentar</button>
              </td></tr>
            )}
            {!actual.isLoading && !actual.isError && filtered.length === 0 && (
              <tr><td colSpan={6} className="sop-empty table-empty">{vista === 'resueltas' ? 'Todavía no hay incidencias resueltas.' : vista === 'abiertas' ? 'No hay incidencias abiertas.' : 'Ninguna incidencia abierta coincide con este filtro.'}</td></tr>
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
      ...(inc.fecha_liquidacion ? [
        campo('Liquidado', f(inc.fecha_liquidacion)), campo('Reembolso al cliente (MXN)', inc.monto_reembolso),
        campo('Multa al técnico (MXN)', inc.multa), campo('Devolución descontada al técnico', inc.reembolso_a_cargo_tecnico ? 'Sí' : 'No'),
      ] : []),
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
  const [liquidando, setLiquidando] = useState(false)
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


  return (
    <>
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
              <div className="field">
                <label className="field-label" htmlFor="inc-prioridad">Prioridad</label>
                <select id="inc-prioridad" className="field-input" value={prioridad} onChange={e => setPrioridad(e.target.value as Prioridad)}>
                  <option value="ALTA">Alta</option>
                  <option value="MEDIA">Media</option>
                  <option value="BAJA">Baja</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="inc-notas">Notas internas</label>
                <textarea id="inc-notas" className="field-input" rows={3} value={notas} onChange={e => setNotas(e.target.value)}
                  placeholder="Qué se revisó, con quién se habló…" />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="inc-accion">Resolver</label>
                <select id="inc-accion" className="field-input" value={accion} onChange={e => setAccion(e.target.value as AccionIncidencia | '')}>
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
          {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger-ink)' }}>{error}</p>}
        </div>

        <div className="modal-footer">
          <Button variant="outline" size="sm" style={{ marginRight: 'auto' }}
            onClick={() => exportarCaso(i.id_incidencia).catch(() => setError('No se pudo generar el expediente.'))}>
            <Download size={13} /> EXPORTAR PDF
          </Button>
          {i.id_solicitud != null && (
            <Button variant="outline" size="sm" onClick={() => setLiquidando(true)}>
              {i.fecha_liquidacion ? 'VER LIQUIDACIÓN' : 'LIQUIDAR'}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>{abierta ? 'CANCELAR' : 'CERRAR'}</Button>
          {abierta && (
            <Button variant="primary" size="sm" loading={update.isPending} onClick={guardar}>
              {accion ? 'GUARDAR Y RESOLVER' : 'GUARDAR'}
            </Button>
          )}
        </div>
      </div>
    </div>
    {liquidando && <LiquidacionModal incidencia={i} onClose={() => setLiquidando(false)} />}
    </>
  )
}
