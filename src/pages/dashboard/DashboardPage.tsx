import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@store/authStore"
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts"
import {
  Download, Users, Briefcase, ShieldCheck, Wallet, CheckCircle2,
  RefreshCw, AlertTriangle, WifiOff, ArrowUpRight, ChevronRight,
  TrendingUp, TrendingDown, Activity, PieChart as PieIcon, Award,
} from "lucide-react"
import RangoFechas from "@components/ui/RangoFechas"
import ReportGeneratorModal from "@components/modals/ReportGeneratorModal"
import ServiceDetailModal from "@components/modals/ServiceDetailModal"
import TechProfileModal from "@components/modals/TechProfileModal"
import {
  useDashboardStats,
  useServiciosMes,
  useActividad,
  useEspecialidadStats,
  useTecnicosDestacados,
} from "@hooks/useDashboard"
import type { ActividadItem } from "@/types/dashboard"
import { etiquetaRango, guardarRango, leerRango, type Rango } from "@/lib/rango"
import { esErrorDeRed, mensajeDeError } from "@/lib/errores"
import "./dashboard.css"

// ── Paleta (azul marino + naranja de la app móvil, sin neón) ────────────────
const C = {
  orange: "#E25900",
  navy:   "#0C1C40",
  slate:  "#667085",
  peach:  "#FF6B00",
  mist:   "#CDD3E0",
  track:  "#E6E9EE",
}
const PIE_COLORS = [C.navy, C.orange, C.slate, C.peach, C.mist, "#4B5563"]
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

// "2026-11-05" → "05 nov"
function fmtDia(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }).replace(".", "")
}

const ACTIVIDAD_ACCION: Record<ActividadItem["tipo"], string> = {
  servicio: "Ver el servicio",
  tecnico:  "Ver el expediente del técnico",
  alerta:   "Ir a la incidencia en Soporte",
  pago:     "Ir a Finanzas",
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
      <p className="db-tooltip-label">{label && /^\d{4}-\d{2}-\d{2}$/.test(label) ? fmtDia(label) : label}</p>
      {payload.map((p) => (
        <p key={p.name} className="db-tooltip-item">
          <span className="db-dot" style={{ background: p.color }} />
          {p.name}<strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

// ── KPI card ─────────────────────────────────────────────────────────────────
interface KpiProps {
  label: string
  value: string | number
  icon: React.ReactNode
  tone: "orange" | "navy" | "blue" | "green" | "amber"
  delta?: number | string | null
  note: string
  /** Texto para cuando no hay variación que comparar: `note` habla de una comparación que no se muestra. */
  fallbackNote?: string
  to?: string
}

function KpiCard({ label, value, icon, tone, delta, note, fallbackNote, to }: KpiProps) {
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
      <p className="db-kpi-note">{!hasDelta && fallbackNote ? fallbackNote : note}</p>
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
  const navigate = useNavigate()
  const [rango, setRangoState] = useState<Rango>(leerRango)
  const [isReportOpen, setIsReportOpen] = useState(false)
  // Elemento de la actividad reciente que se está inspeccionando
  const [servicioId, setServicioId] = useState<number | null>(null)
  const [tecnicoId, setTecnicoId] = useState<number | null>(null)

  const setRango = (r: Rango) => { setRangoState(r); guardarRango(r) }

  const nombre = useAuthStore(s => s.user?.nombre?.trim())
  const stats     = useDashboardStats(rango)
  const mes       = useServiciosMes(rango)
  const actividad = useActividad(rango)
  const especialidades = useEspecialidadStats(rango)
  const destacados = useTecnicosDestacados(rango)
  const etiqueta = etiquetaRango(rango)
  const esHoy = rango.preset === "hoy"

  const consultas = [stats, mes, actividad, especialidades, destacados]
  const primerError = consultas.find(q => q.isError)?.error
  const hasAnyError = Boolean(primerError)
  const sinRed = esErrorDeRed(primerError)
  const pendientes = parseNum(stats.data?.validaciones_pendientes)
  const totalEsp = (Array.isArray(especialidades.data) ? especialidades.data : []).reduce((acc, e) => acc + parseNum(e.total), 0)

  const topTecnicos = destacados.data?.tecnicos ?? []
  const maxServicios = Math.max(1, ...topTecnicos.map(t => t.servicios))

  // Cada fila de la actividad reciente lleva al elemento: se inspecciona aquí o se abre su sección
  const abrirActividad = (item: ActividadItem) => {
    if (item.tipo === "servicio") setServicioId(item.id)
    else if (item.tipo === "tecnico") setTecnicoId(item.id)
    else if (item.tipo === "alerta") navigate("/soporte", { state: { incidencia: item.id } })
    else navigate("/finanzas")
  }

  return (
    <div className="dash-page fade-in">

      {/* ── Header ── */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">{greeting()}{nombre ? `, ${nombre}` : ""}</h1>
          <p className="dash-page-sub">Resumen de la operación en Lázaro Cárdenas</p>
        </div>
        <div className="db-header-actions">
          <RangoFechas value={rango} onChange={setRango} />
          <button className="db-btn-outline" onClick={() => setIsReportOpen(true)}>
            <Download size={15} /> Exportar reporte
          </button>
        </div>
      </div>

      {hasAnyError && (
        <div className="db-error-banner" role="alert">
          {sinRed ? <WifiOff size={16} /> : <AlertTriangle size={16} />}
          <span>
            {sinRed
              ? 'No hay conexión con el servidor. Revisa tu red o que el backend esté encendido.'
              : `Parte del tablero no se pudo cargar: ${mensajeDeError(primerError, 'error del servidor.')}`}
          </span>
          <button className="db-retry-btn" onClick={() => consultas.forEach(q => { if (q.isError) q.refetch() })}>
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
              delta={stats.data?.variacion_tecnicos_pct} note="vs semana anterior" fallbackNote="Conectados ahora" to="/tecnicos" />
            <KpiCard label="Servicios en curso" tone="blue" icon={<Briefcase size={15} />}
              value={parseNum(stats.data?.servicios_en_curso)}
              note="En toda la ciudad" to="/mapa" />
            <KpiCard label="Validaciones" tone="amber" icon={<ShieldCheck size={15} />}
              value={pendientes}
              note={pendientes > 0 ? "Pendientes de revisión" : "Todo al día"} to="/validaciones" />
            <KpiCard label={esHoy ? "Ingresos de hoy" : "Ingresos del periodo"} tone="orange" icon={<Wallet size={15} />}
              value={fmtCurrency(stats.data?.ingresos_periodo)}
              delta={stats.data?.variacion_ingresos_pct} note={esHoy ? "vs ayer" : "vs periodo anterior"}
              fallbackNote={`Pagos confirmados · ${etiqueta}`} to="/finanzas" />
            <KpiCard label="Completados" tone="green" icon={<CheckCircle2 size={15} />}
              value={parseNum(stats.data?.servicios_completados_periodo)}
              delta={stats.data?.variacion_completados_pct} note={esHoy ? "vs ayer" : "vs periodo anterior"}
              fallbackNote={`Finalizados · ${etiqueta}`} />
          </>
        )}
      </section>

      {/* ── Gráfica + distribución ── */}
      <div className="db-grid-2">
        <section className="db-panel">
          <PanelHead title="Servicios por día" sub={etiqueta}>
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
            <PanelEmpty icon={<Activity size={22} />} text="Sin servicios registrados en este periodo" height={270} />
          ) : (
            <ResponsiveContainer width="100%" height={270}>
              <ComposedChart data={mes.data.puntos} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#E6E9EE" />
                <XAxis dataKey="fecha" tickFormatter={fmtDia} tick={{ fontSize: 11, fill: "#667085" }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tick={{ fontSize: 11, fill: "#667085" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(10,25,47,.03)" }} />
                <Bar dataKey="en_curso" name="En curso" fill={C.track} radius={[4, 4, 0, 0]} maxBarSize={10} />
                <Line type="monotone" dataKey="completados" name="Completados" stroke={C.orange} strokeWidth={2.5} dot={false} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} />
                <Line type="monotone" dataKey="cancelados" name="Cancelados" stroke={C.navy} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="db-panel">
          <PanelHead title="Por especialidad" sub={`Servicios finalizados · ${etiqueta}`} />
          {especialidades.isLoading ? (
            <SkeletonBox h={270} radius={10} />
          ) : especialidades.isError ? (
            <PanelEmpty icon={<WifiOff size={22} />} text="No disponible" height={270} />
          ) : !Array.isArray(especialidades.data) || !especialidades.data.length ? (
            <PanelEmpty icon={<PieIcon size={22} />} text="Sin servicios finalizados en este periodo" height={270} />
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
          <PanelHead title="Técnicos destacados" sub={`Más servicios finalizados · ${etiqueta}`} />
          {destacados.isLoading ? (
            <div className="db-list-skeleton">{Array.from({ length: 4 }).map((_, i) => <SkeletonBox key={i} h={30} />)}</div>
          ) : destacados.isError ? (
            <PanelEmpty icon={<WifiOff size={20} />} text="No disponible" height={200} />
          ) : !topTecnicos.length ? (
            <PanelEmpty icon={<Award size={20} />} text="Sin técnicos con servicios en este periodo" height={200} />
          ) : (
            <ul className="db-rank">
              {topTecnicos.map((t, i) => (
                <li key={t.id_usuario}>
                  <div className="db-rank-row">
                    <span className="db-rank-avatar" style={{ background: RANK_COLORS[i % RANK_COLORS.length] }}>{t.nombre[0]}</span>
                    <span className="db-rank-name">{`${t.nombre} ${t.apellido ?? ""}`.trim()}</span>
                    <span className="db-rank-meta">{t.servicios} serv. · {fmtCurrency(t.monto)}</span>
                  </div>
                  <div className="db-progress">
                    <span style={{ width: `${(t.servicios / maxServicios) * 100}%`, background: RANK_COLORS[i % RANK_COLORS.length] }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="db-panel">
          <PanelHead title="Completados vs cancelados" sub={etiqueta} />
          {mes.isLoading ? (
            <SkeletonBox h={200} radius={10} />
          ) : (
            <SuccessGauge completed={parseNum(mes.data?.total_completados)} cancelled={parseNum(mes.data?.total_cancelados)} />
          )}
        </section>

        <section className="db-panel">
          <PanelHead title="Actividad reciente" sub={`Toca un elemento para abrirlo · ${etiqueta}`} />
          {actividad.isLoading ? (
            <div className="db-list-skeleton">{Array.from({ length: 4 }).map((_, i) => <SkeletonBox key={i} h={28} />)}</div>
          ) : actividad.isError ? (
            <PanelEmpty icon={<AlertTriangle size={18} />} text="Sin conexión al feed" height={200} />
          ) : !actividad.data?.items?.length ? (
            <PanelEmpty icon={<Activity size={18} />} text="Sin actividad en este periodo" height={200} />
          ) : (
            <ul className="db-feed">
              {actividad.data.items.slice(0, 5).map((item, i) => (
                <li key={`${item.tipo}-${item.id ?? i}`} className="db-feed-item">
                  <button type="button" className="db-feed-btn" onClick={() => abrirActividad(item)}
                    title={ACTIVIDAD_ACCION[item.tipo]} aria-label={`${ACTIVIDAD_ACCION[item.tipo]}: ${item.descripcion}`}>
                    <span className="db-feed-dot" style={{ background: ACTIVIDAD_COLOR[item.tipo] ?? C.navy }} />
                    <div className="db-feed-body">
                      <p className="db-feed-text">{item.descripcion}</p>
                      {item.sub && <p className="db-feed-sub">{item.sub}</p>}
                    </div>
                    <span className="db-feed-time">{fmtRelTime(item.creado_en)}</span>
                    <ChevronRight size={14} className="db-feed-go" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── Modales ── */}
      <ReportGeneratorModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} />

      {servicioId != null && (
        <ServiceDetailModal isOpen onClose={() => setServicioId(null)} serviceId={servicioId} />
      )}
      <TechProfileModal isOpen={tecnicoId != null} onClose={() => setTecnicoId(null)} userId={tecnicoId} />
    </div>
  )
}
