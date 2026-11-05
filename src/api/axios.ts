import axios from 'axios'
import { useAuthStore } from '../store/authStore'
import { appNavigate } from '../lib/navigation'
import { queryClient } from '../config/queryClient'
import { env } from '../config/env'

/**
 * Instancia global de Axios para Click & Serve Admin.
 *
 * - baseURL sale de VITE_API_BASE_URL (validada con Zod al arrancar).
 * - El JWT se toma del store de sesión.
 * - 401: la sesión venció o fue revocada → se limpia la sesión y se vuelve al login.
 * - 403: falta un permiso o una confirmación (p. ej. contraseña incorrecta al eliminar una cuenta);
 *   NO cierra la sesión: el error llega a la pantalla para mostrarlo.
 * - 503: modo mantenimiento → evento global que muestra el aviso.
 */
const api = axios.create({
  baseURL: env.VITE_API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Rutas en las que un 401 significa "datos incorrectos", no "sesión vencida".
const AUTH_PUBLICAS = ['/login-admin', '/verify-login-admin', '/verify-recovery', '/reset-password', '/request-recovery', '/verify-token', '/resend-code']

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const url = String(error.config?.url || '')

    if (status === 401 && !AUTH_PUBLICAS.some(r => url.endsWith(r))) {
      const { isAuthenticated, logout } = useAuthStore.getState()
      if (isAuthenticated) {
        logout()
        queryClient.clear()
        try { sessionStorage.setItem('login_aviso', 'Tu sesión terminó. Inicia sesión de nuevo.') } catch { /* sin almacenamiento */ }
        appNavigate('/login', { replace: true })
      }
    }

    if (status === 503 && error.response?.data?.code === 'MAINTENANCE') {
      window.dispatchEvent(new CustomEvent('maintenance_active', { detail: error.response?.data }))
    }

    return Promise.reject(error)
  }
)

export default api
