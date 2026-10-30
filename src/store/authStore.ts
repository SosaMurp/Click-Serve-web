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
  updateToken: (token: string) => void
}

// Store principal de autenticación usando Zustand.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      // Función que se ejecuta cuando el login (y el 2FA) fue exitoso
      login: (user, token) => {
        localStorage.setItem('admin_token', token)
        // Limpieza de historial sensible (RNF-40)
        if (typeof window !== 'undefined' && window.history) {
          window.history.replaceState(null, '', '/dashboard')
        }
        set({ user, token, isAuthenticated: true })
      },

      // Actualizar token sin cerrar sesión (ej. tras cambio de contraseña)
      updateToken: (token: string) => {
        localStorage.setItem('admin_token', token)
        set({ token })
      },

      // Función que se ejecuta para cerrar la sesión
      logout: () => {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_user')
        localStorage.clear()
        sessionStorage.clear()

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
