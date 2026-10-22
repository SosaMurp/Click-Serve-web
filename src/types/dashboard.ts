/**
 * dashboard.ts — Interfaces TypeScript para las respuestas del endpoint /admin/dashboard/stats
 * Modelan los datos consolidados que devuelve el backend con GROUP BY y funciones de agregacion.
 */

// ── Metricas de cabecera (tarjetas de KPIs) ──────────────────────────────────

export interface DashboardStats {
  /** Tecnicos con sesion activa y estado_cuenta = "Activo" */
  tecnicos_online: number
  /** Servicios con estatus "En Curso" */
  servicios_en_curso: number
  /** Expedientes con estatus "En Revision" o "Pendiente" */
  validaciones_pendientes: number
  /** Suma de pagos procesados hoy (CURRENT_DATE) */
  ingresos_hoy: number | string
  /** Servicios completados el mes actual */
  servicios_completados_mes: number
  /** Total de clientes registrados */
  total_clientes: number
  /** Variacion porcentual de tecnicos online vs semana anterior (puede ser negativo) */
  variacion_tecnicos_pct: number | string | null
  /** Variacion porcentual de ingresos hoy vs ayer */
  variacion_ingresos_pct: number | string | null
}

// ── Punto de datos para la grafica de servicios por dia ────────────────────────

export interface ServiciosDiaPoint {
  /** Formato "DD MMM" ej. "01 Oct" */
  dia: string
  /** Fecha ISO para sorting "YYYY-MM-DD" */
  fecha: string
  completados: number
  cancelados: number
  en_curso: number
}

export interface ServiciosMesResponse {
  /** Ultimos 30 dias de actividad */
  puntos: ServiciosDiaPoint[]
  /** Totales del periodo */
  total_completados: number
  total_cancelados: number
}

// ── Servicios recientes (tabla de actividad) ────────────────────────────────────

export interface RecentService {
  id_servicio: number
  /** Codigo visible: "SRV-108" */
  codigo: string
  titulo: string
  estatus: "Pendiente" | "En Curso" | "Completado" | "Cancelado"
  tecnico_nombre: string | null
  tecnico_apellido: string | null
  cliente_nombre: string
  cliente_apellido: string
  monto: number | null
  fecha_creacion: string
  direccion: string | null
}

export interface RecentServicesResponse {
  servicios: RecentService[]
  total: number
}

// ── Actividad reciente del feed ────────────────────────────────────────────────

export type ActividadTipo = "servicio" | "tecnico" | "pago" | "alerta"

export interface ActividadItem {
  id: number
  tipo: ActividadTipo
  descripcion: string
  sub: string | null
  /** ISO timestamp */
  creado_en: string
  urgente: boolean
}

export interface ActividadResponse {
  items: ActividadItem[]
}

// ── Distribucion de servicios por especialidad (pie/donut) ────────────────────

export interface EspecialidadStat {
  especialidad: string
  total: number
  porcentaje: number
}
