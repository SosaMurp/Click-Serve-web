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
  /** Alerta SOS activa en el servicio */
  alerta_sos?: boolean
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

export type EstadoServicio = 'todos' | 'pendiente' | 'en_curso' | 'completado' | 'cancelado'

export interface ServicioFila {
  id_servicio: number
  codigo: string
  titulo: string
  estatus: 'Pendiente' | 'En Curso' | 'Completado' | 'Cancelado'
  estado_app: string
  monto: string | number | null
  direccion: string | null
  fecha_creacion: string
  alerta_sos: boolean
  tecnico_nombre: string | null
  tecnico_apellido: string | null
  cliente_nombre: string | null
  cliente_apellido: string | null
}

export interface ServiciosPagina {
  servicios: ServicioFila[]
  pagina: number
  limite: number
  total: number
  paginas: number
  /** Conteo por estado (respeta la busqueda, no el filtro de estado) */
  conteos: Record<EstadoServicio, number>
}

/** Lista paginada de servicios con filtro por estado y busqueda por folio, persona o direccion. */
export async function fetchServicios(opts: { estado: EstadoServicio; q: string; pagina: number; limite?: number }): Promise<ServiciosPagina> {
  const { data } = await api.get<ServiciosPagina>('/admin/servicios', {
    params: { estado: opts.estado, q: opts.q || undefined, pagina: opts.pagina, limite: opts.limite ?? 25 },
  })
  return data
}
