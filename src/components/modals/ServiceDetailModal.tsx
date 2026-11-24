import { useState } from 'react'
import { X, MapPin, Calendar, Star, Eye, AlertTriangle, CheckSquare, Square, XCircle, RefreshCw, CreditCard, Siren } from 'lucide-react'
import { Badge, Button } from '@components/ui'
import CancelServiceModal from './CancelServiceModal'
import { useServicioDetalle } from '@hooks/useServicios'
import { fileUrl } from '@/lib/archivos'
import { mensajeDeError } from '@/lib/errores'
import { formatearTelefono } from '@/lib/formatos'
import type { ServicioDetalle } from '@/types/servicios'
import './modals.css'

interface ServiceDetailModalProps {
  isOpen: boolean
  onClose: () => void
  serviceId: number
  onStatusUpdated?: () => void
}

const ESTADO_APP: Record<string, string> = {
  PENDIENTE: 'Buscando técnico', ASIGNADA: 'Técnico asignado', EN_CAMINO: 'Técnico en camino', EN_SITIO: 'Técnico en el domicilio',
  ESPERANDO_APROBACION: 'Cotización por aprobar', EN_PROCESO: 'Trabajo en proceso', POR_CONFIRMAR: 'Esperando confirmación y pago',
  SUSPENDIDA: 'Suspendido por incidencia', FINALIZADA: 'Finalizado y pagado', CANCELADA: 'Cancelado',
}
const EVIDENCIA: Record<string, string> = { PRE_TRABAJO: 'Antes', EN_PROCESO: 'Durante', POST_TRABAJO: 'Después' }
const BADGE = { Completado: 'success', Cancelado: 'danger', Pendiente: 'neutral', 'En Curso': 'warning' } as const

const fechaHora = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const dinero = (v?: string | number | null) =>
  v == null || v === '' ? '—' : Number(v).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
const nombre = (n?: string | null, a?: string | null) => `${n ?? ''} ${a ?? ''}`.trim() || null

const caja = { padding: 14, border: '1px solid var(--border-light)', borderRadius: 8 } as const
const etiqueta = { fontSize: 12, fontWeight: 700, color: 'var(--text-mid)', textTransform: 'uppercase', margin: '0 0 6px' } as const

function Estrellas({ valor }: { valor: number | null }) {
  if (valor == null) return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sin calificar</span>
  return (
    <span role="img" aria-label={`${valor} de 5 estrellas`} style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(n => <Star key={n} size={16} color="#F2A91E" fill={n <= valor ? '#F2A91E' : 'none'} aria-hidden />)}
    </span>
  )
}

export default function ServiceDetailModal({ isOpen, onClose, serviceId, onStatusUpdated }: ServiceDetailModalProps) {
  const [tab, setTab] = useState<'detalles' | 'evidencias' | 'calificaciones'>('detalles')
  const [ampliada, setAmpliada] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const { data: s, isLoading, isError, error, refetch } = useServicioDetalle(isOpen ? serviceId : null)

  if (!isOpen) return null

  const cerrado = s ? ['FINALIZADA', 'CANCELADA'].includes(s.estado_app) : true
  const conCobro = s ? ['PROCESANDO', 'PAGADO'].includes(String(s.estado_pago)) : false

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-container--lg modal-container--fixed fade-in">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">Detalle del servicio {s?.codigo ?? `#${serviceId}`}</h3>
            <p className="modal-subtitle">{s ? ESTADO_APP[s.estado_app] ?? s.estado_app : 'Cargando…'}</p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-tabs" role="tablist" aria-label="Secciones del servicio">
          {([['detalles', 'Resumen y tareas'], ['evidencias', `Evidencias (${s?.evidencias.length ?? 0})`], ['calificaciones', 'Calificaciones']] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id}
              className={`modal-tab-btn ${tab === id ? 'modal-tab-btn--active' : ''}`} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {isLoading && <p style={{ fontSize: 13, color: 'var(--text-mid)' }}>Cargando el expediente del servicio…</p>}

          {isError && (
            <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--danger-ink)' }}>
              <AlertTriangle size={16} /> {mensajeDeError(error, 'No se pudo cargar el servicio.')}
              <Button size="sm" variant="outline" onClick={() => refetch()}><RefreshCw size={13} /> Reintentar</Button>
            </div>
          )}

          {s && tab === 'detalles' && <Resumen s={s} />}

          {s && tab === 'evidencias' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {s.evidencias.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>El técnico todavía no sube fotos de este servicio.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
                  {s.evidencias.map(e => (
                    <figure key={e.id_evidencia} style={{ margin: 0, border: '1px solid var(--border-light)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-sunk)' }}>
                      <button type="button" onClick={() => setAmpliada(fileUrl(e.url))} aria-label={`Ampliar evidencia ${EVIDENCIA[e.tipo_evidencia] ?? ''}`}
                        style={{ display: 'block', width: '100%', padding: 0, border: 'none', cursor: 'zoom-in', background: 'none' }}>
                        <img src={fileUrl(e.url)} alt={e.descripcion || `Evidencia ${EVIDENCIA[e.tipo_evidencia] ?? ''}`} style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                      </button>
                      <figcaption style={{ padding: '6px 8px', fontSize: 12, color: 'var(--text-mid)' }}>
                        <strong>{EVIDENCIA[e.tipo_evidencia] ?? e.tipo_evidencia}</strong> · {fechaHora(e.fecha_subida)}
                        {e.descripcion && <><br />{e.descripcion}</>}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
              {ampliada && (
                <div className="doc-preview-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <strong style={{ fontSize: 13 }}>Evidencia ampliada</strong>
                    <Button size="sm" variant="ghost" onClick={() => setAmpliada(null)}><Eye size={13} /> Cerrar</Button>
                  </div>
                  <img src={ampliada} alt="Evidencia ampliada" className="doc-img" />
                </div>
              )}
            </div>
          )}

          {s && tab === 'calificaciones' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {!s.calificacion ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aún no hay calificaciones: se registran al finalizar el servicio.</p>
              ) : (
                <>
                  <div style={caja}>
                    <p style={etiqueta}>El cliente calificó al técnico</p>
                    <Estrellas valor={s.calificacion.puntuacion_tecnico} />
                    {s.calificacion.comentario_cliente && <p style={{ fontSize: 13, margin: '8px 0 0', fontStyle: 'italic' }}>“{s.calificacion.comentario_cliente}”</p>}
                  </div>
                  <div style={caja}>
                    <p style={etiqueta}>El técnico calificó al cliente</p>
                    <Estrellas valor={s.calificacion.puntuacion_cliente} />
                    {s.calificacion.comentario_tecnico && <p style={{ fontSize: 13, margin: '8px 0 0', fontStyle: 'italic' }}>“{s.calificacion.comentario_tecnico}”</p>}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {s && !cerrado && (
            <Button variant="outline" onClick={() => setCancelOpen(true)} disabled={conCobro}
              title={conCobro ? 'Ya tiene un cobro: atiéndelo como incidencia desde Soporte.' : undefined}
              style={{ color: 'var(--danger)', marginRight: 'auto' }}>
              <XCircle size={14} /> Cancelar sin cargo
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        </div>
      </div>

      {s && (
        <CancelServiceModal
          isOpen={cancelOpen}
          onClose={() => setCancelOpen(false)}
          serviceId={s.id_servicio}
          serviceCode={s.codigo}
          serviceTitle={s.titulo}
          clientName={nombre(s.cliente_nombre, s.cliente_apellido) ?? undefined}
          onCancelled={onStatusUpdated}
        />
      )}
    </div>
  )
}

function Resumen({ s }: { s: ServicioDetalle }) {
  const cliente = nombre(s.cliente_nombre, s.cliente_apellido) ?? 'Cliente eliminado'
  const tecnico = nombre(s.tecnico_nombre, s.tecnico_apellido)
  const hechas = s.tareas.filter(t => t.completada).length
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...caja, background: 'var(--bg-sunk)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge variant={BADGE[s.estatus] ?? 'neutral'}>{s.estatus}</Badge>
            {s.alerta_sos && <Badge variant="danger"><Siren size={11} /> SOS activado</Badge>}
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, margin: '6px 0 0' }}>{s.titulo}</p>
          {s.descripcion && <p style={{ fontSize: 13, color: 'var(--text-mid)', margin: '4px 0 0' }}>{s.descripcion}</p>}
          <p style={{ fontSize: 12, color: 'var(--text-mid)', margin: '6px 0 0', display: 'flex', gap: 4, alignItems: 'center' }}>
            <MapPin size={13} /> {s.direccion || 'Sin dirección'}{s.referencias ? ` · ${s.referencias}` : ''}
          </p>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-mid)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span><Calendar size={12} /> Creado: {fechaHora(s.fecha_creacion)}</span>
          {s.fecha_preferida && <span>Preferido: {s.fecha_preferida}{s.hora_preferida ? ` ${s.hora_preferida}` : ''}</span>}
          {s.fecha_llegada && <span>Llegada: {fechaHora(s.fecha_llegada)}</span>}
          {s.fecha_finalizacion && <span>Finalizado: {fechaHora(s.fecha_finalizacion)}</span>}
        </div>
      </div>

      {s.estatus === 'Cancelado' && s.motivo_cancelacion && (
        <div style={{ ...caja, borderColor: 'var(--danger-soft)', background: 'var(--danger-soft)', fontSize: 13 }}>
          <strong>Cancelado{s.cancelado_por ? ` por ${s.cancelado_por.toLowerCase()}` : ''}:</strong> {s.motivo_cancelacion}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div style={caja}>
          <p style={etiqueta}>Cliente</p>
          <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{cliente}</p>
          {s.cliente_telefono && <p style={{ fontSize: 12, color: 'var(--text-mid)', margin: '2px 0 0' }}>Tel. {formatearTelefono(s.cliente_telefono)}</p>}
          {s.cliente_correo && <p style={{ fontSize: 12, color: 'var(--text-mid)', margin: '2px 0 0' }}>{s.cliente_correo}</p>}
        </div>
        <div style={caja}>
          <p style={etiqueta}>Técnico</p>
          <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{tecnico ?? 'Sin asignar'}</p>
          {s.id_tecnico && <p style={{ fontSize: 12, color: 'var(--text-mid)', margin: '2px 0 0' }}>ID-{s.id_tecnico}{s.tecnico_telefono ? ` · Tel. ${formatearTelefono(s.tecnico_telefono)}` : ''}</p>}
        </div>
        <div style={caja}>
          <p style={etiqueta}><CreditCard size={11} /> Cobro</p>
          <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{dinero(s.pago?.monto ?? s.monto)}</p>
          <p style={{ fontSize: 12, color: 'var(--text-mid)', margin: '2px 0 0' }}>
            {s.pago ? `${s.pago.estado} · ${s.pago.modo}${Number(s.pago.monto_reembolsado) > 0 ? ` · reembolsado ${dinero(s.pago.monto_reembolsado)}` : ''}` : `Estado: ${s.estado_pago ?? 'PENDIENTE'}`}
          </p>
        </div>
      </div>

      <div>
        <p style={etiqueta}>Tareas del técnico ({hechas}/{s.tareas.length})</p>
        {s.tareas.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Se generan cuando un técnico acepta el servicio.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {s.tareas.map(t => (
              <li key={t.id_tarea} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', background: 'var(--bg-sunk)', borderRadius: 6, fontSize: 13 }}>
                {t.completada ? <CheckSquare size={15} color="var(--success)" aria-label="Completada" /> : <Square size={15} color="var(--text-muted)" aria-label="Pendiente" />}
                <span style={{ textDecoration: t.completada ? 'line-through' : 'none', color: t.completada ? 'var(--text-muted)' : 'inherit' }}>{t.descripcion}</span>
                {t.norma && <Badge variant="info">{t.norma}</Badge>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {s.incidencias.length > 0 && (
        <div>
          <p style={etiqueta}>Incidencias</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {s.incidencias.map(i => (
              <li key={i.id_incidencia}>{i.folio} · {i.tipo.replace(/_/g, ' ').toLowerCase()} · <strong>{i.estado}</strong> ({i.prioridad})</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
