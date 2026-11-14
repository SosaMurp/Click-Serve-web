/**
 * useDashboard.ts — Custom hooks con TanStack Query para el Dashboard.
 * Cada hook encapsula fetching, caching, staleTime y retry de su recurso.
 */
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { sondeo } from "../config/queryClient"
import {
  fetchDashboardStats,
  fetchServiciosMes,
  fetchActividad,
  fetchPendientes,
  fetchEspecialidadStats,
  fetchTecnicosDestacados,
  type RangoFechas,
} from "../api/dashboard"
import type { ActividadGrupo } from "../types/dashboard"

// ── Query Keys (centralizadas para invalidacion segura) ───────────────────────
// Cada consulta agrega el rango a su clave: invalidar por prefijo refresca todos los rangos.
export const DASHBOARD_KEYS = {
  stats:         ["dashboard", "stats"]         as const,
  serviciosMes:  ["dashboard", "servicios-mes"] as const,
  actividad:     ["dashboard", "actividad"]     as const,
  especialidades:["dashboard", "especialidades"] as const,
  destacados:    ["dashboard", "destacados"]    as const,
  pendientes:    ["dashboard", "pendientes"]    as const,
} as const

const conRango = (key: readonly string[], rango?: RangoFechas) => [...key, rango?.desde ?? null, rango?.hasta ?? null]

// ── useDashboardStats ─────────────────────────────────────────────────────────
/**
 * KPIs principales. Técnicos en línea, servicios en curso y validaciones son el estado de ahora;
 * ingresos y completados corresponden al rango elegido. Se refresca cada 60 segundos.
 */
export function useDashboardStats(rango?: RangoFechas) {
  return useQuery({
    queryKey: conRango(DASHBOARD_KEYS.stats, rango),
    queryFn:  () => fetchDashboardStats(rango),
    staleTime: 60_000,
    refetchInterval: sondeo(60_000),
  })
}

// ── useServiciosMes ───────────────────────────────────────────────────────────
/** Serie por día del rango elegido para Recharts. */
export function useServiciosMes(rango?: RangoFechas) {
  return useQuery({
    queryKey: conRango(DASHBOARD_KEYS.serviciosMes, rango),
    queryFn:  () => fetchServiciosMes(rango),
    staleTime: 60_000,
  })
}

// ── useActividadFeed ──────────────────────────────────────────────────────────
/** Centro de actividad: paginas de 20 que se cargan al llegar al final de la lista. Refresco cada 30 s. */
export function useActividadFeed(tipo: ActividadGrupo = "todos") {
  return useInfiniteQuery({
    queryKey: [...DASHBOARD_KEYS.actividad, tipo],
    queryFn: ({ pageParam }) => fetchActividad({ tipo, pagina: pageParam, limite: 20 }),
    initialPageParam: 1,
    getNextPageParam: (ultima) => (ultima.hay_mas ? ultima.pagina + 1 : undefined),
    staleTime: 30_000,
    refetchInterval: sondeo(30_000),
  })
}

// ── usePendientes ─────────────────────────────────────────────────────────────
/** Validaciones, retiros, incidencias y tickets que esperan una decision (tablero, campana y menu). */
export function usePendientes() {
  return useQuery({
    queryKey: DASHBOARD_KEYS.pendientes,
    queryFn: fetchPendientes,
    staleTime: 20_000,
    refetchInterval: sondeo(30_000),
  })
}

// ── useEspecialidadStats ──────────────────────────────────────────────────────
export function useEspecialidadStats(rango?: RangoFechas) {
  return useQuery({
    queryKey: conRango(DASHBOARD_KEYS.especialidades, rango),
    queryFn:  () => fetchEspecialidadStats(rango),
    staleTime: 60_000,
  })
}

// ── useTecnicosDestacados ─────────────────────────────────────────────────────
export function useTecnicosDestacados(rango?: RangoFechas) {
  return useQuery({
    queryKey: conRango(DASHBOARD_KEYS.destacados, rango),
    queryFn:  () => fetchTecnicosDestacados(rango),
    staleTime: 60_000,
  })
}
