import api from './axios'
import type {
  UpdateServiceStatusPayload,
  UpdateServiceStatusResponse,
} from '../types/servicios'

/**
 * Actualiza el estado operativo de un servicio (ej. 'En Progreso' a 'Finalizado').
 * Opcionalmente envía notificaciones SMS y Correo al cliente solicitante.
 * 
 * Endpoint: PATCH /api/servicios/:id/status
 */
export async function updateServiceStatus(
  idServicio: number | string,
  payload: UpdateServiceStatusPayload
): Promise<UpdateServiceStatusResponse> {
  const { data } = await api.patch<UpdateServiceStatusResponse>(
    `/servicios/${idServicio}/status`,
    payload
  )
  return data
}

/**
 * Obtiene los detalles completos de un servicio técnico por su ID
 */
export async function getServicioById(idServicio: number | string) {
  const { data } = await api.get(`/servicios/${idServicio}`)
  return data
}
