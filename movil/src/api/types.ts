// Tipos de las respuestas del backend de Click & Serve. Los importes son cadenas decimales del servidor.
export type Rol = 'cliente' | 'tecnico' | 'admin';

export type User = {
  id_usuario: number;
  nombre: string;
  apellido: string;
  telefono: string | null;
  correo: string;
  fecha_nacimiento: string | null;
  id_rol: number;
  rol: Rol;
  estado_cuenta: string;
  aprobado: boolean;
  identidad_verificada: boolean;
  verificado_sep: boolean;
  // Último resultado de la validación de cédula en la SEP (null si nunca se ha pedido).
  estado_cedula: 'EN_PROCESO' | 'VERIFICADA' | 'NO_VERIFICADA' | 'NO_DISPONIBLE' | null;
  folio_profesional: string | null;
  // Escala de sanciones: suspensión temporal vigente (nivel 2 o 3), en ISO; null si no hay.
  suspendido_hasta?: string | null;
  biometria_estado: string;
  '2FA_Activo': boolean;
  disponible: boolean;
  preferencias: Partial<Record<'notificaciones_push' | 'notificaciones_email' | 'notificaciones_sms' | 'promociones' | 'sonido', boolean>>;
  foto_url: string | null;
  bio: string | null;
  fecha_registro?: string;
};

export type Estado =
  | 'PENDIENTE' | 'ASIGNADA' | 'EN_CAMINO' | 'EN_SITIO' | 'ESPERANDO_APROBACION'
  | 'EN_PROCESO' | 'POR_CONFIRMAR' | 'FINALIZADA' | 'SUSPENDIDA' | 'CANCELADA';

// Catálogo de servicios: cada categoría tiene servicios concretos con rango (IVA incluido) y precio sugerido.
// La visita de diagnóstico tiene precio fijo.
export type Servicio = {
  id_servicio: number;
  categoria: string;
  nombre: string;
  descripcion: string | null;
  precio_min: string;
  precio_max: string;
  precio_sugerido: string;
  es_diagnostico: boolean;
  activo: boolean;
};

// Precio de un servicio para el técnico: el suyo (precio_propio) o el sugerido; cambiar_desde = cuándo podrá cambiarlo.
export type PrecioServicio = Servicio & { categoria_nombre: string; precio: string; precio_propio: string | null; cambiar_desde: string | null };

// Precio base: rango que fija Click & Serve por categoría (IVA incluido) y precio sugerido.
export type Categoria = { codigo: string; nombre: string; descripcion: string; icono: string; precio_min?: string | null; precio_max?: string | null; precio_sugerido?: string | null; servicios?: Servicio[] };

export type TecnicoResumen = {
  id_usuario: number;
  nombre: string;
  apellido: string;
  foto_url: string | null;
  calificacion: string | null;
  trabajos: number;
  verificado_sep: boolean;
};

export type Concepto = { id_concepto: number; tipo: 'MANO_OBRA' | 'MATERIAL' | 'EXTRA'; descripcion: string; monto: string; id_cotizacion: number | null };

export type Cotizacion = {
  id_cotizacion: number;
  monto_mano_obra: string;
  monto_materiales: string;
  monto_total: string;
  detalles: string | null;
  tiempo_estimado_minutos: number | null;
  estado: string;
  fecha_creacion: string;
  conceptos: Concepto[];
};

export type Tarea = { id_tarea: number; descripcion: string; origen: 'PLANTILLA' | 'TECNICO'; norma: string | null; completada: boolean };
export type Evidencia = { id_evidencia: number; tipo_evidencia: string; descripcion: string | null; url: string; fecha_subida: string };
export type Reprogramacion = { id_reprogramacion: number; propuesta_por: number; propuesta_por_mi: boolean; fecha: string; hora: string; motivo: string | null; estado: string };
export type Incidencia = { id_incidencia: number; folio: string; tipo: string; descripcion: string; prioridad: string; estado: string; fecha_creacion: string; resolucion?: string | null; folio_solicitud?: string; propia?: boolean };

export type Solicitud = {
  id_solicitud: number;
  folio: string;
  categoria: string | null;
  categoria_nombre: string;
  // Servicio del catálogo que eligió el cliente (define el precio base).
  id_servicio?: number | null;
  servicio_nombre?: string | null;
  descripcion: string;
  fecha_preferida: string | null;
  hora_preferida: string | null;
  estado: Estado;
  estado_previo: Estado | null;
  estado_pago: string;
  fecha_creacion: string;
  fecha_asignacion: string | null;
  fecha_llegada: string | null;
  fecha_finalizacion: string | null;
  garantia_hasta: string | null;
  monto_total: string | null;
  monto_cotizacion: string | null;
  cancelado_por: string | null;
  motivo_cancelacion: string | null;
  alerta_sos: boolean;
  id_tecnico: number | null;
  tecnico_propuesto: number | null;
  es_cliente: boolean;
  es_tecnico_asignado: boolean;
  calificacion_al_tecnico: number | null;
  comentario_al_tecnico: string | null;
  calificacion_al_cliente: number | null;
  comentario_al_cliente: string | null;
  direccion?: string;
  referencias?: string | null;
  // Precio base (anti-evasión): lo que el cliente paga en custodia al aceptar el técnico. mi_precio: en las
  // solicitudes nuevas, lo que cobraría el técnico que las ve.
  precio_base?: string | null;
  mi_precio?: string;
  // Hasta cuándo puede pagar el cliente el precio base (después se cancela sola).
  pago_vence?: string | null;
  // Cargo por visita si el cliente cancelara ahora (el técnico ya salió) y el que se cobró al cancelar.
  cargo_si_cancela?: string | null;
  cargo_cancelacion?: string | null;
  // Pago en custodia: el técnico ve la dirección y se abre el chat solo cuando el cliente pagó el precio base.
  direccion_liberada?: boolean;
  // AUTOMATICA: se propone al técnico más cercano y, si no acepta a tiempo, al siguiente.
  modo_asignacion?: 'MANUAL' | 'AUTOMATICA';
  custodia?: { monto: string; estado: 'RETENIDO' | 'LIBERADO' | 'REEMBOLSO_PENDIENTE' | 'REEMBOLSADO' } | null;
  latitud?: number | null;
  longitud?: number | null;
  zona?: string;
  latitud_aprox?: number | null;
  longitud_aprox?: number | null;
  distancia_km?: number | null;
  propuesta_a_mi?: boolean;
  cliente_nombre?: string;
  cliente_apellido?: string;
  tecnico?: TecnicoResumen;
  tecnico_ubicacion?: { latitud: number; longitud: number; actualizado: string; distancia_km: number; eta_min: number | null };
  // Solo en el detalle
  imagenes?: { id: number; url: string }[];
  cotizacion?: Cotizacion | null;
  extras?: Concepto[];
  tareas?: Tarea[];
  evidencias?: Evidencia[];
  reprogramacion?: Reprogramacion | null;
  incidencia?: Incidencia | null;
  // Último adicional que el cliente rechazó (motivo y conceptos), para que el técnico mande otra cotización.
  ultimo_rechazo?: { monto_total: string; motivo: 'PRECIO_ALTO' | 'NO_LO_DESEA' | 'OTRO'; comentario: string | null; fecha: string; conceptos: Concepto[] } | null;
  pago?: { monto: string; modo: string; referencia: string; estado: string; fecha: string; desglose?: Desglose } | null;
};

export type Desglose = { total: string; comision: string; base: string; retencion_isr: string; retencion_iva: string; neto_tecnico: string };

export type TecnicoRecomendado = {
  id_usuario: number;
  nombre: string;
  apellido: string;
  foto_url: string | null;
  verificado_sep: boolean;
  bio: string | null;
  distancia_km: number | null;
  eta_min: number | null;
  latitud_aprox: number | null;
  longitud_aprox: number | null;
  calificacion: string | null;
  resenas: number;
  trabajos: number;
  especialidades: string[];
  precio_base?: string;
};

export type PerfilTecnico = {
  id_usuario: number;
  nombre: string;
  apellido: string;
  foto_url: string | null;
  bio: string | null;
  verificado_sep: boolean;
  identidad_verificada: boolean;
  miembro_desde: string;
  disponible: boolean;
  calificacion: string | null;
  resenas_total: number;
  trabajos: number;
  efectividad: number | null;
  especialidades: { codigo: string; nombre: string; estado: string }[];
  portafolio: { id_item: number; titulo: string; descripcion: string | null; url: string }[];
  certificaciones: { tipo: string; descripcion: string | null; numero: string | null }[];
  resenas: { puntuacion: number; comentario: string | null; fecha: string; cliente: string }[];
};

export type Tarjeta = { id_metodo: number; titular: string; marca: string; ultimos_4: string; expiracion: string; predeterminada: boolean };

export type Direccion = {
  id_direccion: number;
  etiqueta: string;
  calle: string;
  numero: string;
  interior: string | null;
  colonia: string;
  cp: string;
  ciudad: string;
  referencias: string | null;
  latitud: string | null;
  longitud: string | null;
  predeterminada: boolean;
};

export type Billetera = { id_billetera: number; saldo_actual: string; clabe: string | null; banco: string | null; tiene_clabe: boolean; minimo_retiro: string };

export type Movimiento = {
  id_transaccion: number;
  folio: string;
  tipo: 'INGRESO' | 'RETIRO' | 'AJUSTE';
  concepto: string;
  monto: string;
  estado: string;
  fecha: string;
  folio_solicitud: string | null;
  categoria_nombre: string | null;
};

export type Comprobante = Movimiento & { beneficiario: string; cuenta_destino: string | null; banco_destino: string | null; desglose: Desglose | null };

export type ResumenTecnico = {
  disponible: boolean;
  aprobado: boolean;
  ganancias_semana: string;
  servicios_semana: number;
  servicios_total: number;
  calificacion: string | null;
  resenas: number;
  saldo: string;
  contadores: Contadores;
};

export type Contadores = { nuevas: number; en_curso: number; historial: number };

export type Especialidad = {
  id_especialidad: number; categoria: string | null; nombre: string; estado: string; activa: boolean;
  precio_base?: string | null; precio_min?: string | null; precio_max?: string | null; precio_sugerido?: string | null;
};
export type Documento = { id_documento: number; tipo: string; numero: string | null; descripcion: string | null; estado: string; url: string | null; fecha_creacion: string };
export type ItemPortafolio = { id_item: number; titulo: string; descripcion: string | null; url: string; fecha_creacion: string };

export type ChatMensaje = {
  id: number;
  id_solicitud: number;
  id_emisor: number;
  emisor_nombre: string;
  mensaje: string | null;
  adjunto_url: string | null;
  adjunto_tipo: string | null;
  adjunto_nombre: string | null;
  fecha_envio: string;
};

export type Ticket = {
  id_ticket: number;
  folio: string;
  asunto: string;
  categoria: string;
  prioridad: string;
  estado: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
  folio_solicitud?: string | null;
  ultimo_mensaje?: string | null;
};

export type TicketMensaje = { id_mensaje: number; id_ticket: number; id_emisor: number | null; es_asesor: boolean; mensaje: string | null; adjunto_url: string | null; adjunto_tipo: string | null; fecha_envio: string };

export type Sesion = { id_sesion: string; dispositivo: string; fecha_creacion: string; es_sesion_actual: boolean };

export type LocalFile = { uri: string; name: string; type: string };

// Resultado de POST /api/ine/verificar: cada comprobación con su resultado y, si pasa, el ticket
// firmado que pide el registro.
export type IneComprobacion = { id: string; ok: boolean; detalle: string };
export type IneResultado = {
  ok: boolean;
  lado: 'frente' | 'reverso';
  comprobaciones: IneComprobacion[];
  motivo?: string;
  datos?: { curp?: string; sexo?: string; fecha_nacimiento?: string; vigencia?: string };
  ticket?: string;
  // Con Didit, al verificar el reverso el frente se vuelve a firmar con el documento verificado.
  ticket_frente?: string;
};
export type IneRegistro = { nombre: string; apellidos: string; fecha_nacimiento: string };
