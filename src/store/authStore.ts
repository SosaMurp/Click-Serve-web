import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

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

const STORAGE_KEY = 'admin-auth'

// Una sola copia de la sesión, en sessionStorage: dura lo que la pestaña y no queda en el disco
// del equipo al cerrar el navegador (el token de administrador da acceso a datos personales).
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (user, token) => set({ user, token, isAuthenticated: true }),

      // Tras cambiar la contraseña el servidor entrega un token nuevo para esta sesión.
      updateToken: (token) => set({ token }),

      // Solo borra el estado local; el cierre completo (revocar en el servidor, limpiar caché) está en lib/sesion.
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
)

// Limpia restos de versiones anteriores, que guardaban el token en localStorage.
try {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem('admin_token')
  localStorage.removeItem('admin_user')
} catch {
  /* almacenamiento bloqueado: nada que limpiar */
}
