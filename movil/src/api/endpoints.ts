import { api } from './client';
import { buildForm } from '../lib/files';
import type {
  Billetera, Categoria, ChatMensaje, Comprobante, Contadores, Direccion, Documento, Especialidad, Incidencia,
  IneRegistro, IneResultado, ItemPortafolio, LocalFile, Movimiento, PerfilTecnico, Reprogramacion, ResumenTecnico, Sesion, Solicitud,
  Tarea, Tarjeta, TecnicoRecomendado, Ticket, TicketMensaje, User, Desglose, PrecioServicio, } from './types';

type Msg = { mensaje: string };

// Chat seguro: el servidor reemplaza teléfonos, redes, pagos por fuera, datos bancarios y enlaces por [BLOQUEADO].
// sancion: nivel de la escala de sanciones que se aplicó por este intento (null si se contó como el mismo).
export type FiltroChat = { bloqueado: boolean; motivos: string[]; sancion?: { nivel: number; titulo: string; mensaje: string; hasta?: string | null } | null };

export type LoginResult = { usuario?: User; token?: string; requires2FA?: boolean; reto?: string; metodo?: 'TOTP' | 'EMAIL'; mensaje?: string };
// Google/Apple con un correo nuevo: datos para prellenar el registro.
export type SocialResult = LoginResult & { requiere_registro?: boolean; email?: string; nombre?: string; apellidos?: string };

// ───────────────────────── Acceso y cuenta ─────────────────────────
export const authApi = {
  login: (email: string, password: string) => api.post<LoginResult>('/api/login', { email, password }),
  google: (id_token: string) => api.post<SocialResult>('/api/auth/google', { id_token }),
  apple: (identity_token: string, nombre?: string, apellidos?: string) => api.post<SocialResult>('/api/auth/apple', { identity_token, nombre, apellidos }),
  verify2fa: (reto: string, codigo: string) => api.post<{ usuario: User; token: string }>('/api/login/verify-2fa', { reto, codigo }),
  register: async (data: Record<string, string>, files: { ine_frente: LocalFile; ine_reverso: LocalFile; rostro: LocalFile }) =>
    api.upload<{ mensaje: string; id_usuario: number }>('POST', '/api/register', await buildForm(data, files)),
  verifyEmail: (email: string, token: string) => api.post<{ usuario: User; token: string }>('/api/verify-token', { email, token }),
  // RF-25: cada lado de la INE se verifica al tomar la foto; el reverso necesita el ticket del frente y, con
  // la verificación de Didit, también la foto del frente (las dos caras se verifican juntas).
  verificarIne: async (lado: 'frente' | 'reverso', foto: LocalFile, registro: IneRegistro, ticketFrente?: string, frente?: LocalFile | null) =>
    api.upload<IneResultado>('POST', '/api/ine/verificar', await buildForm({ lado, ...registro, ticket_frente: ticketFrente }, { foto, frente: lado === 'reverso' ? frente : null })),
  resendCode: (email: string) => api.post<Msg>('/api/resend-code', { email }),
  requestRecovery: (email: string, canal: 'EMAIL' | 'SMS') => api.post<Msg>('/api/request-recovery', { email, canal }),
  verifyRecovery: (email: string, token: string) => api.post<{ reset_token: string }>('/api/verify-recovery', { email, token }),
  resetPassword: (email: string, reset_token: string, newPassword: string) => api.post<Msg>('/api/reset-password', { email, reset_token, newPassword }),
  me: () => api.get<{ usuario: User }>('/api/me'),
  logout: () => api.post<Msg>('/api/logout'),
};

export const cuentaApi = {
  updateProfile: (data: { nombre?: string; apellido?: string; telefono?: string; bio?: string }) => api.put<{ usuario: User }>('/api/usuarios/perfil', data),
  updatePreferences: (data: User['preferencias']) => api.put<{ preferencias: User['preferencias'] }>('/api/usuarios/preferencias', data),
  uploadAvatar: async (file: LocalFile) => api.upload<{ usuario: User }>('PUT', '/api/usuarios/avatar', await buildForm({}, { foto: file })),
  changePassword: (currentPassword: string, newPassword: string) => api.post<{ token: string; mensaje: string }>('/api/update-password', { currentPassword, newPassword }),
  sessions: () => api.get<{ sesiones: Sesion[] }>('/api/auth/sessions'),
  revokeSession: (id: string) => api.delete<Msg>(`/api/auth/sessions/${id}`),
  revokeOthers: () => api.delete<Msg>('/api/auth/sessions'),
  start2fa: () => api.post<{ secreto: string; otpauth: string }>('/api/usuarios/2fa/iniciar'),
  confirm2fa: (codigo: string) => api.post<{ usuario: User }>('/api/usuarios/2fa/confirmar', { codigo }),
  disable2fa: (data: { codigo?: string; password?: string }) => api.delete<{ usuario: User }>('/api/usuarios/2fa', data),
  exportData: () => api.get<Record<string, unknown>>('/api/cuenta/exportar'),
  deleteAccount: (password: string) => api.delete<Msg>('/api/cuenta', { password }),
  pushToken: (push_token: string) => api.post<Msg>('/api/usuario/push-token', { push_token }),
  startBiometric: () => api.post<{ verificacion: { id_verificacion: string; estado: string } }>('/api/biometria/solicitar'),
  compareBiometric: async (id: string, live: LocalFile) =>
    api.upload<{ estado: 'APROBADO' | 'RECHAZADO'; match: boolean }>('POST', `/api/biometria/${id}/compare`, await buildForm({}, { live_image: live })),
};

// ───────────────────────── Solicitudes ─────────────────────────
export type NuevaSolicitud = {
  categoria: string | null;
  id_servicio?: number | null;
  descripcion: string;
  direccion: string;
  referencias?: string;
  fecha_preferida?: string | null;
  hora_preferida?: string | null;
  latitud?: number | null;
  longitud?: number | null;
};

export const solicitudesApi = {
  categorias: () => api.get<{ categorias: Categoria[] }>('/api/categorias'),
  crear: async (data: NuevaSolicitud, fotos: LocalFile[], key: string) =>
    api.upload<{ solicitud: Solicitud; folio: string }>('POST', '/api/solicitudes', await buildForm(data, { imagenes: fotos }), { idempotencyKey: key }),
  delCliente: () => api.get<{ solicitudes: Solicitud[] }>('/api/solicitudes/cliente'),
  delTecnico: (vista: 'nuevas' | 'en_curso' | 'historial') => api.get<{ solicitudes: Solicitud[]; contadores: Contadores }>(`/api/solicitudes/tecnico?vista=${vista}`),
  detalle: (id: number | string) => api.get<{ solicitud: Solicitud }>(`/api/solicitudes/${id}`),
  recomendados: (id: number | string) => api.get<{ tecnicos: TecnicoRecomendado[] }>(`/api/tecnicos/recomendados?id_solicitud=${id}`),
  proponer: (id: number | string, id_tecnico: number) => api.post<{ solicitud: Solicitud; mensaje: string }>(`/api/solicitudes/${id}/proponer-tecnico`, { id_tecnico }),
  automatica: (id: number | string) => api.post<{ solicitud: Solicitud; mensaje: string }>(`/api/solicitudes/${id}/busqueda-automatica`),
  aceptar: (id: number | string) => api.post<{ solicitud: Solicitud }>(`/api/solicitudes/${id}/aceptar`),
  descartar: (id: number | string) => api.post<Msg>(`/api/solicitudes/${id}/descartar`),
  estado: (id: number | string, estado: 'EN_CAMINO' | 'EN_SITIO' | 'EN_PROCESO') => api.patch<{ solicitud: Solicitud }>(`/api/solicitudes/${id}/estado`, { estado }),
  cotizar: (id: number | string, conceptos: { tipo: 'MANO_OBRA' | 'MATERIAL'; descripcion: string; monto: string }[], detalles: string, minutos?: number) =>
    api.post<{ solicitud: Solicitud }>(`/api/solicitudes/${id}/cotizar`, { conceptos, detalles, minutos }),
  // Aprobar la cotización es pagarla en custodia (pagarCustodia); esta ruta solo la rechaza.
  // Rechazar un adicional lleva el motivo (PRECIO_ALTO | NO_LO_DESEA | OTRO) y un comentario opcional para el técnico.
  responderCotizacion: (id: number | string, respuesta: 'RECHAZAR', motivo: 'PRECIO_ALTO' | 'NO_LO_DESEA' | 'OTRO', comentario?: string) =>
    api.patch<{ solicitud: Solicitud; mensaje: string }>(`/api/solicitudes/${id}/responder-cotizacion`, { respuesta, motivo, comentario }),
  pagarCustodia: (id: number | string, idMetodo: number, key: string) =>
    api.post<{ solicitud: Solicitud; mensaje: string; custodia: { monto: string; modo: string; referencia: string } }>(`/api/solicitudes/${id}/custodia`, { id_metodo: idMetodo }, { idempotencyKey: key }),
  agregarExtra: (id: number | string, descripcion: string, monto: string) => api.post<{ solicitud: Solicitud }>(`/api/solicitudes/${id}/conceptos`, { descripcion, monto }),
  quitarExtra: (id: number | string, idConcepto: number) => api.delete<{ solicitud: Solicitud }>(`/api/solicitudes/${id}/conceptos/${idConcepto}`),
  agregarTarea: (id: number | string, descripcion: string) => api.post<{ tarea: Tarea }>(`/api/solicitudes/${id}/tareas`, { descripcion }),
  marcarTarea: (id: number | string, idTarea: number, completada: boolean) => api.patch<{ tarea: Tarea }>(`/api/solicitudes/${id}/tareas/${idTarea}`, { completada }),
  subirEvidencias: async (id: number | string, fotos: LocalFile[], tipo: 'ANTES' | 'DURANTE' | 'DESPUES', descripcion?: string) =>
    api.upload<{ evidencias: unknown[] }>('POST', `/api/solicitudes/${id}/evidencias`, await buildForm({ tipo, descripcion }, { fotos })),
  finalizar: (id: number | string, key: string) => api.post<{ solicitud: Solicitud; mensaje: string }>(`/api/solicitudes/${id}/finalizar`, {}, { idempotencyKey: key }),
  // Con pago en custodia y sin conceptos extra no se cobra nada más: id_metodo puede ir vacío.
  confirmar: (id: number | string, data: { id_metodo?: number | null; calificacion?: number; comentario?: string }, key: string) =>
    api.post<{ solicitud: Solicitud; pago: { monto: string; modo: string; referencia: string }; desglose: Desglose; mensaje: string }>(`/api/solicitudes/${id}/confirmar`, data, { idempotencyKey: key }),
  calificar: (id: number | string, calificacion: number, comentario: string) => api.post<Msg>(`/api/solicitudes/${id}/calificar`, { calificacion, comentario }),
  calificarCliente: (id: number | string, calificacion: number, comentario: string) => api.post<Msg>(`/api/solicitudes/${id}/calificar-cliente`, { calificacion, comentario }),
  cancelar: (id: number | string, motivo: string) => api.post<{ solicitud: Solicitud; mensaje: string; sancion?: FiltroChat['sancion'] }>(`/api/solicitudes/${id}/cancelar`, { motivo }),
  sos: (id: number | string, latitud: number | null, longitud: number | null, key: string) =>
    api.post<{ mensaje: string; incidencia: { folio: string } }>(`/api/solicitudes/${id}/sos`, { latitud, longitud }, { idempotencyKey: key }),
  escalar: (id: number | string, motivo: string) => api.post<{ mensaje: string; ticket: Ticket; incidencia: Incidencia }>(`/api/solicitudes/${id}/escalar`, { motivo }),
  reportar: (id: number | string, tipo: string, descripcion: string) => api.post<{ incidencia: Incidencia; solicitud: Solicitud; mensaje: string }>(`/api/solicitudes/${id}/incidencias`, { tipo, descripcion }),
  resolverIncidencia: (idIncidencia: number, accion: 'REASIGNAR' | 'CANCELAR' | 'CONTINUAR') => api.post<{ solicitud: Solicitud; mensaje: string }>(`/api/incidencias/${idIncidencia}/resolver`, { accion }),
  proponerHorario: (id: number | string, fecha: string, hora: string, motivo?: string) => api.post<{ reprogramacion: Reprogramacion; mensaje: string }>(`/api/solicitudes/${id}/reprogramaciones`, { fecha, hora, motivo }),
  responderHorario: (idReprog: number, respuesta: 'ACEPTAR' | 'RECHAZAR' | 'CANCELAR', contrapropuesta?: { fecha: string; hora: string; motivo?: string }) =>
    api.patch<{ solicitud: Solicitud; mensaje: string }>(`/api/reprogramaciones/${idReprog}`, { respuesta, contrapropuesta }),
  // bloqueado: el chat se abre cuando el cliente paga el precio base en custodia.
  chat: (id: number | string) => api.get<{ mensajes: ChatMensaje[]; politicas_aceptadas: boolean; bloqueado?: boolean; aviso?: string }>(`/api/solicitudes/${id}/chat`),
  aceptarPoliticasChat: (id: number | string) => api.post<{ politicas_aceptadas: boolean }>(`/api/solicitudes/${id}/chat/politicas`),
  enviarMensaje: async (id: number | string, mensaje: string, adjunto?: LocalFile | null) =>
    adjunto
      ? api.upload<{ mensaje: ChatMensaje; filtrado?: FiltroChat }>('POST', `/api/solicitudes/${id}/chat`, await buildForm({ mensaje }, { adjunto }))
      : api.post<{ mensaje: ChatMensaje; filtrado?: FiltroChat }>(`/api/solicitudes/${id}/chat`, { mensaje }),
};

// ───────────────────────── Pagos y direcciones ─────────────────────────
export const pagosApi = {
  tarjetas: () => api.get<{ metodos: Tarjeta[] }>('/api/metodos-pago'),
  guardarTarjeta: (data: { token: string; marca: string; ultimos_4: string; expiracion: string; titular: string }) => api.post<{ metodo: Tarjeta }>('/api/metodos-pago', data),
  principal: (id: number) => api.patch<{ metodos: Tarjeta[] }>(`/api/metodos-pago/${id}/predeterminada`),
  eliminar: (id: number) => api.delete<Msg>(`/api/metodos-pago/${id}`),
  // Pasarela activa en el servidor: STRIPE (formulario seguro de Stripe), CONEKTA o SANDBOX (pruebas).
  proveedor: () => api.get<{ proveedor: 'STRIPE' | 'CONEKTA' | 'SANDBOX' }>('/api/pagos/proveedor'),
  sesionStripe: (retorno: string) => api.post<{ id: string; url: string }>('/api/tarjetas/stripe/sesion', { retorno }),
  confirmarStripe: (session_id: string) => api.post<{ mensaje: string; id_metodo: number }>('/api/tarjetas/stripe/confirmar', { session_id }),
};

export type DireccionInput = Omit<Direccion, 'id_direccion' | 'predeterminada' | 'latitud' | 'longitud'> & { latitud?: number | null; longitud?: number | null; predeterminada?: boolean };

export const direccionesApi = {
  lista: () => api.get<{ direcciones: Direccion[] }>('/api/direcciones'),
  crear: (data: DireccionInput) => api.post<{ direccion: Direccion }>('/api/direcciones', data),
  editar: (id: number, data: DireccionInput) => api.put<{ direccion: Direccion }>(`/api/direcciones/${id}`, data),
  principal: (id: number) => api.patch<{ direcciones: Direccion[] }>(`/api/direcciones/${id}/predeterminada`),
  eliminar: (id: number) => api.delete<Msg>(`/api/direcciones/${id}`),
};

// ───────────────────────── Técnico ─────────────────────────
export const tecnicoApi = {
  // Precios por servicio del catálogo (dentro del rango; un cambio por semana por servicio).
  precios: () => api.get<{ servicios: PrecioServicio[]; dias_entre_cambios: number }>('/api/tecnico/precios'),
  fijarPrecio: (idServicio: number, precio: string) => api.patch<{ mensaje: string; servicios: PrecioServicio[] }>(`/api/tecnico/precios/${idServicio}`, { precio }),
  resumen: () => api.get<ResumenTecnico>('/api/tecnico/resumen'),
  disponibilidad: (disponible: boolean, latitud?: number | null, longitud?: number | null) => api.put<{ disponible: boolean; mensaje: string }>('/api/tecnico/disponibilidad', { disponible, latitud, longitud }),
  latido: (latitud?: number | null, longitud?: number | null) => api.post<{ disponible: boolean }>('/api/tecnico/latido', { latitud, longitud }),
  ubicacion: (latitud: number, longitud: number) => api.put<Msg>('/api/usuarios/ubicacion', { latitud, longitud }),
  perfil: (id: number | string) => api.get<{ tecnico: PerfilTecnico }>(`/api/tecnicos/${id}/perfil`),
  cercanos: (latitud: number, longitud: number) => api.get<{ tecnicos: { id_usuario: number; nombre: string; calificacion: string | null; latitud: number; longitud: number }[] }>(`/api/tecnicos/cercanos?latitud=${latitud}&longitud=${longitud}`),
  especialidades: () => api.get<{ especialidades: Especialidad[] }>('/api/tecnico/especialidades'),
  agregarEspecialidad: (categoria: string) => api.post<{ especialidad: Especialidad }>('/api/tecnico/especialidades', { categoria }),
  alternarEspecialidad: (id: number, activa: boolean) => api.patch<{ especialidad: Especialidad }>(`/api/tecnico/especialidades/${id}/toggle`, { activa }),
  quitarEspecialidad: (id: number) => api.delete<Msg>(`/api/tecnico/especialidades/${id}`),
  precioEspecialidad: (id: number, precio_base: string) => api.patch<{ especialidades: Especialidad[] }>(`/api/tecnico/especialidades/${id}/precio`, { precio_base }),
  portafolio: () => api.get<{ portafolio: ItemPortafolio[] }>('/api/tecnico/portafolio'),
  agregarPortafolio: async (foto: LocalFile, titulo: string, descripcion?: string) => api.upload<{ item: ItemPortafolio }>('POST', '/api/tecnico/portafolio', await buildForm({ titulo, descripcion }, { foto })),
  quitarPortafolio: (id: number) => api.delete<Msg>(`/api/tecnico/portafolio/${id}`),
  documentos: () => api.get<{ documentos: Documento[] }>('/api/tecnico/documentos'),
  subirDocumento: async (archivo: LocalFile, tipo: string, numero?: string, descripcion?: string) =>
    api.upload<{ documento: Documento; mensaje: string }>('POST', '/api/tecnico/documentos', await buildForm({ tipo, numero, descripcion }, { archivo })),
  // Responde 202 al instante: la consulta a la SEP corre en el servidor y el resultado llega por WebSocket (`cedula.validada`).
  validarCedula: (cedula: string) => api.post<{ estado: 'EN_PROCESO' | 'VERIFICADA'; verificado_sep?: boolean; mensaje: string }>('/api/tecnicos/validar-cedula', { cedula }, { timeoutMs: 15000 }),
};

// Búsqueda de técnicos para el cliente (nombre o especialidad). Sin ubicación ni datos de contacto.
export type TecnicoBusqueda = {
  id_usuario: number;
  nombre: string;
  apellido: string;
  foto_url: string | null;
  disponible: boolean;
  verificado_sep: boolean;
  calificacion: string | null;
  trabajos: number;
  resenas?: number;
  bio?: string | null;
  especialidades: { codigo: string; nombre: string; precio?: string }[];
};

export const busquedaApi = {
  tecnicos: (q: string, categoria?: string | null) => {
    const params = new URLSearchParams({ q: q.trim() });
    if (categoria) params.set('categoria', categoria);
    return api.get<{ tecnicos: TecnicoBusqueda[] }>(`/api/tecnicos/buscar?${params.toString()}`);
  },
};

// Mensajes directos cliente → técnico, sin solicitud de por medio.
export type ConversacionDirecta = {
  id_conversacion: number;
  otro: { id_usuario: number; nombre: string; apellido: string; foto_url: string | null };
  ultimo_mensaje: string | null;
  fecha: string | null;
};

export type MensajeDirecto = Omit<ChatMensaje, 'id_solicitud'> & { id_conversacion: number };

export const chatDirectoApi = {
  abrir: (idTecnico: number) => api.post<{ conversacion: { id_conversacion: number; id_tecnico: number } }>('/api/chat-directo', { id_tecnico: idTecnico }),
  lista: () => api.get<{ conversaciones: ConversacionDirecta[] }>('/api/chat-directo'),
  // Chat directo: solo para dudas antes de contratar; restantes = mensajes que aún puede mandar esta persona.
  mensajes: (id: number | string) => api.get<{ mensajes: MensajeDirecto[]; politicas_aceptadas: boolean; id_tecnico?: number; limite?: number; restantes?: number }>(`/api/chat-directo/${id}/mensajes`),
  aceptarPoliticas: (id: number | string) => api.post<{ politicas_aceptadas: boolean }>(`/api/chat-directo/${id}/politicas`),
  enviar: async (id: number | string, mensaje: string, adjunto?: LocalFile | null) =>
    adjunto
      ? api.upload<{ mensaje: MensajeDirecto; filtrado?: FiltroChat; restantes?: number }>('POST', `/api/chat-directo/${id}/mensajes`, await buildForm({ mensaje }, { adjunto }))
      : api.post<{ mensaje: MensajeDirecto; filtrado?: FiltroChat; restantes?: number }>(`/api/chat-directo/${id}/mensajes`, { mensaje }),
};

export const billeteraApi = {
  ver: () => api.get<Billetera>('/api/billetera'),
  guardarClabe: (clabe: string) => api.put<{ billetera: Billetera; mensaje: string }>('/api/billetera/clabe', { clabe_interbancaria: clabe }),
  retirar: (monto: string, key: string) => api.post<{ transaccion: Movimiento; mensaje: string }>('/api/billetera/retiro', { monto }, { idempotencyKey: key }),
  movimientos: (tipo?: 'INGRESO' | 'RETIRO') => api.get<{ movimientos: Movimiento[] }>(`/api/billetera/movimientos${tipo ? `?tipo=${tipo}` : ''}`),
  comprobante: (id: number | string) => api.get<{ comprobante: Comprobante }>(`/api/billetera/movimientos/${id}`),
};

// ───────────────────────── Soporte ─────────────────────────
export const soporteApi = {
  tickets: () => api.get<{ tickets: Ticket[] }>('/api/soporte/tickets'),
  crear: async (data: { asunto: string; categoria: string; mensaje: string; id_solicitud?: number | null }, adjunto?: LocalFile | null) =>
    adjunto
      ? api.upload<{ ticket: Ticket; mensaje: string }>('POST', '/api/soporte/tickets', await buildForm(data, { adjunto }))
      : api.post<{ ticket: Ticket; mensaje: string }>('/api/soporte/tickets', data),
  mensajes: (id: number | string) => api.get<{ ticket: Ticket; mensajes: TicketMensaje[] }>(`/api/soporte/tickets/${id}/mensajes`),
  enviar: async (id: number | string, mensaje: string, adjunto?: LocalFile | null) =>
    adjunto
      ? api.upload<{ mensaje: TicketMensaje }>('POST', `/api/soporte/tickets/${id}/mensajes`, await buildForm({ mensaje }, { adjunto }))
      : api.post<{ mensaje: TicketMensaje }>(`/api/soporte/tickets/${id}/mensajes`, { mensaje }),
  escalar: (id: number | string) => api.post<{ ticket: Ticket; mensaje: string }>(`/api/soporte/tickets/${id}/escalar`),
};
