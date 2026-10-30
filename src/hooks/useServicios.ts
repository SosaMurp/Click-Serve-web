import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getServicios, updateServiceStatus } from '../api/servicios'
import { DASHBOARD_KEYS } from './useDashboard'
import type {
  UpdateServiceStatusPayload,
  UpdateServiceStatusResponse,
} from '../types/servicios'

export interface MutationStatusArgs {
  id: number | string
  payload: UpdateServiceStatusPayload
}

/**
 * Hook para actualizar el estado de un servicio técnico con React Query useMutation.
 * Al completarse la mutación:
 * 1. Invalida las estadísticas del dashboard (KPIs).
 * 2. Invalida la lista de servicios recientes.
 * 3. Invalida el feed de actividad y las listas de servicios.
 */
export function useUpdateServiceStatus(options?: {
  onSuccess?: (data: UpdateServiceStatusResponse, variables: MutationStatusArgs) => void
  onError?: (error: Error, variables: MutationStatusArgs) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, payload }: MutationStatusArgs) => {
      return await updateServiceStatus(id, payload)
    },
    onSuccess: (data, variables) => {
      // Invalida consultas del dashboard
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEYS.stats })
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEYS.recentServices })
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEYS.actividad })
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEYS.serviciosMes })
      
      // Invalida consultas generales de servicios
      queryClient.invalidateQueries({ queryKey: ['servicios'] })
      queryClient.invalidateQueries({ queryKey: ['servicio', variables.id] })

      if (options?.onSuccess) {
        options.onSuccess(data, variables)
      }
    },
    onError: (error: Error, variables) => {
      console.error(`Error al actualizar estado del servicio #${variables.id}:`, error)
      if (options?.onError) {
        options.onError(error, variables)
      }
    },
  })
}

/** Servicios con ubicación para el mapa; se refresca cada 30 s. */
export function useServiciosUbicados() {
  return useQuery({
    queryKey: ['servicios'],
    queryFn: getServicios,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}
