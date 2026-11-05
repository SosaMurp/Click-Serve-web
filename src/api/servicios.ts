import api from './axios'
import type { CancelServicePayload, CancelServiceResponse, ServicioDetalle } from '../types/servicios'

/**
 * Cancela un servicio sin cargo. Es la única transición que el panel puede hacer:
 * el avance lo registran técnico y cliente desde la app.
 * Endpoint: PATCH /api/admin/solicitudes/:id/estado
 */
export async function cancelService(idServicio: number, payload: CancelServicePayload): Promise<CancelServiceResponse> {
  const { data } = await api.patch<CancelServiceResponse>(`/admin/solicitudes/${idServicio}/estado`, payload)
  return data
}

/** Expediente completo de un servicio (participantes, tareas, evidencias, calificaciones, pago e incidencias). */
export async function getServicioById(idServicio: number | string): Promise<ServicioDetalle> {
  const { data } = await api.get<ServicioDetalle>(`/admin/solicitudes/${idServicio}`)
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
  tecnico_nombre?: string | null
  tecnico_apellido?: string | null
  cliente_nombre?: string | null
  cliente_apellido?: string | null
}

/**
 * Lista de servicios con sus coordenadas (para el mapa en vivo).
 * Endpoint: GET /api/admin/solicitudes
 */
export async function getServicios(): Promise<ServicioUbicado[]> {
  const { data } = await api.get<{ servicios: ServicioUbicado[] }>('/admin/solicitudes')
  return data.servicios
}
