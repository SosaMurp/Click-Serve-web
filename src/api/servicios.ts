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
 * Desde el panel solo se puede cancelar sin cargo; el avance lo marcan técnico y cliente en la app.
 * Endpoint: PATCH /api/admin/solicitudes/:id/estado
 */
export async function updateServiceStatus(
  idServicio: number | string,
  payload: UpdateServiceStatusPayload
): Promise<UpdateServiceStatusResponse> {
  const { data } = await api.patch<UpdateServiceStatusResponse>(
    `/admin/solicitudes/${idServicio}/estado`,
    payload
  )
  return data
}

/**
 * Obtiene los detalles completos de un servicio técnico por su ID
 */
export async function getServicioById(idServicio: number | string): Promise<RecentService> {
  const { data } = await api.get<RecentService>(`/admin/solicitudes/${idServicio}`)
  return data
}

export interface ServicioUbicado {
  id_servicio: number
  codigo: string
  titulo: string | null
  /** Estado agrupado como lo muestra el panel: Pendiente, En Curso, Completado o Cancelado */
  estatus: string
  latitud: string | number | null
  longitud: string | number | null
  direccion: string | null
  fecha_creacion: string
}

/**
 * Lista de servicios con sus coordenadas (para el mapa en vivo).
 *
 * Endpoint: GET /api/admin/solicitudes (solicitudes de la app)
 */
export async function getServicios(): Promise<ServicioUbicado[]> {
  const { data } = await api.get<{ servicios: ServicioUbicado[] }>('/admin/solicitudes')
  return data.servicios
}
