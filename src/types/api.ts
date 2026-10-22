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

// ── FINANZAS Y TESORERÍA (adminFinanceController) ──

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

// ── CONFIGURACIÓN (adminSettingsController) ──

export interface ConfiguracionPlataformaRow {
  id: number
  comision_porcentaje: number
  monto_minimo_retiro: number
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
}
