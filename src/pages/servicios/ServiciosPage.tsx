import { useEffect, useState } from 'react'
import { Search, Siren, ChevronLeft, ChevronRight, RefreshCw, AlertTriangle } from 'lucide-react'
import { Badge } from '@components/ui'
import PageHeader from '@components/ui/PageHeader'
import MetricStrip, { type Metric } from '@components/ui/MetricStrip'
import ServiceDetailModal from '@components/modals/ServiceDetailModal'
import { useServiciosLista } from '@hooks/useServicios'
import type { EstadoServicio, ServicioFila } from '@api/servicios'
import { mensajeDeError } from '@/lib/errores'
import './servicios.css'

const ESTATUS_BADGE = { Completado: 'success', Cancelado: 'danger', Pendiente: 'neutral', 'En Curso': 'warning' } as const

const persona = (n?: string | null, a?: string | null) => [n, a].filter(Boolean).join(' ')
const dinero = (v?: string | number | null) =>
  v == null || v === '' || Number(v) === 0 ? '—' : Number(v).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** Todos los servicios de la plataforma: filtro por estado, búsqueda y detalle (con cancelación sin cargo). */
export default function ServiciosPage() {
  const [estado, setEstado] = useState<EstadoServicio>('todos')
  const [texto, setTexto] = useState('')
  const [q, setQ] = useState('')
  const [pagina, setPagina] = useState(1)
  const [abierto, setAbierto] = useState<number | null>(null)

  // La búsqueda espera a que se deje de escribir y vuelve a la primera página
  useEffect(() => {
    const t = window.setTimeout(() => { setQ(texto.trim()); setPagina(1) }, 300)
    return () => window.clearTimeout(t)
  }, [texto])

  const { data, isLoading, isError, error, refetch, isFetching } = useServiciosLista({ estado, q, pagina })
  const c = data?.conteos
  const filas: ServicioFila[] = data?.servicios ?? []

  const metricas: Metric[] = [
    { id: 'todos', label: 'Todos', value: c?.todos ?? '—' },
    { id: 'pendiente', label: 'Pendientes', value: c?.pendiente ?? '—' },
    { id: 'en_curso', label: 'En curso', value: c?.en_curso ?? '—' },
    { id: 'completado', label: 'Completados', value: c?.completado ?? '—', tone: 'ok' },
    { id: 'cancelado', label: 'Cancelados', value: c?.cancelado ?? '—' },
  ]

  return (
    <div className="srv-page fade-in">
      <PageHeader title="Servicios" sub="Todas las solicitudes de la plataforma" />

      <MetricStrip items={metricas} active={estado} label="Filtrar por estado"
        onSelect={id => { setEstado(id as EstadoServicio); setPagina(1) }} />

      <div className="val-toolbar">
        <div className="val-search">
          <Search size={14} />
          <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Buscar por folio, cliente, técnico o dirección…"
            aria-label="Buscar servicios" />
        </div>
        {isFetching && !isLoading && <span className="srv-sync" role="status">Actualizando…</span>}
      </div>

      <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div className="srv-state">Cargando servicios…</div>
        ) : isError ? (
          <div className="srv-state srv-state--error" role="alert">
            <AlertTriangle size={16} /> {mensajeDeError(error, 'No se pudieron cargar los servicios.')}
            <button type="button" className="db-retry-btn" onClick={() => refetch()}><RefreshCw size={13} /> Reintentar</button>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="dash-table srv-table">
              <thead>
                <tr>
                  <th>Servicio</th>
                  <th>Cliente</th>
                  <th>Técnico</th>
                  <th>Estado</th>
                  <th className="srv-num">Monto</th>
                  <th>Creado</th>
                </tr>
              </thead>
              <tbody>
                {filas.length === 0 && (
                  <tr><td colSpan={6} className="srv-empty table-empty">
                    {q || estado !== 'todos' ? 'Ningún servicio coincide con la búsqueda o el filtro.' : 'Todavía no hay servicios registrados.'}
                  </td></tr>
                )}
                {filas.map(s => (
                  <tr key={s.id_servicio}>
                    <td>
                      <button type="button" className="srv-open" onClick={() => setAbierto(s.id_servicio)} aria-label={`Abrir el servicio ${s.codigo}`}>
                        <span className="dash-table-name">{s.titulo}</span>
                        <span className="dash-table-id">{s.codigo}{s.direccion ? ` · ${s.direccion}` : ''}</span>
                      </button>
                    </td>
                    <td>{persona(s.cliente_nombre, s.cliente_apellido) || <span className="srv-muted">—</span>}</td>
                    <td>{persona(s.tecnico_nombre, s.tecnico_apellido) || <span className="srv-muted">Sin asignar</span>}</td>
                    <td>
                      <span className="srv-estado">
                        <Badge variant={ESTATUS_BADGE[s.estatus] ?? 'neutral'}>{s.estatus}</Badge>
                        {s.alerta_sos && <Badge variant="danger"><Siren size={11} /> SOS</Badge>}
                      </span>
                    </td>
                    <td className="srv-num">{dinero(s.monto)}</td>
                    <td className="srv-muted">{fecha(s.fecha_creacion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data && data.paginas > 1 && (
        <nav className="srv-pager" aria-label="Paginación">
          <button type="button" className="db-btn-outline" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>
            <ChevronLeft size={14} /> Anterior
          </button>
          <span>Página {data.pagina} de {data.paginas} · {data.total} servicios</span>
          <button type="button" className="db-btn-outline" disabled={pagina >= data.paginas} onClick={() => setPagina(p => p + 1)}>
            Siguiente <ChevronRight size={14} />
          </button>
        </nav>
      )}

      {abierto != null && <ServiceDetailModal isOpen onClose={() => setAbierto(null)} serviceId={abierto} />}
    </div>
  )
}
