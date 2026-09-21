import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { logoutAdmin } from '@api/auth'

interface AdminUser {
  id_usuario: number
  nombre: string
  apellido: string
  correo: string
  id_rol: number
  estado_cuenta: string
  version_sesion: number
}

interface AuthState {
  user: AdminUser | null
  token: string | null
  isAuthenticated: boolean
  login: (user: AdminUser, token: string) => void
  setToken: (token: string) => void
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (user, token) => {
        localStorage.setItem('admin_token', token)
        set({ user, token, isAuthenticated: true })
      },

      setToken: (token) => {
        localStorage.setItem('admin_token', token)
        set({ token })
      },

      logout: async () => {
        await logoutAdmin()
        localStorage.removeItem('admin_token')
        set({ user: null, token: null, isAuthenticated: false })
      },
    }),
    {
      name: 'admin-auth',
      // Solo persiste el token y el user, no toda la función
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
)
