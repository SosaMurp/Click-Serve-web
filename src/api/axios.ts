import axios, { type AxiosInstance } from 'axios'
import { useAuthStore } from '../store/authStore'
import { appNavigate } from '../lib/navigation'
import { generateUUIDv4 } from '../utils/sanitizer'
import { env } from '../config/env'

/**
 * Instancia global de Axios para Click&Serve Admin.
 *
 * - baseURL se toma de VITE_API_BASE_URL (validada por Zod al arrancar)
 * - El token JWT se inyecta desde Zustand (no desde localStorage directo)
 * - 401 → sesión expirada/revocada → limpia Zustand + redirige a /login
 * - 403 → sin permisos de admin → limpia Zustand + redirige a /login
 * - 503 → modo mantenimiento → dispara evento global
 * - Timeout/Network error → log de Circuit Breaker
 */
const api = axios.create({
  baseURL: env.VITE_API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

attachInterceptors(api)

function attachInterceptors(instance: AxiosInstance) {
// ── Request Interceptor ──
// Intercepta todas las peticiones ANTES de que salgan al servidor.
// Su función principal en el login/sesión es inyectar el JWT en la cabecera Authorization.
instance.interceptors.request.use(
  (config) => {
    // 1. Obtiene el JWT desde el estado global (Zustand), no accede directamente al localStorage para mantener reactividad.
    const token = useAuthStore.getState().token
    if (token) {
      // Si hay un token válido, lo adjunta a la cabecera para demostrar que estamos autorizados.
      config.headers.Authorization = `Bearer ${token}`
    }

    // 2. Tokens de Idempotencia para mutaciones (RNF-33, RNF-35)
    if (config.method && ['post', 'put', 'delete', 'patch'].includes(config.method.toLowerCase())) {
      config.headers['X-Idempotency-Key'] = generateUUIDv4()
    }

    // 3. Trazabilidad y Auditoría (RNF-25)
    config.headers['X-Client-Timestamp'] = new Date().toISOString()

    return config
  },
  (error) => Promise.reject(error)
)

// ── Response Interceptor ──
// Intercepta las respuestas del servidor ANTES de que lleguen a las funciones de `auth.ts` u otras.
// Es crucial para la seguridad: detecta si la sesión caducó o no hay permisos.
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status

    // 1. 401 Unauthorized → Token expirado, inválido o sesión revocada remotamente.
    if (status === 401) {
      // Limpia toda la información local de la sesión de manera segura.
      useAuthStore.getState().logout()
      // Redirige al login para forzar una nueva autenticación.
      appNavigate('/login', { replace: true })
      return Promise.reject(error)
    }

    // 2. 403 Forbidden → El usuario existe y tiene sesión, pero no tiene el rol necesario (ej. no es administrador).
    if (status === 403) {
      useAuthStore.getState().logout()
      appNavigate('/login', { replace: true })
      return Promise.reject(error)
    }

    // 3. 503 Service Unavailable → Modo Mantenimiento (RNF-42)
    if (status === 503) {
      const event = new CustomEvent('maintenance_active', {
        detail: error.response?.data,
      })
      window.dispatchEvent(event)
    }

    // 4. Timeout o fallo de red → Circuit Breaker (RNF-36)
    if (error.code === 'ECONNABORTED' || !error.response) {
      console.warn('[Circuit Breaker] Petición cancelada por timeout o falla de red:', error.message)
    }

    return Promise.reject(error)
  }
)
}

export default api
