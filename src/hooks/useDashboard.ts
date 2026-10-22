/**
 * useDashboard.ts — Custom hooks con TanStack Query para el Dashboard.
 * Cada hook encapsula fetching, caching, staleTime y retry de su recurso.
 */
import { useQuery } from "@tanstack/react-query"
import {
  fetchDashboardStats,
  fetchServiciosMes,
  fetchRecentServices,
  fetchActividad,
  fetchEspecialidadStats,
} from "../api/dashboard"

// ── Query Keys (centralizadas para invalidacion segura) ───────────────────────
export const DASHBOARD_KEYS = {
  stats:         ["dashboard", "stats"]        as const,
  serviciosMes:  ["dashboard", "servicios-mes"] as const,
  recentServices:["dashboard", "recent-services"] as const,
  actividad:     ["dashboard", "actividad"]    as const,
  especialidades:["dashboard", "especialidades"] as const,
} as const

// ── useDashboardStats ─────────────────────────────────────────────────────────
/**
 * KPIs principales: tecnicos online, servicios en curso, validaciones, ingresos.
 * Se refresca cada 60 segundos para mantener los contadores vivos.
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: DASHBOARD_KEYS.stats,
    queryFn:  fetchDashboardStats,
    staleTime: 60_000,       // 1 minuto
    refetchInterval: 60_000, // polling cada 1 min
    retry: 2,
  })
}

// ── useServiciosMes ───────────────────────────────────────────────────────────
/**
 * Serie de tiempo de los ultimos 30 dias para Recharts.
 * Dato menos volatil: staleTime de 5 minutos.
 */
export function useServiciosMes() {
  return useQuery({
    queryKey: DASHBOARD_KEYS.serviciosMes,
    queryFn:  fetchServiciosMes,
    staleTime: 5 * 60_000,
    retry: 2,
  })
}

// ── useRecentServices ─────────────────────────────────────────────────────────
/**
 * Ultimos servicios para la tabla de actividad.
 * Recibe limit como parametro de configuracion.
 */
export function useRecentServices(limit = 8) {
  return useQuery({
    queryKey: [...DASHBOARD_KEYS.recentServices, limit],
    queryFn:  () => fetchRecentServices(limit),
    staleTime: 30_000,
    retry: 2,
  })
}

// ── useActividad ──────────────────────────────────────────────────────────────
/**
 * Feed en tiempo real: alta frecuencia de refresco (30 s).
 */
export function useActividad() {
  return useQuery({
    queryKey: DASHBOARD_KEYS.actividad,
    queryFn:  fetchActividad,
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: 1,
  })
}

// ── useEspecialidadStats ──────────────────────────────────────────────────────
export function useEspecialidadStats() {
  return useQuery({
    queryKey: DASHBOARD_KEYS.especialidades,
    queryFn:  fetchEspecialidadStats,
    staleTime: 5 * 60_000,
    retry: 2,
  })
}
