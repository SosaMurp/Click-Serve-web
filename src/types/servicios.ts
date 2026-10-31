import { z } from 'zod'

export type ServicioEstatus =
  | 'Pendiente'
  | 'Asignado'
  | 'En Camino'
  | 'En Progreso'
  | 'En Curso'
  | 'Finalizado'
  | 'Completado'
  | 'Cancelado'

/**
 * Payload enviado al endpoint PATCH /api/admin/solicitudes/:id/estado
 */
export interface UpdateServiceStatusPayload {
  estatus: ServicioEstatus | string
  notificarCliente: boolean
  motivoCambio?: string
  canalNotificacion?: 'ambos' | 'sms' | 'email'
  mensajePersonalizado?: string
}

/**
 * Respuesta del servidor tras actualizar estado
 */
export interface UpdateServiceStatusResponse {
  mensaje: string
  servicio: {
    id_servicio: number
    titulo?: string
    estatus: string
    actualizado_en?: string
    [key: string]: any
  }
  notificacion?: {
    intentada: boolean
    smsEnviado?: boolean
    emailEnviado?: boolean
    destinatarioCorreo?: string
    destinatarioTelefono?: string
    error?: string
  }
}

/**
 * Esquema de validación Zod para el formulario de actualización de estado
 */
export const updateServiceStatusSchema = z.object({
  estatus: z.string().min(1, 'Debe seleccionar un estado para el servicio'),
  notificarCliente: z.boolean(),
  canalNotificacion: z.enum(['ambos', 'sms', 'email']),
  motivoCambio: z.string().max(300, 'El motivo no puede exceder 300 caracteres').optional(),
  mensajePersonalizado: z.string().max(350, 'El mensaje no puede exceder 350 caracteres').optional(),
})

export type UpdateServiceStatusFormValues = z.infer<typeof updateServiceStatusSchema>
