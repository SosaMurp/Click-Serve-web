/**
 * dashboard.ts — Funciones de fetching para el endpoint /admin/dashboard
 * Usa la instancia global de Axios (con interceptores de JWT y error handling).
 */
import api from "./axios"
import type {
  DashboardStats,
  ServiciosMesResponse,
  RecentServicesResponse,
  ActividadResponse,
  EspecialidadStat,
} from "../types/dashboard"

/** KPIs consolidados: tecnicos, servicios, validaciones, ingresos */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get<DashboardStats>("/admin/dashboard/stats")
  return data
}

/** Serie de tiempo: servicios completados/cancelados/en-curso de los ultimos 30 dias */
export async function fetchServiciosMes(): Promise<ServiciosMesResponse> {
  const { data } = await api.get<ServiciosMesResponse>("/admin/dashboard/servicios-mes")
  return data
}

/** Ultimos N servicios para la tabla de actividad */
export async function fetchRecentServices(limit = 10): Promise<RecentServicesResponse> {
  const { data } = await api.get<RecentServicesResponse>("/admin/dashboard/recent-services", {
    params: { limit },
  })
  return data
}

/** Feed de actividad reciente del sistema */
export async function fetchActividad(): Promise<ActividadResponse> {
  const { data } = await api.get<ActividadResponse>("/admin/dashboard/actividad")
  return data
}

/** Distribucion de servicios por especialidad del tecnico */
export async function fetchEspecialidadStats(): Promise<EspecialidadStat[]> {
  const { data } = await api.get<EspecialidadStat[]>("/admin/dashboard/especialidades")
  return data
}
