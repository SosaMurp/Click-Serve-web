import api from './axios'

/* ── Tipos de Usuario y Sesión ── */
export interface AdminUser {
  id_usuario: number
  nombre: string
  apellido: string
  correo: string
  id_rol: number
  estado_cuenta?: string // Opcional porque verifyLoginAdmin no lo incluye en el SELECT
  version_sesion: number
}

/* ── Tipos de Autenticación ── */
export interface LoginPayload {
  email: string
  password: string
}

// Respuesta del Paso 1 (/login-admin)
export interface LoginAdminStep1Response {
  mensaje: string
  requiere2FA: boolean
}

// Respuesta del Paso 2 (/verify-login-admin) y Login general
export interface AuthSuccessResponse {
  mensaje: string
  token: string
  usuario: AdminUser
}

// Para compatibilidad con referencias previas
export type LoginResponse = AuthSuccessResponse

export interface RegisterAdminPayload {
  nombre: string
  apellidos: string
  telefono: string
  email: string
  fechaNacimiento: string
  password: string
  perfil?: number // id_rol — 3 para Administrador
}

export interface SesionActivaResponse {
  id_sesion: string // UUID en PostgreSQL
  dispositivo: string
  fecha_creacion: string
  es_sesion_actual: boolean
}

/* ── API calls ── */

/** 
 * Paso 1: Valida credenciales y genera código 2FA al correo institucional 
 * Esta función es llamada desde LoginPage. Envía el email y password al backend.
 * El backend (y la base de datos) verifican si existe. Si es así, envían un correo con el 2FA.
 */
export async function loginAdmin(payload: LoginPayload): Promise<LoginAdminStep1Response> {
  const { data } = await api.post<LoginAdminStep1Response>('/login-admin', payload)
  return data
}

/** 
 * Paso 2: Verificar código 2FA y obtener token de sesión 
 * Llamada desde la vista /verify-2fa. Envía el código ingresado por el usuario.
 * Si el backend lo aprueba, devuelve un JSON Web Token (JWT) y los datos del usuario.
 */
export async function verifyAdminLogin(email: string, token: string): Promise<AuthSuccessResponse> {
  const { data } = await api.post<AuthSuccessResponse>('/verify-login-admin', { email, token })
  return data
}

/** Registro de nuevo operador admin (fuerza id_rol = 3 en el backend) */
export async function registerAdmin(payload: RegisterAdminPayload) {
  const { data } = await api.post('/register', {
    ...payload,
    perfil: payload.perfil ?? 3,
  })
  return data
}

/** Solicitar recuperación de contraseña */
export async function requestRecovery(email: string) {
  const { data } = await api.post('/request-recovery', { email })
  return data
}

/** Verificar token de registro (4 dígitos) */
export async function verifyToken(email: string, token: string) {
  const { data } = await api.post('/verify-token', { email, token })
  return data
}

/** Reenviar código de verificación */
export async function resendCode(email: string) {
  const { data } = await api.post('/resend-code', { email })
  return data
}

/** Cambiar contraseña desde el perfil */
export async function updatePassword(currentPassword: string, newPassword: string) {
  const { data } = await api.post<{ mensaje: string; token: string }>('/update-password', {
    currentPassword,
    newPassword,
  })
  return data
}

/** Sesiones activas del usuario autenticado */
export async function getActiveSessions() {
  const { data } = await api.get<{ sesiones: SesionActivaResponse[] }>('/auth/sessions')
  return data
}

/** Revocar sesión específica */
export async function revokeSession(sessionId: string) {
  const { data } = await api.delete(`/auth/sessions/${sessionId}`)
  return data
}

/** Revocar todas las sesiones menos la actual */
export async function revokeAllSessions() {
  const { data } = await api.delete('/auth/sessions')
  return data
}

/** Verificar código de recuperación de contraseña (4 dígitos) */
export async function verifyRecovery(email: string, token: string) {
  const { data } = await api.post('/verify-recovery', { email, token })
  return data
}

/** Restablecer contraseña con código verificado */
export async function resetPassword(email: string, newPassword: string) {
  const { data } = await api.post('/reset-password', { email, newPassword })
  return data
}

/** Cerrar sesión en el servidor revocando el sessionId actual */
export async function logoutAdmin(): Promise<void> {
  try {
    await api.post('/logout')
  } catch (err) {
    console.warn('No se pudo revocar la sesión en el servidor:', err)
  }
}