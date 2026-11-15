import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sondeo } from '../config/queryClient'
import { cancelService, fetchServicios, getServicioById, getServicios, type EstadoServicio } from '../api/servicios'
import { DASHBOARD_KEYS } from './useDashboard'
import type { CancelServicePayload } from '../types/servicios'

/** Expediente de un servicio para el modal de detalle. */
export function useServicioDetalle(id: number | null) {
  return useQuery({
    queryKey: ['servicio-detalle', id],
    queryFn: () => getServicioById(id!),
    enabled: id != null,
    staleTime: 15_000,
  })
}

/** Cancelación sin cargo desde el panel; refresca tablero, mapa y el detalle del servicio. */
export function useCancelService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CancelServicePayload }) => cancelService(id, payload),
    onSuccess: (_data, { id }) => {
      for (const key of Object.values(DASHBOARD_KEYS)) qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: ['servicios'] })
      qc.invalidateQueries({ queryKey: ['servicios-lista'] })
      qc.invalidateQueries({ queryKey: ['servicio-detalle', id] })
    },
  })
}

/** Servicios con ubicación para el mapa; se refresca cada 30 s. */
export function useServiciosUbicados() {
  return useQuery({
    queryKey: ['servicios'],
    queryFn: getServicios,
    staleTime: 30_000,
    refetchInterval: sondeo(30_000),
  })
}

/** Lista de servicios de la seccion Servicios: conserva la pagina anterior mientras llega la siguiente. */
export function useServiciosLista(opts: { estado: EstadoServicio; q: string; pagina: number }) {
  return useQuery({
    queryKey: ['servicios-lista', opts.estado, opts.q, opts.pagina],
    queryFn: () => fetchServicios(opts),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchInterval: sondeo(30_000),
  })
}
