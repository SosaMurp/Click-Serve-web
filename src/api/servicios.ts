import api from './axios'
import type {
  UpdateServiceStatusPayload,
  UpdateServiceStatusResponse,
} from '../types/servicios'
import type { RecentService } from '../types/dashboard'

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
export async function getServicioById(idServicio: number | string): Promise<RecentService> {
  const { data } = await api.get<RecentService>(`/servicios/${idServicio}`)
  return data
}

export interface ServicioUbicado {
  id_servicio: number
  titulo: string | null
  descripcion: string | null
  estatus: string
  latitud: string | number | null
  longitud: string | number | null
  direccion: string | null
  fecha_creacion: string
}

/**
 * Lista de servicios con sus coordenadas (para el mapa en vivo).
 *
 * Endpoint: GET /api/servicios
 */
export async function getServicios(): Promise<ServicioUbicado[]> {
  const { data } = await api.get<ServicioUbicado[]>('/servicios')
  return data
}
