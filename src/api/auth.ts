import api from './axios'

/* ── Tipos ── */
export interface LoginPayload {
  email: string
  password: string
}

export interface LoginResponse {
  mensaje: string
  requiere2FA?: boolean
  token: string
  usuario: {
    id_usuario: number
    nombre: string
    apellido: string
    correo: string
    id_rol: number
    estado_cuenta: string
    version_sesion: number
  }
}

export interface RegisterAdminPayload {
  nombre: string
  apellidos: string
  telefono: string
  email: string
  fechaNacimiento: string
  password: string
  perfil: number   // id_rol — 1 para admin
}

/* ── API calls ── */

/** Login — espera id_rol === 3 (Administrador) */
export async function loginAdmin(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/login-admin', payload)
  return data
}
/** * PASO 2: Verificar código 2FA y obtener token de sesión */
export async function verifyAdminLogin(email: string, token: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/verify-login-admin', { email, token })
  return data
}

/** Registro de nuevo operador admin */
export async function registerAdmin(payload: RegisterAdminPayload) {
  const { data } = await api.post('/register', payload)
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

/** Sesiones activas del usuario autenticado */
export async function getActiveSessions() {
  const { data } = await api.get('/auth/sessions')
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