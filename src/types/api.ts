// ── USUARIOS Y EXPEDIENTES (adminUserController) ──

export interface UsuarioRow {
  id_usuario: number
  nombre: string
  apellido: string
  correo: string
  telefono: string
  id_rol: number
  estado_cuenta: string
  fecha_nacimiento: string
  id_expediente?: number | null
  especialidad?: string | null
  estatus_expediente?: string | null
  metricas?: any
  identidad_verificada?: boolean
  fecha_registro?: string
}

export interface ExpedienteTecnicoRow {
  id_expediente: number
  id_usuario: number
  especialidad: string
  estatus: 'Pendiente' | 'En Revisión' | 'Aprobado' | 'Rechazado'
  fecha_solicitud: string
  metricas?: any
  documentos?: any
  nombre: string
  apellido: string
  correo: string
  telefono: string
  estado_cuenta: string
  verificado_sep?: boolean
  documentos_pendientes?: number
}

/** Técnico tal como lo devuelve GET /api/admin/tecnicos del backend de la app */
export interface TecnicoAppRow {
  id_usuario: number
  nombre: string
  apellido: string
  correo: string
  telefono: string
  estado_cuenta: string
  identidad_verificada: boolean
  verificado_sep: boolean
  fecha_registro: string
  fecha_revision: string | null
  motivo_rechazo: string | null
  documentos: number
  documentos_pendientes: number
  especialidades: string[] | null
  calificacion: string | null
  trabajos: number
  cancelados: number
}

/** Expediente de GET /api/admin/usuarios/:id/expediente */
export interface ExpedienteApp {
  id_usuario: number
  id_rol: number
  nombre: string
  apellido: string
  correo: string
  telefono: string | null
  fecha_nacimiento: string | null
  estado_cuenta: string
  identidad_verificada: boolean
  verificado_sep: boolean
  disponible: boolean
  bio: string | null
  fecha_registro: string
  fecha_revision: string | null
  motivo_rechazo: string | null
  calificacion: string | null
  trabajos: number
  cancelados: number
  foto_url: string | null
  documentos: { id_documento: number; tipo: string; numero: string | null; descripcion: string | null; estado: 'EN_REVISION' | 'APROBADO' | 'RECHAZADO'; fecha_creacion: string; url: string | null }[]
  especialidades: { id_especialidad: number; categoria: string | null; nombre: string; estado: string | null; activa: boolean }[]
}

export interface SearchAdvancedPayload {
  especialidad?: string
  estadoCuenta?: string
  fechaInicio?: string
  fechaFin?: string
}

export interface RejectTechnicianPayload {
  motivoRechazo: string
  bloquearUsuario: boolean
}

// ── FINANZAS Y TESORERÍA ──

/** Retiro tal como lo devuelve GET /api/admin/retiros del backend de la app (tabla transacciones) */
export interface RetiroAppRow {
  id_transaccion: number
  folio: string
  monto: string
  estado: 'EN_PROCESO' | 'COMPLETADO' | 'RECHAZADO'
  fecha: string
  fecha_procesado: string | null
  motivo_rechazo: string | null
  /** CLABE enmascarada en el servidor (RNF-09) */
  clabe_destino: string | null
  banco_destino: string | null
  id_usuario: number
  nombre: string
  apellido: string
  correo: string
  telefono: string
}

export interface SolicitudRetiroRow {
  id_retiro: number
  id_usuario: number
  monto: string | number
  clabe: string
  banco: string
  estado: 'Pendiente' | 'Aprobado' | 'Rechazado'
  folio_trx: string | null
  fecha_solicitud: string
  fecha_procesado: string | null
  motivo_rechazo: string | null
  nombre: string
  apellido: string
  correo: string
  telefono: string
}

export interface DisputaRow {
  id_disputa: number
  id_cliente: number
  id_tecnico: number
  estado: 'Pendiente' | 'Resuelta'
  monto_reembolso: string | number
  monto_multa: string | number
  observaciones: string | null
  fecha_creacion: string
  fecha_resolucion: string | null
  cliente_nombre: string
  cliente_apellido: string
  tecnico_nombre: string
  tecnico_apellido: string
}

export interface SettleDisputePayload {
  montoReembolso?: number
  montoMulta?: number
  observaciones?: string
}

// ── INCIDENCIAS (backend de la app) ──

export type IncidenciaTipo = 'NO_SE_PRESENTO' | 'COBRO_INDEBIDO' | 'MALA_CALIDAD' | 'DANOS' | 'SEGURIDAD' | 'GARANTIA' | 'OTRO'
export type Prioridad = 'BAJA' | 'MEDIA' | 'ALTA'
export type AccionIncidencia = 'REASIGNAR' | 'CANCELAR' | 'CONTINUAR'

export interface IncidenciaRow {
  id_incidencia: number
  folio: string
  tipo: IncidenciaTipo
  descripcion: string
  prioridad: Prioridad
  estado: 'ABIERTA' | 'RESUELTA'
  resolucion: AccionIncidencia | null
  notas_admin: string | null
  fecha_creacion: string
  fecha_resolucion: string | null
  id_solicitud: number | null
  folio_solicitud: string | null
  estado_solicitud: string | null
  estado_pago: string | null
  categoria: string | null
  reporta_nombre: string | null
  reporta_apellido: string | null
  reporta_rol: number | null
  cliente_nombre: string | null
  cliente_apellido: string | null
  tecnico_nombre: string | null
  tecnico_apellido: string | null
}

export interface UpdateIncidenciaPayload {
  prioridad?: Prioridad
  notas_admin?: string
  accion?: AccionIncidencia
}

// ── TICKETS DE SOPORTE ──

export interface TicketRow {
  id_ticket: number
  folio: string
  asunto: string
  categoria: 'PAGOS' | 'SERVICIO' | 'CUENTA' | 'SEGURIDAD' | 'OTRO'
  prioridad: 'BAJA' | 'MEDIA' | 'ALTA'
  estado: 'ABIERTO' | 'EN_ATENCION' | 'ESCALADO' | 'CERRADO'
  fecha_creacion: string
  fecha_actualizacion: string
  folio_solicitud: string | null
  id_usuario: number
  nombre: string
  apellido: string
  id_rol: number
  ultimo_mensaje: string | null
  ultimo_es_asesor: boolean | null
}

export interface TicketDetalle extends Omit<TicketRow, 'ultimo_mensaje' | 'ultimo_es_asesor'> {
  correo: string
  telefono: string | null
}

export interface TicketMensaje {
  id_mensaje: number
  id_ticket: number
  id_emisor: number | null
  es_asesor: boolean
  mensaje: string | null
  adjunto_url: string | null
  adjunto_tipo: string | null
  fecha_envio: string
}

// ── CONFIGURACIÓN (backend de la app) ──

export interface ConfiguracionPlataformaRow {
  id: number
  comision_porcentaje: number | string
  monto_minimo_retiro: number | string
  radio_maximo_km: number
  tolerancia_minutos: number
  sensibilidad_ia: string
  modo_mantenimiento: boolean
  mensaje_mantenimiento: string
  actualizado_en: string
}

export interface UpdateSettingsPayload {
  comisionPorcentaje?: number
  montoMinimoRetiro?: number
  radioMaximoKm?: number
  toleranciaMinutos?: number
  modoMantenimiento?: boolean
  mensajeMantenimiento?: string
}
