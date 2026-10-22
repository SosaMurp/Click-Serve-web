import { useState } from "react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts"
import {
  Download, Users, Briefcase, ShieldAlert, DollarSign,
  ChevronRight, Eye, FileText, TrendingUp, TrendingDown,
  RefreshCw, AlertTriangle, Wifi, WifiOff, CheckCircle,
  Clock, XCircle, Activity,
} from "lucide-react"
import { StatCard, Badge } from "@components/ui"
import TechProfileModal from "@components/modals/TechProfileModal"
import ValidationDecisionModal from "@components/modals/ValidationDecisionModal"
import ReportGeneratorModal from "@components/modals/ReportGeneratorModal"
import ServiceDetailModal from "@components/modals/ServiceDetailModal"
import UpdateServiceStatusModal from "@components/modals/UpdateServiceStatusModal"
import {
  useDashboardStats,
  useServiciosMes,
  useRecentServices,
  useActividad,
} from "@hooks/useDashboard"
import type { RecentService, ActividadItem } from "@/types/dashboard"
import "./dashboard.css"

// ── Color palette (matches --accent / --warning / --danger / --info) ────────
const CHART_COLORS = {
  completados: "#00d4a1",
  cancelados:  "#ef4444",
  en_curso:    "#3b82f6",
}

const PIE_COLORS = ["#00d4a1", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]

// ── Skeleton helpers ─────────────────────────────────────────────────────────
function SkeletonBox({ w = "100%", h = 20, radius = 8 }: { w?: string | number; h?: number; radius?: number }) {
  return (
    <div
      className="db-skeleton"
      style={{ width: w, height: h, borderRadius: radius }}
    />
  )
}

function StatCardSkeleton() {
  return (
    <div className="stat-card">
      <div className="stat-icon"><SkeletonBox w={20} h={20} radius={4} /></div>
      <div className="stat-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <SkeletonBox w="60%" h={10} />
        <SkeletonBox w="40%" h={26} />
        <SkeletonBox w="50%" h={10} />
      </div>
    </div>
  )
}

// ── Error banner ─────────────────────────────────────────────────────────────
function ErrorBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="db-error-banner" role="alert">
      <WifiOff size={16} />
      <span>No se pudo cargar la informacion. Verifica tu conexion con el servidor.</span>
      <button className="db-retry-btn" onClick={onRetry}>
        <RefreshCw size={13} /> Reintentar
      </button>
    </div>
  )
}

// ── Tooltip customizado para Recharts ────────────────────────────────────────
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="db-chart-tooltip">
      <p className="db-tooltip-label">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="db-tooltip-item">
          <span className="db-tooltip-dot" style={{ background: p.color }} />
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

// ── Status badge helper ──────────────────────────────────────────────────────
function ServiceStatusBadge({ estatus }: { estatus: RecentService["estatus"] }) {
  const map: Record<RecentService["estatus"], { variant: "success" | "warning" | "danger" | "info" | "neutral"; icon: React.ReactNode }> = {
    Completado: { variant: "success", icon: <CheckCircle size={10} /> },
    "En Curso":  { variant: "info",    icon: <Clock size={10} /> },
    Pendiente:  { variant: "warning",  icon: <Clock size={10} /> },
    Cancelado:  { variant: "danger",   icon: <XCircle size={10} /> },
  }
  const cfg = map[estatus] ?? map.Pendiente
  return (
    <Badge variant={cfg.variant}>
      {cfg.icon} {estatus}
    </Badge>
  )
}

// ── Format helpers ───────────────────────────────────────────────────────────
function parseNum(val: number | string | null | undefined): number {
  if (val == null) return 0
  const n = typeof val === "number" ? val : parseFloat(val)
  return isNaN(n) ? 0 : n
}

function fmtCurrency(n: number | string | null | undefined) {
  const val = parseNum(n)
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(val)
}

function fmtPct(val: number | string | null | undefined): string | null {
  if (val == null || val === "") return null
  const num = typeof val === "number" ? val : parseFloat(val)
  if (isNaN(num)) return null
  return `${num > 0 ? "+" : ""}${num.toFixed(1)}%`
}
function fmtRelTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return "ahora mismo"
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h}h`
  return `hace ${Math.floor(h / 24)}d`
}
function actividadColor(tipo: ActividadItem["tipo"]) {
  const m = { servicio: "accent", tecnico: "warning", pago: "accent", alerta: "danger" } as const
  return m[tipo] ?? "accent"
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [selectedTech, setSelectedTech] = useState<{ id: string; name: string; specialty: string } | null>(null)
  const [selectedService, setSelectedService] = useState<RecentService | null>(null)
  const [isProfileOpen,  setIsProfileOpen]  = useState(false)
  const [isDecisionOpen, setIsDecisionOpen] = useState(false)
  const [isReportOpen,   setIsReportOpen]   = useState(false)
  const [isDetailOpen,   setIsDetailOpen]   = useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)

  // ── Remote data ──
  const stats    = useDashboardStats()
  const mes      = useServiciosMes()
  const recents  = useRecentServices(8)
  const actividad = useActividad()

  const hasAnyError = stats.isError || mes.isError || recents.isError

  return (
    <div className="dash-page fade-in">

      {/* ── Page Header ── */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Vision General</h1>
          <p className="dash-page-sub">METRICAS EN TIEMPO REAL — LAZARO CARDENAS, MICHOACAN</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {stats.isFetching && (
            <span className="db-live-indicator">
              <span className="db-live-dot" />
              ACTUALIZANDO
            </span>
          )}
          <button className="dash-export-btn" onClick={() => setIsReportOpen(true)}>
            <Download size={13} /> EXPORTAR REPORTE
          </button>
        </div>
      </div>

      {/* ── Global error banner ── */}
      {hasAnyError && (
        <ErrorBanner onRetry={() => {
          stats.refetch()
          mes.refetch()
          recents.refetch()
        }} />
      )}

      {/* ── KPI Stat Cards ── */}
      <div className="dash-stats-grid">
        {stats.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : stats.isError ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-card db-stat-error">
              <AlertTriangle size={16} style={{ color: "var(--warning)" }} />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Sin datos</span>
            </div>
          ))
        ) : (
          <>
            <StatCard
              label="Tecnicos Online"
              value={parseNum(stats.data?.tecnicos_online)}
              icon={<Users size={20} />}
              change={fmtPct(stats.data?.variacion_tecnicos_pct) != null
                ? `${fmtPct(stats.data?.variacion_tecnicos_pct)} vs semana anterior`
                : "en activo"}
              changePositive={parseNum(stats.data?.variacion_tecnicos_pct) >= 0}
            />
            <StatCard
              label="Servicios en Curso"
              value={parseNum(stats.data?.servicios_en_curso)}
              icon={<Briefcase size={20} />}
              change="en toda la ciudad"
            />
            <StatCard
              label="Validaciones Pendientes"
              value={parseNum(stats.data?.validaciones_pendientes)}
              icon={<ShieldAlert size={20} />}
              change="Requieren revision manual"
              changePositive={false}
              alert={parseNum(stats.data?.validaciones_pendientes) > 0}
            />
            <StatCard
              label="Ingresos (HOY)"
              value={fmtCurrency(stats.data?.ingresos_hoy)}
              icon={<DollarSign size={20} />}
              change={fmtPct(stats.data?.variacion_ingresos_pct) != null
                ? `${fmtPct(stats.data?.variacion_ingresos_pct)} vs ayer`
                : undefined}
              changePositive={parseNum(stats.data?.variacion_ingresos_pct) >= 0}
            />
          </>
        )}
      </div>

      {/* ── Area Chart — Servicios del Mes ── */}
      <div className="dash-card dash-chart-card">
        <div className="dash-card-header">
          <div>
            <h2 className="dash-card-title">Actividad del Mes</h2>
            <p className="dash-card-sub">SERVICIOS COMPLETADOS, CANCELADOS Y EN CURSO — ULTIMOS 30 DIAS</p>
          </div>
          <div className="db-chart-legend">
            {Object.entries(CHART_COLORS).map(([k, color]) => (
              <span key={k} className="db-legend-item">
                <span className="db-legend-dot" style={{ background: color }} />
                {k}
              </span>
            ))}
          </div>
        </div>

        {mes.isLoading ? (
          <div className="db-chart-skeleton">
            <SkeletonBox w="100%" h={260} radius={12} />
          </div>
        ) : mes.isError ? (
          <div className="db-chart-empty">
            <WifiOff size={28} style={{ color: "var(--text-muted)", opacity: .5 }} />
            <p>No se pudo cargar la grafica</p>
          </div>
        ) : !mes.data?.puntos.length ? (
          <div className="db-chart-empty">
            <Activity size={28} style={{ color: "var(--text-muted)", opacity: .4 }} />
            <p>Sin actividad registrada este mes</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={mes.data.puntos} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00d4a1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#00d4a1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradCancelled" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradActive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" />
              <XAxis
                dataKey="dia"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="completados"
                name="Completados"
                stroke="#00d4a1"
                strokeWidth={2}
                fill="url(#gradCompleted)"
                dot={false}
                activeDot={{ r: 5, fill: "#00d4a1" }}
              />
              <Area
                type="monotone"
                dataKey="cancelados"
                name="Cancelados"
                stroke="#ef4444"
                strokeWidth={1.5}
                fill="url(#gradCancelled)"
                dot={false}
                activeDot={{ r: 4, fill: "#ef4444" }}
              />
              <Area
                type="monotone"
                dataKey="en_curso"
                name="En Curso"
                stroke="#3b82f6"
                strokeWidth={1.5}
                fill="url(#gradActive)"
                dot={false}
                activeDot={{ r: 4, fill: "#3b82f6" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {/* Totales del mes */}
        {mes.data && (
          <div className="db-chart-totals">
            <div className="db-total-chip db-total-chip--green">
              <TrendingUp size={12} />
              <span>{mes.data.total_completados} completados</span>
            </div>
            <div className="db-total-chip db-total-chip--red">
              <TrendingDown size={12} />
              <span>{mes.data.total_cancelados} cancelados</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Lower Grid: tabla + feed ── */}
      <div className="dash-lower-grid">

        {/* Recent Services Table */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div>
              <h2 className="dash-card-title">Servicios Recientes</h2>
              <p className="dash-card-sub">ULTIMOS 8 SERVICIOS REGISTRADOS EN EL SISTEMA</p>
            </div>
            <button className="dash-link-btn" onClick={() => setIsReportOpen(true)}>
              <ChevronRight size={14} /> EXPORTAR
            </button>
          </div>

          {recents.isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <SkeletonBox w="15%" h={12} />
                  <SkeletonBox w="30%" h={12} />
                  <SkeletonBox w="20%" h={20} radius={99} />
                  <SkeletonBox w="15%" h={12} />
                </div>
              ))}
            </div>
          ) : recents.isError ? (
            <div className="db-chart-empty" style={{ height: 140 }}>
              <AlertTriangle size={20} style={{ color: "var(--warning)", opacity: .7 }} />
              <p>Error al cargar servicios recientes</p>
            </div>
          ) : !recents.data?.servicios.length ? (
            <div className="db-chart-empty" style={{ height: 140 }}>
              <Briefcase size={20} style={{ opacity: .4 }} />
              <p>No hay servicios registrados aun</p>
            </div>
          ) : (
            <table className="dash-table">
              <thead>
                <tr>
                  <th>SERVICIO</th>
                  <th>TECNICO</th>
                  <th>ESTATUS</th>
                  <th>MONTO</th>
                  <th>FECHA</th>
                  <th>ACCION</th>
                </tr>
              </thead>
              <tbody>
                {recents.data.servicios.map((srv) => (
                  <tr key={srv.id_servicio}>
                    <td>
                      <p className="dash-table-name">{srv.titulo}</p>
                      <p className="dash-table-id">{srv.codigo}</p>
                    </td>
                    <td>
                      <span className="dash-table-spec">
                        {srv.tecnico_nombre
                          ? `${srv.tecnico_nombre} ${srv.tecnico_apellido ?? ""}`
                          : <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Sin asignar</span>}
                      </span>
                    </td>
                    <td><ServiceStatusBadge estatus={srv.estatus} /></td>
                    <td>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-dark)" }}>
                        {srv.monto != null ? fmtCurrency(srv.monto) : "—"}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {fmtRelTime(srv.fecha_creacion)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button
                          id={`btn-ver-srv-${srv.id_servicio}`}
                          className="dash-action-btn"
                          onClick={() => {
                            setSelectedService(srv)
                            setIsDetailOpen(true)
                          }}
                        >
                          <Eye size={11} /> VER
                        </button>
                        <button
                          id={`btn-resolver-srv-${srv.id_servicio}`}
                          className="dash-action-btn dash-action-btn--outline"
                          onClick={() => {
                            setSelectedService(srv)
                            setIsStatusModalOpen(true)
                          }}
                        >
                          <FileText size={11} /> ESTADO
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Activity Feed */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Actividad LZC</h2>
            {actividad.isFetching && <Wifi size={13} style={{ color: "var(--accent)", opacity: .7 }} className="db-pulse" />}
          </div>

          {actividad.isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ display: "flex", gap: 10 }}>
                  <SkeletonBox w={8} h={8} radius={99} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <SkeletonBox w="30%" h={9} />
                    <SkeletonBox w="90%" h={12} />
                    <SkeletonBox w="60%" h={10} />
                  </div>
                </div>
              ))}
            </div>
          ) : actividad.isError ? (
            <div className="db-chart-empty" style={{ height: 120 }}>
              <AlertTriangle size={18} style={{ color: "var(--warning)", opacity: .7 }} />
              <p style={{ fontSize: 12 }}>Sin conexion al feed</p>
            </div>
          ) : (
            <div className="dash-feed">
              {(actividad.data?.items ?? []).map((item, i) => (
                <div key={item.id ?? i} className="dash-feed-item">
                  <div className={`dash-feed-dot dash-feed-dot--${actividadColor(item.tipo)}`} />
                  <div className="dash-feed-body">
                    <p className="dash-feed-time">{fmtRelTime(item.creado_en)}</p>
                    <p className="dash-feed-text">{item.descripcion}</p>
                    {item.sub && <p className="dash-feed-sub">{item.sub}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <TechProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        techData={selectedTech ? {
          id: selectedTech.id,
          name: selectedTech.name,
          specialty: selectedTech.specialty,
          status: "EN REVISION",
        } : undefined}
      />
      <ValidationDecisionModal
        isOpen={isDecisionOpen}
        onClose={() => setIsDecisionOpen(false)}
        techId={selectedTech?.id}
        techName={selectedTech?.name}
      />
      <ReportGeneratorModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
      />

      {/* ── Modales de Servicio y Notificación ── */}
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
