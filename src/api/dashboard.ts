/**
 * dashboard.ts — Funciones de fetching para los endpoints /admin/dashboard/*.
 * Usa la instancia global de Axios (con interceptores de JWT y error handling).
 * `rango` (desde/hasta, AAAA-MM-DD) filtra los datos; sin él, el backend usa los últimos 30 días.
 */
import api from "./axios"
import type {
  DashboardStats,
  ServiciosMesResponse,
  ActividadResponse,
  EspecialidadStat,
  TecnicosDestacadosResponse,
} from "../types/dashboard"

export interface RangoFechas {
  desde: string
  hasta: string
}

const params = (rango?: RangoFechas) => (rango ? { desde: rango.desde, hasta: rango.hasta } : undefined)

/** KPIs: estado actual (técnicos en línea, en curso, validaciones) e ingresos/completados del rango */
export async function fetchDashboardStats(rango?: RangoFechas): Promise<DashboardStats> {
  const { data } = await api.get<DashboardStats>("/admin/dashboard/stats", { params: params(rango) })
  return data
}

/** Serie por día: servicios completados/cancelados/en curso dentro del rango */
export async function fetchServiciosMes(rango?: RangoFechas): Promise<ServiciosMesResponse> {
  const { data } = await api.get<ServiciosMesResponse>("/admin/dashboard/servicios-mes", { params: params(rango) })
  return data
}

/** Feed de actividad del sistema (con rango: solo lo ocurrido en esas fechas) */
export async function fetchActividad(rango?: RangoFechas): Promise<ActividadResponse> {
  const { data } = await api.get<ActividadResponse>("/admin/dashboard/actividad", { params: params(rango) })
  return data
}

/** Distribución de servicios finalizados por especialidad */
export async function fetchEspecialidadStats(rango?: RangoFechas): Promise<EspecialidadStat[]> {
  const { data } = await api.get<EspecialidadStat[]>("/admin/dashboard/especialidades", { params: params(rango) })
  return data
}

/** Técnicos con más servicios finalizados en el rango */
export async function fetchTecnicosDestacados(rango?: RangoFechas): Promise<TecnicosDestacadosResponse> {
  const { data } = await api.get<TecnicosDestacadosResponse>("/admin/dashboard/tecnicos-destacados", { params: params(rango) })
  return data
}
