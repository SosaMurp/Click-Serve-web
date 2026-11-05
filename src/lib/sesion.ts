import { useAuthStore } from '../store/authStore'
import { queryClient } from '../config/queryClient'
import { appNavigate } from './navigation'
import { logoutAdmin } from '../api/auth'

/**
 * Cierre de sesión completo: revoca la sesión en el servidor (si sigue viva), borra el estado local
 * y la caché de consultas (para que otro administrador en el mismo navegador no vea datos ajenos).
 */
export async function cerrarSesion({ revocarEnServidor = true, motivo }: { revocarEnServidor?: boolean; motivo?: string } = {}) {
  if (revocarEnServidor && useAuthStore.getState().token) await logoutAdmin()
  useAuthStore.getState().logout()
  queryClient.clear()
  try {
    if (motivo) sessionStorage.setItem('login_aviso', motivo)
  } catch {
    /* sin almacenamiento: el aviso no es indispensable */
  }
  appNavigate('/login', { replace: true })
}
