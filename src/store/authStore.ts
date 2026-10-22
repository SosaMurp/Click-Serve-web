import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AdminUser {
  id_usuario: number
  nombre: string
  apellido: string
  correo: string
  id_rol: number
  estado_cuenta?: string
  version_sesion: number
}

interface AuthState {
  user: AdminUser | null
  token: string | null
  isAuthenticated: boolean
  login: (user: AdminUser, token: string) => void
  logout: () => void
}

// Store principal de autenticación usando Zustand.
// Zustand permite tener variables globales accesibles desde cualquier componente.
export const useAuthStore = create<AuthState>()(
  persist( // El middleware persist guarda automáticamente el estado en el almacenamiento local del navegador
    (set) => ({
      user: null, // Almacena la información del usuario autenticado
      token: null, // Almacena el JSON Web Token de la sesión
      isAuthenticated: false, // Bandera rápida para saber si hay alguien logueado

      // Función que se ejecuta cuando el login (y el 2FA) fue exitoso
      login: (user, token) => {
        // Se guarda explícitamente el token también en localStorage (útil si hay librerías externas que lo necesitan directo)
        // Limpieza de historial sensible (RNF-40)
        if (typeof window !== 'undefined' && window.history) {
          window.history.replaceState(null, '', '/dashboard')
        }
        // Se actualiza el estado en memoria para que React re-renderice la app
        set({ user, token, isAuthenticated: true })
      },

      // Función que se ejecuta para cerrar la sesión (ya sea manual o forzada por un error 401/403)
      logout: () => {
        // Destrucción total de tokens y datos PII/Financieros almacenados (RNF-02, RNF-09, RNF-10)
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_user')
        localStorage.clear()
        sessionStorage.clear()

        // Reemplazo del estado del historial para evitar regresar a vistas protegidas (RNF-40)
        if (typeof window !== 'undefined' && window.history) {
          window.history.replaceState(null, '', '/login')
        }

        set({ user: null, token: null, isAuthenticated: false })
      },
    }),
    {
      name: 'admin-auth',
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
)
