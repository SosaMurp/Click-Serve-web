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
  /** Suma de pagos procesados hoy */
  ingresos_hoy: number | string
  /** Suma de pagos procesados dentro del rango elegido */
  ingresos_periodo: number | string
  /** Servicios finalizados dentro del rango elegido */
  servicios_completados_periodo: number
  /** Servicios completados el mes actual */
  servicios_completados_mes: number
  /** Rango que usó el servidor (AAAA-MM-DD) */
  periodo: { desde: string; hasta: string }
  /** Total de clientes registrados */
  total_clientes: number
  /** Variacion porcentual de tecnicos online vs semana anterior (puede ser negativo) */
  variacion_tecnicos_pct: number | string | null
  /** Variacion porcentual de ingresos del rango vs el periodo anterior de la misma duracion */
  variacion_ingresos_pct: number | string | null
  /** Variacion porcentual de servicios finalizados vs el periodo anterior */
  variacion_completados_pct: number | string | null
}

// ── Punto de datos para la grafica de servicios por dia ────────────────────────

export interface ServiciosDiaPoint {
  /** Fecha "YYYY-MM-DD" (el panel la formatea para mostrarla) */
  fecha: string
  completados: number
  cancelados: number
  en_curso: number
}

export interface ServiciosMesResponse {
  periodo: { desde: string; hasta: string }
  /** Un punto por dia del rango elegido */
  puntos: ServiciosDiaPoint[]
  /** Totales del periodo */
  total_completados: number
  total_cancelados: number
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

// ── Tecnicos con mas servicios en el rango ────────────────────────────────────

export interface TecnicoDestacado {
  id_usuario: number
  nombre: string
  apellido: string | null
  servicios: number
  monto: number | string
}

export interface TecnicosDestacadosResponse {
  periodo: { desde: string; hasta: string }
  tecnicos: TecnicoDestacado[]
}
