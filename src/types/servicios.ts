/**
 * Payload de PATCH /api/admin/solicitudes/:id/estado.
 * El avance del servicio lo registran técnico y cliente en la app; desde el panel solo se cancela sin cargo.
 */
export interface CancelServicePayload {
  estatus: 'Cancelado'
  /** Envía una notificación push al cliente con el motivo. */
  notificarCliente: boolean
  motivoCambio: string
}

export interface CancelServiceResponse {
  mensaje: string
  servicio: { id_servicio: number; estatus: string }
}

/** Expediente de un servicio para el panel (GET /api/admin/solicitudes/:id). */
export interface ServicioDetalle {
  id_servicio: number
  codigo: string
  titulo: string
  estatus: 'Pendiente' | 'En Curso' | 'Completado' | 'Cancelado'
  estado_app: string
  monto: string | number | null
  direccion: string | null
  fecha_creacion: string
  tecnico_nombre: string | null
  tecnico_apellido: string | null
  cliente_nombre: string | null
  cliente_apellido: string | null
  id_cliente: number
  id_tecnico: number | null
  descripcion: string | null
  referencias: string | null
  estado_pago: string | null
  fecha_preferida: string | null
  hora_preferida: string | null
  fecha_asignacion: string | null
  fecha_llegada: string | null
  fecha_finalizacion: string | null
  cancelado_por: string | null
  motivo_cancelacion: string | null
  alerta_sos: boolean
  cliente_telefono: string | null
  cliente_correo: string | null
  tecnico_telefono: string | null
  tareas: { id_tarea: number; descripcion: string; norma: string | null; completada: boolean; fecha_completada: string | null }[]
  evidencias: { id_evidencia: number; tipo_evidencia: string; descripcion: string | null; fecha_subida: string; url: string }[]
  calificacion: {
    puntuacion_tecnico: number | null
    comentario_cliente: string | null
    puntuacion_cliente: number | null
    comentario_tecnico: string | null
    fecha_calificacion: string | null
  } | null
  pago: { monto: string; modo: string; referencia: string | null; estado: string; fecha: string; monto_reembolsado: string } | null
  incidencias: { id_incidencia: number; folio: string; tipo: string; estado: string; prioridad: string; fecha_creacion: string }[]
}
