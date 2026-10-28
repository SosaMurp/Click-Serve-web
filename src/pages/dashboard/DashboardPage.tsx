import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@store/authStore"
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts"
import {
  Download, Users, Briefcase, ShieldCheck, Wallet, CheckCircle2, CalendarDays,
  Eye, Pencil, RefreshCw, AlertTriangle, WifiOff, ArrowUpRight,
  TrendingUp, TrendingDown, Activity, PieChart as PieIcon, Award,
} from "lucide-react"
import { Badge } from "@components/ui"
import ReportGeneratorModal from "@components/modals/ReportGeneratorModal"
import ServiceDetailModal from "@components/modals/ServiceDetailModal"
import UpdateServiceStatusModal from "@components/modals/UpdateServiceStatusModal"
import {
  useDashboardStats,
  useServiciosMes,
  useRecentServices,
  useActividad,
  useEspecialidadStats,
} from "@hooks/useDashboard"
import type { RecentService, ActividadItem } from "@/types/dashboard"
import "./dashboard.css"

// ── Paleta (azul marino + naranja de la app móvil, sin neón) ────────────────
const C = {
  orange: "#E8590C",
  navy:   "#0A192F",
  slate:  "#64748B",
  peach:  "#F4A26B",
  mist:   "#CBD5E1",
  track:  "#E8ECF1",
}
const PIE_COLORS = [C.navy, C.orange, C.slate, C.peach, C.mist, "#334155"]
const RANK_COLORS = [C.orange, C.navy, C.slate, C.peach]

// ── Helpers ──────────────────────────────────────────────────────────────────
function parseNum(val: number | string | null | undefined): number {
  if (val == null) return 0
  const n = typeof val === "number" ? val : parseFloat(val)
  return isNaN(n) ? 0 : n
}

function fmtCurrency(n: number | string | null | undefined) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(parseNum(n))
}

function fmtRelTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return "ahora"
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} d`
}

function greeting(date = new Date()) {
  const h = date.getHours()
  if (h >= 5 && h < 12) return "Buenos días"
  if (h >= 12 && h < 19) return "Buenas tardes"
  return "Buenas noches"
}

function fmtRange() {
  const end = new Date()
  const start = new Date(end.getTime() - 29 * 864e5)
  const f = (d: Date) => d.toLocaleDateString("es-MX", { day: "numeric", month: "short" }).replace(".", "")
  return `${f(start)} – ${f(end)} ${end.getFullYear()}`
}

const ACTIVIDAD_COLOR: Record<ActividadItem["tipo"], string> = {
  servicio: C.navy,
  tecnico:  C.orange,
  pago:     "#15803D",
  alerta:   "#B91C1C",
}

// ── Pequeños componentes ─────────────────────────────────────────────────────
function SkeletonBox({ w = "100%", h = 20, radius = 8 }: { w?: string | number; h?: number; radius?: number }) {
  return <div className="db-skeleton" style={{ width: w, height: h, borderRadius: radius }} />
}

function PanelEmpty({ icon, text, height = 220 }: { icon: React.ReactNode; text: string; height?: number }) {
  return (
    <div className="db-empty" style={{ height }}>
      {icon}
      <p>{text}</p>
    </div>
  )
}

function PanelHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <header className="db-panel-head">
      <div>
        <h2 className="db-panel-title">{title}</h2>
        {sub && <p className="db-panel-sub">{sub}</p>}
      </div>
      {children}
    </header>
  )
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="db-tooltip">
      <p className="db-tooltip-label">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="db-tooltip-item">
          <span className="db-dot" style={{ background: p.color }} />
          {p.name}<strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

function ServiceStatusBadge({ estatus }: { estatus: RecentService["estatus"] }) {
  const map: Record<RecentService["estatus"], "success" | "warning" | "danger" | "info"> = {
    Completado: "success",
    "En Curso": "info",
    Pendiente:  "warning",
    Cancelado:  "danger",
  }
  return <Badge variant={map[estatus] ?? "warning"} dot>{estatus}</Badge>
}

// ── KPI card ─────────────────────────────────────────────────────────────────
interface KpiProps {
  label: string
  value: string | number
  icon: React.ReactNode
  tone: "orange" | "navy" | "blue" | "green" | "amber"
  delta?: number | string | null
  note: string
  to?: string
}

function KpiCard({ label, value, icon, tone, delta, note, to }: KpiProps) {
  const navigate = useNavigate()
  const hasDelta = delta != null && delta !== "" && !isNaN(parseNum(delta))
  const d = parseNum(delta)
  return (
    <div className="db-kpi">
      <div className="db-kpi-head">
        <span className={`db-kpi-icon db-kpi-icon--${tone}`}>{icon}</span>
        <span className="db-kpi-label">{label}</span>
        {to && (
          <button className="db-kpi-link" title={`Ir a ${label.toLowerCase()}`} onClick={() => navigate(to)}>
            <ArrowUpRight size={15} />
          </button>
        )}
      </div>
      <div className="db-kpi-body">
        <p className="db-kpi-value">{value}</p>
        {hasDelta && (
          <span className={`db-delta ${d >= 0 ? "db-delta--up" : "db-delta--down"}`}>
            {d >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {d > 0 ? "+" : ""}{d.toFixed(1)}%
          </span>
        )}
      </div>
      <p className="db-kpi-note">{note}</p>
    </div>
  )
}

// ── Medidor semicircular de tasa de éxito ───────────────────────────────────
function SuccessGauge({ completed, cancelled }: { completed: number; cancelled: number }) {
  const total = completed + cancelled
  const rate = total ? completed / total : 0
  const TICKS = 44
  const filled = Math.round(rate * TICKS)
  const cx = 130, cy = 120, r1 = 82, r2 = 108

  return (
    <div className="db-gauge">
      <svg viewBox="0 0 260 132" role="img" aria-label={`Tasa de éxito ${Math.round(rate * 100)}%`}>
        {Array.from({ length: TICKS }).map((_, i) => {
          const a = Math.PI - (i / (TICKS - 1)) * Math.PI
          const cos = Math.cos(a), sin = Math.sin(a)
          return (
            <line
              key={i}
              x1={cx + r1 * cos} y1={cy - r1 * sin}
              x2={cx + r2 * cos} y2={cy - r2 * sin}
              stroke={i < filled ? C.orange : C.track}
              strokeWidth={3.5}
              strokeLinecap="round"
            />
          )
        })}
      </svg>
      <div className="db-gauge-center">
        <p className="db-gauge-label">Tasa de éxito</p>
        <p className="db-gauge-value">{total ? `${Math.round(rate * 100)}%` : "—"}</p>
      </div>
      <div className="db-gauge-foot">
        <div>
          <p className="db-gauge-foot-label"><span className="db-dot" style={{ background: C.orange }} />Completados</p>
          <p className="db-gauge-foot-value">{completed}</p>
        </div>
        <div>
          <p className="db-gauge-foot-label"><span className="db-dot" style={{ background: C.track }} />Cancelados</p>
          <p className="db-gauge-foot-value">{cancelled}</p>
        </div>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [selectedService, setSelectedService] = useState<RecentService | null>(null)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)

  const nombre = useAuthStore(s => s.user?.nombre?.trim())
  const stats     = useDashboardStats()
  const mes       = useServiciosMes()
  const recents   = useRecentServices(20)
  const actividad = useActividad()
  const especialidades = useEspecialidadStats()

  const hasAnyError = stats.isError || mes.isError || recents.isError
  const pendientes = parseNum(stats.data?.validaciones_pendientes)
  const totalEsp = (Array.isArray(especialidades.data) ? especialidades.data : []).reduce((acc, e) => acc + parseNum(e.total), 0)

  // Técnicos con más servicios entre los registros recientes
  const topTecnicos = useMemo(() => {
    const acc: Record<string, { nombre: string; servicios: number; monto: number }> = {}
    for (const s of recents.data?.servicios ?? []) {
      if (!s.tecnico_nombre) continue
      const nombre = `${s.tecnico_nombre} ${s.tecnico_apellido ?? ""}`.trim()
      acc[nombre] ??= { nombre, servicios: 0, monto: 0 }
      acc[nombre].servicios += 1
      acc[nombre].monto += parseNum(s.monto)
    }
    return Object.values(acc).sort((a, b) => b.servicios - a.servicios || b.monto - a.monto).slice(0, 4)
  }, [recents.data])
  const maxServicios = Math.max(1, ...topTecnicos.map(t => t.servicios))

  return (
    <div className="dash-page fade-in">

      {/* ── Header ── */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">{greeting()}{nombre ? `, ${nombre}` : ""}</h1>
          <p className="dash-page-sub">Resumen de la operación en Lázaro Cárdenas</p>
        </div>
        <div className="db-header-actions">
          <span className="db-range"><CalendarDays size={15} /> {fmtRange()}</span>
          <button className="db-btn-outline" onClick={() => setIsReportOpen(true)}>
            <Download size={15} /> Exportar reporte
          </button>
        </div>
      </div>

      {hasAnyError && (
        <div className="db-error-banner" role="alert">
          <WifiOff size={16} />
          <span>No se pudo cargar la información. Verifica tu conexión con el servidor.</span>
          <button className="db-retry-btn" onClick={() => { stats.refetch(); mes.refetch(); recents.refetch() }}>
            <RefreshCw size={13} /> Reintentar
          </button>
        </div>
      )}

      {/* ── KPI cards ── */}
      <section className="db-kpis">
        {stats.isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="db-kpi">
              <SkeletonBox w="70%" h={14} />
              <SkeletonBox w="50%" h={26} />
              <SkeletonBox w="60%" h={10} />
            </div>
          ))
        ) : stats.isError ? (
          <div className="db-kpi db-kpis-error"><AlertTriangle size={15} /> Métricas no disponibles</div>
        ) : (
          <>
            <KpiCard label="Técnicos en línea" tone="navy" icon={<Users size={15} />}
              value={parseNum(stats.data?.tecnicos_online)}
              delta={stats.data?.variacion_tecnicos_pct} note="vs semana anterior" to="/tecnicos" />
            <KpiCard label="Servicios en curso" tone="blue" icon={<Briefcase size={15} />}
              value={parseNum(stats.data?.servicios_en_curso)}
              note="En toda la ciudad" to="/mapa" />
            <KpiCard label="Validaciones" tone="amber" icon={<ShieldCheck size={15} />}
              value={pendientes}
              note={pendientes > 0 ? "Pendientes de revisión" : "Todo al día"} to="/validaciones" />
            <KpiCard label="Ingresos de hoy" tone="orange" icon={<Wallet size={15} />}
              value={fmtCurrency(stats.data?.ingresos_hoy)}
              delta={stats.data?.variacion_ingresos_pct} note="vs ayer" to="/finanzas" />
            <KpiCard label="Completados" tone="green" icon={<CheckCircle2 size={15} />}
              value={parseNum(stats.data?.servicios_completados_mes)}
              note="En este mes" />
          </>
        )}
      </section>

      {/* ── Gráfica + distribución ── */}
      <div className="db-grid-2">
        <section className="db-panel">
          <PanelHead title="Servicios del mes" sub="Últimos 30 días">
            <div className="db-legend">
              <span className="db-legend-item"><span className="db-dot" style={{ background: C.orange }} />Completados</span>
              <span className="db-legend-item"><span className="db-dot" style={{ background: C.navy }} />Cancelados</span>
              <span className="db-legend-item"><span className="db-dot db-dot--sq" style={{ background: C.mist }} />En curso</span>
            </div>
          </PanelHead>

          {mes.isLoading ? (
            <SkeletonBox h={270} radius={10} />
          ) : mes.isError ? (
            <PanelEmpty icon={<WifiOff size={22} />} text="No se pudo cargar la gráfica" height={270} />
          ) : !mes.data?.puntos?.length ? (
            <PanelEmpty icon={<Activity size={22} />} text="Sin actividad registrada en los últimos 30 días" height={270} />
          ) : (
            <ResponsiveContainer width="100%" height={270}>
              <ComposedChart data={mes.data.puntos} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#EEF1F4" />
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(10,25,47,.03)" }} />
                <Bar dataKey="en_curso" name="En curso" fill={C.track} radius={[4, 4, 0, 0]} barSize={10} />
                <Line type="monotone" dataKey="completados" name="Completados" stroke={C.orange} strokeWidth={2.5} dot={false} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} />
                <Line type="monotone" dataKey="cancelados" name="Cancelados" stroke={C.navy} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="db-panel">
          <PanelHead title="Por especialidad" sub="Distribución de servicios" />
          {especialidades.isLoading ? (
            <SkeletonBox h={270} radius={10} />
          ) : especialidades.isError ? (
            <PanelEmpty icon={<WifiOff size={22} />} text="No disponible" height={270} />
          ) : !Array.isArray(especialidades.data) || !especialidades.data.length ? (
            <PanelEmpty icon={<PieIcon size={22} />} text="Sin servicios registrados" height={270} />
          ) : (
            <div className="db-donut-wrap">
              <div className="db-donut">
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie data={especialidades.data} dataKey="total" nameKey="especialidad"
                      innerRadius={58} outerRadius={88} paddingAngle={2} stroke="none" startAngle={90} endAngle={-270}>
                      {especialidades.data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="db-donut-center">
                  <p className="db-donut-value">{totalEsp}</p>
                  <p className="db-donut-label">servicios</p>
                </div>
              </div>
              <ul className="db-breakdown">
                {especialidades.data.slice(0, 5).map((e, i) => (
                  <li key={e.especialidad}>
                    <span className="db-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="db-breakdown-name">{e.especialidad}</span>
                    <span className="db-breakdown-pct">{parseNum(e.porcentaje).toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* ── Fila de tres ── */}
      <div className="db-grid-3">
        <section className="db-panel">
          <PanelHead title="Técnicos destacados" sub="Más servicios recientes" />
          {recents.isLoading ? (
            <div className="db-list-skeleton">{Array.from({ length: 4 }).map((_, i) => <SkeletonBox key={i} h={30} />)}</div>
          ) : !topTecnicos.length ? (
            <PanelEmpty icon={<Award size={20} />} text="Aún no hay técnicos con servicios" height={200} />
          ) : (
            <ul className="db-rank">
              {topTecnicos.map((t, i) => (
                <li key={t.nombre}>
                  <div className="db-rank-row">
                    <span className="db-rank-avatar" style={{ background: RANK_COLORS[i] }}>{t.nombre[0]}</span>
                    <span className="db-rank-name">{t.nombre}</span>
                    <span className="db-rank-meta">{t.servicios} serv. · {fmtCurrency(t.monto)}</span>
                  </div>
                  <div className="db-progress">
                    <span style={{ width: `${(t.servicios / maxServicios) * 100}%`, background: RANK_COLORS[i] }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="db-panel">
          <PanelHead title="Completados vs cancelados" sub="Últimos 30 días" />
          {mes.isLoading ? (
            <SkeletonBox h={200} radius={10} />
          ) : (
            <SuccessGauge completed={parseNum(mes.data?.total_completados)} cancelled={parseNum(mes.data?.total_cancelados)} />
          )}
        </section>

        <section className="db-panel">
          <PanelHead title="Actividad reciente" sub="Se actualiza automáticamente" />
          {actividad.isLoading ? (
            <div className="db-list-skeleton">{Array.from({ length: 4 }).map((_, i) => <SkeletonBox key={i} h={28} />)}</div>
          ) : actividad.isError ? (
            <PanelEmpty icon={<AlertTriangle size={18} />} text="Sin conexión al feed" height={200} />
          ) : !actividad.data?.items?.length ? (
            <PanelEmpty icon={<Activity size={18} />} text="Sin actividad reciente" height={200} />
          ) : (
            <ul className="db-feed">
              {actividad.data.items.slice(0, 5).map((item, i) => (
                <li key={item.id ?? i} className="db-feed-item">
                  <span className="db-feed-dot" style={{ background: ACTIVIDAD_COLOR[item.tipo] ?? C.navy }} />
                  <div className="db-feed-body">
                    <p className="db-feed-text">{item.descripcion}</p>
                    {item.sub && <p className="db-feed-sub">{item.sub}</p>}
                  </div>
                  <span className="db-feed-time">{fmtRelTime(item.creado_en)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── Servicios recientes ── */}
      <section className="db-panel">
        <PanelHead title="Servicios recientes" sub="Últimos registrados en el sistema" />
        {recents.isLoading ? (
          <div className="db-list-skeleton">{Array.from({ length: 5 }).map((_, i) => <SkeletonBox key={i} h={14} />)}</div>
        ) : recents.isError ? (
          <PanelEmpty icon={<AlertTriangle size={20} />} text="Error al cargar servicios recientes" height={140} />
        ) : !recents.data?.servicios?.length ? (
          <PanelEmpty icon={<Briefcase size={20} />} text="Aún no hay servicios registrados" height={140} />
        ) : (
          <div className="db-table-wrap">
            <table className="db-table">
              <thead>
                <tr>
                  <th>Servicio</th>
                  <th>Cliente</th>
                  <th>Técnico</th>
                  <th>Estado</th>
                  <th className="db-num">Monto</th>
                  <th>Fecha</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {recents.data.servicios.slice(0, 6).map((srv) => (
                  <tr key={srv.id_servicio}>
                    <td>
                      <p className="db-cell-main">{srv.titulo}</p>
                      <p className="db-cell-sub">{srv.codigo}</p>
                    </td>
                    <td className="db-cell-text">{srv.cliente_nombre} {srv.cliente_apellido}</td>
                    <td className="db-cell-text">
                      {srv.tecnico_nombre
                        ? `${srv.tecnico_nombre} ${srv.tecnico_apellido ?? ""}`
                        : <span className="db-muted">Sin asignar</span>}
                    </td>
                    <td><ServiceStatusBadge estatus={srv.estatus} /></td>
                    <td className="db-num db-cell-main">{srv.monto != null ? fmtCurrency(srv.monto) : "—"}</td>
                    <td className="db-muted">{fmtRelTime(srv.fecha_creacion)}</td>
                    <td>
                      <div className="db-row-actions">
                        <button id={`btn-ver-srv-${srv.id_servicio}`} className="db-icon-btn" title="Ver detalle"
                          onClick={() => { setSelectedService(srv); setIsDetailOpen(true) }}>
                          <Eye size={15} />
                        </button>
                        <button id={`btn-resolver-srv-${srv.id_servicio}`} className="db-icon-btn" title="Cambiar estado"
                          onClick={() => { setSelectedService(srv); setIsStatusModalOpen(true) }}>
                          <Pencil size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Modales ── */}
      <ReportGeneratorModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} />

      {selectedService && (
        <>
          <ServiceDetailModal
            isOpen={isDetailOpen}
            onClose={() => setIsDetailOpen(false)}
            serviceId={selectedService.id_servicio}
            title={selectedService.titulo}
            clientName={`${selectedService.cliente_nombre} ${selectedService.cliente_apellido}`}
            techName={selectedService.tecnico_nombre ? `${selectedService.tecnico_nombre} ${selectedService.tecnico_apellido ?? ''}` : 'Sin asignar'}
            status={selectedService.estatus}
            onStatusUpdated={() => {
              // React Query invalidará automáticamente las listas
            }}
          />
          <UpdateServiceStatusModal
            isOpen={isStatusModalOpen}
            onClose={() => setIsStatusModalOpen(false)}
            serviceId={selectedService.id_servicio}
            serviceCode={selectedService.codigo}
            serviceTitle={selectedService.titulo}
            currentStatus={selectedService.estatus}
            clientName={`${selectedService.cliente_nombre} ${selectedService.cliente_apellido}`}
          />
        </>
      )}
    </div>
  )
}
