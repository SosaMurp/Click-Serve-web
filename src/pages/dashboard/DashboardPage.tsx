import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@store/authStore"
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts"
import {
  Download, ShieldCheck, RefreshCw, AlertTriangle, WifiOff, ArrowUpRight,
  TrendingUp, TrendingDown, Activity, PieChart as PieIcon, Award, Users, Wrench, DollarSign,
  type LucideIcon,
} from "lucide-react"
import PageHeader from "@components/ui/PageHeader"
import RangoFechas from "@components/ui/RangoFechas"
import ReportGeneratorModal from "@components/modals/ReportGeneratorModal"
import ServiceDetailModal from "@components/modals/ServiceDetailModal"
import TechProfileModal from "@components/modals/TechProfileModal"
import {
  useDashboardStats,
  useServiciosMes,
  useEspecialidadStats,
  useTecnicosDestacados,
  usePendientes,
} from "@hooks/useDashboard"
import type { ActividadItem } from "@/types/dashboard"
import { etiquetaRango, guardarRango, leerRango, type Rango } from "@/lib/rango"
import { esErrorDeRed, mensajeDeError } from "@/lib/errores"
import CentroActividad from "./CentroActividad"
import "./dashboard.css"

// ── Paleta: azul marino + naranja de la app móvil, con turquesa y cielo de apoyo ──
const C = {
  orange: "#E25900",
  navy:   "#0C1C40",
  teal:   "#0E7C86",
  sky:    "#2F6FD0",
  skyBar: "#B9CEF3",
  slate:  "#667085",
  peach:  "#FF6B00",
  mist:   "#CDD3E0",
  track:  "#E6E9EE",
}
const PIE_COLORS = [C.navy, C.orange, C.teal, C.sky, C.slate, C.mist]
const RANK_COLORS = [C.orange, C.teal, C.sky, C.navy]

// ── Helpers ──────────────────────────────────────────────────────────────────
function parseNum(val: number | string | null | undefined): number {
  if (val == null) return 0
  const n = typeof val === "number" ? val : parseFloat(val)
  return isNaN(n) ? 0 : n
}

function fmtCurrency(n: number | string | null | undefined) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(parseNum(n))
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

// ── Métrica del resumen ──────────────────────────────────────────────────────
function Metric({ label, value, note, delta, to, icon: Icon, tono }: {
  label: string; value: string | number; note?: string; delta?: number | string | null; to?: string
  icon?: LucideIcon; tono?: "teal" | "sky" | "orange"
}) {
  const navigate = useNavigate()
  const hasDelta = delta != null && delta !== "" && !isNaN(parseNum(delta))
  const d = parseNum(delta)
  return (
    <div className="db-metric">
      <div className="db-metric-head">
        <span className="db-metric-label">
          {Icon && <span className={`db-metric-ico db-metric-ico--${tono ?? "sky"}`} aria-hidden><Icon size={15} /></span>}
          {label}
        </span>
        {to && (
          <button type="button" className="db-kpi-link" title={`Ir a ${label.toLowerCase()}`} aria-label={`Ir a ${label.toLowerCase()}`} onClick={() => navigate(to)}>
            <ArrowUpRight size={14} />
          </button>
        )}
      </div>
      <div className="db-metric-body">
        <span className="db-metric-value">{value}</span>
        {hasDelta && (
          <span className={`db-delta ${d >= 0 ? "db-delta--up" : "db-delta--down"}`}>
            {d >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {d > 0 ? "+" : ""}{d.toFixed(1)}%
          </span>
        )}
      </div>
      {note && <p className="db-metric-note">{note}</p>}
    </div>
  )
}

type Vista = "especialidades" | "tecnicos" | "exito"

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate()
  const [rango, setRangoState] = useState<Rango>(leerRango)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [vista, setVista] = useState<Vista>("especialidades")
  // Elemento del centro de actividad que se está inspeccionando
  const [servicioId, setServicioId] = useState<number | null>(null)
  const [tecnicoId, setTecnicoId] = useState<number | null>(null)

  const setRango = (r: Rango) => { setRangoState(r); guardarRango(r) }

  const nombre = useAuthStore(s => s.user?.nombre?.trim())
  const stats = useDashboardStats(rango)
  const mes = useServiciosMes(rango)
  const especialidades = useEspecialidadStats(rango)
  const destacados = useTecnicosDestacados(rango)
  const pendientes = usePendientes()
  const etiqueta = etiquetaRango(rango)
  const esHoy = rango.preset === "hoy"

  const consultas = [stats, mes, especialidades, destacados, pendientes]
  const primerError = consultas.find(q => q.isError)?.error
  const hasAnyError = Boolean(primerError)
  const sinRed = esErrorDeRed(primerError)
  const totalEsp = (Array.isArray(especialidades.data) ? especialidades.data : []).reduce((acc, e) => acc + parseNum(e.total), 0)
  const topTecnicos = destacados.data?.tecnicos ?? []
  const maxServicios = Math.max(1, ...topTecnicos.map(t => t.servicios))
  const pend = pendientes.data
  const porAtender = [
    { id: "retiros", label: "Retiros por autorizar", n: pend?.retiros ?? 0, to: "/finanzas" },
    { id: "incidencias", label: "Incidencias abiertas", n: pend?.incidencias ?? 0, to: "/soporte" },
    { id: "tickets", label: "Tickets sin responder", n: pend?.tickets ?? 0, to: "/soporte", state: { seccion: "tickets" } },
  ]

  // Cada fila del centro de actividad lleva al elemento: se inspecciona aquí o se abre su sección
  const abrirActividad = (item: ActividadItem) => {
    if (item.tipo === "servicio") setServicioId(item.id)
    else if (item.tipo === "tecnico") setTecnicoId(item.id)
    else if (item.tipo === "alerta") navigate("/soporte", { state: { incidencia: item.id } })
    else if (item.tipo === "ticket") navigate("/soporte", { state: { seccion: "tickets" } })
    else navigate("/finanzas")
  }

  const VISTAS: { id: Vista; label: string }[] = [
    { id: "especialidades", label: "Por especialidad" },
    { id: "tecnicos", label: "Técnicos destacados" },
    { id: "exito", label: "Completados vs cancelados" },
  ]

  return (
    <div className="dash-page fade-in">

      <PageHeader title={`${greeting()}${nombre ? `, ${nombre}` : ""}`} sub="Resumen de la operación en Lázaro Cárdenas">
        <RangoFechas value={rango} onChange={setRango} />
        <button className="db-btn-outline" onClick={() => setIsReportOpen(true)}>
          <Download size={15} /> Exportar reporte
        </button>
      </PageHeader>

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

      {/* ── Por atender + resumen de la operación ── */}
      <section className="db-hero" aria-label="Resumen">
        <div className="db-hero-main">
          <h2 className="db-panel-title">Por atender</h2>
          {pendientes.isLoading ? (
            <div className="db-todo"><SkeletonBox h={86} radius={12} /><SkeletonBox h={86} radius={12} /></div>
          ) : pendientes.isError ? (
            <PanelEmpty icon={<AlertTriangle size={18} />} text="Pendientes no disponibles" height={110} />
          ) : (
            <div className="db-todo">
              <button type="button" className={`db-todo-main ${(pend?.validaciones ?? 0) > 0 ? "db-todo-main--alert" : ""}`} onClick={() => navigate("/validaciones")}>
                <ShieldCheck size={20} aria-hidden />
                <span className="db-todo-num">{pend?.validaciones ?? 0}</span>
                <span className="db-todo-label">{(pend?.validaciones ?? 0) === 1 ? "Técnico por validar" : "Técnicos por validar"}</span>
              </button>
              <ul className="db-todo-list">
                {porAtender.map(p => (
                  <li key={p.id}>
                    <button type="button" className={`db-todo-item ${p.n === 0 ? "db-todo-item--zero" : ""}`}
                      onClick={() => navigate(p.to, p.state ? { state: p.state } : undefined)}>
                      <span className="db-todo-count">{p.n}</span>
                      <span>{p.label}</span>
                      <ArrowUpRight size={14} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="db-hero-side">
          {stats.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <SkeletonBox key={i} h={64} radius={10} />)
          ) : stats.isError ? (
            <PanelEmpty icon={<AlertTriangle size={18} />} text="Métricas no disponibles" height={110} />
          ) : (
            <>
              <Metric label="Técnicos en línea" icon={Users} tono="teal" value={parseNum(stats.data?.tecnicos_online)} note="Conectados ahora" to="/tecnicos" />
              <Metric label="Servicios en curso" icon={Wrench} tono="sky" value={parseNum(stats.data?.servicios_en_curso)} note="En toda la ciudad" to="/mapa" />
              <Metric label={esHoy ? "Ingresos de hoy" : "Ingresos del periodo"} icon={DollarSign} tono="orange" value={fmtCurrency(stats.data?.ingresos_periodo)}
                delta={stats.data?.variacion_ingresos_pct} note={esHoy ? "vs ayer" : `vs periodo anterior · ${etiqueta}`} to="/finanzas" />
            </>
          )}
        </div>
      </section>

      {/* ── Gráfica + centro de actividad ── */}
      <div className="db-grid-main">
        <section className="db-panel">
          <PanelHead title="Servicios por día" sub={etiqueta}>
            <div className="db-legend">
              <span className="db-legend-item"><span className="db-dot" style={{ background: C.orange }} />Completados</span>
              <span className="db-legend-item"><span className="db-dot" style={{ background: C.navy }} />Cancelados</span>
              <span className="db-legend-item"><span className="db-dot db-dot--sq" style={{ background: C.skyBar }} />En curso</span>
            </div>
          </PanelHead>

          {mes.isLoading ? (
            <SkeletonBox h={270} radius={10} />
          ) : mes.isError ? (
            <PanelEmpty icon={<WifiOff size={22} />} text="No se pudo cargar la gráfica" height={270} />
          ) : !mes.data?.puntos?.length ? (
            <PanelEmpty icon={<Activity size={22} />} text="Sin servicios registrados en este periodo" height={270} />
          ) : (
            <ResponsiveContainer width="100%" height={290}>
              <ComposedChart data={mes.data.puntos} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#E6E9EE" />
                <XAxis dataKey="fecha" tickFormatter={fmtDia} tick={{ fontSize: 12, fill: "#667085" }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tick={{ fontSize: 12, fill: "#667085" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(10,25,47,.03)" }} />
                <Bar dataKey="en_curso" name="En curso" fill={C.skyBar} radius={[4, 4, 0, 0]} maxBarSize={10} />
                <Line type="monotone" dataKey="completados" name="Completados" stroke={C.orange} strokeWidth={2.5} dot={false} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} />
                <Line type="monotone" dataKey="cancelados" name="Cancelados" stroke={C.navy} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </section>

        <CentroActividad onAbrir={abrirActividad} />
      </div>

      {/* ── Rendimiento: una sola tarjeta con tres vistas ── */}
      <section className="db-panel">
        <PanelHead title="Rendimiento" sub={etiqueta}>
          <div className="ca-chips" role="tablist" aria-label="Vista de rendimiento">
            {VISTAS.map(v => (
              <button key={v.id} type="button" role="tab" aria-selected={vista === v.id}
                className={`ca-chip ${vista === v.id ? "ca-chip--on" : ""}`} onClick={() => setVista(v.id)}>{v.label}</button>
            ))}
          </div>
        </PanelHead>

        {vista === "especialidades" && (
          especialidades.isLoading ? (
            <SkeletonBox h={200} radius={10} />
          ) : especialidades.isError ? (
            <PanelEmpty icon={<WifiOff size={22} />} text="No disponible" height={200} />
          ) : !Array.isArray(especialidades.data) || !especialidades.data.length ? (
            <PanelEmpty icon={<PieIcon size={22} />} text="Sin servicios finalizados en este periodo" height={200} />
          ) : (
            <div className="db-donut-wrap db-donut-wrap--wide">
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
                {especialidades.data.slice(0, 6).map((e, i) => (
                  <li key={e.especialidad}>
                    <span className="db-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="db-breakdown-name">{e.especialidad}</span>
                    <span className="db-breakdown-pct">{e.total} · {parseNum(e.porcentaje).toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        )}

        {vista === "tecnicos" && (
          destacados.isLoading ? (
            <div className="db-list-skeleton">{Array.from({ length: 4 }).map((_, i) => <SkeletonBox key={i} h={30} />)}</div>
          ) : destacados.isError ? (
            <PanelEmpty icon={<WifiOff size={20} />} text="No disponible" height={200} />
          ) : !topTecnicos.length ? (
            <PanelEmpty icon={<Award size={20} />} text="Sin técnicos con servicios en este periodo" height={200} />
          ) : (
            <ul className="db-rank db-rank--wide">
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
          )
        )}

        {vista === "exito" && (
          mes.isLoading ? (
            <SkeletonBox h={200} radius={10} />
          ) : (
            <div className="db-gauge-wrap">
              <SuccessGauge completed={parseNum(mes.data?.total_completados)} cancelled={parseNum(mes.data?.total_cancelados)} />
            </div>
          )
        )}
      </section>

      {/* ── Modales ── */}
      <ReportGeneratorModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} />
      {servicioId != null && (
        <ServiceDetailModal isOpen onClose={() => setServicioId(null)} serviceId={servicioId} />
      )}
      <TechProfileModal isOpen={tecnicoId != null} onClose={() => setTecnicoId(null)} userId={tecnicoId} />
    </div>
  )
}
