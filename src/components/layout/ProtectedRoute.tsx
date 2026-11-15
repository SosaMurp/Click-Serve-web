import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@store/authStore'

const RUTA_CAMBIO = '/cambiar-contrasena'

/** Wraps protected routes — redirige a /login si no está autenticado */
export function ProtectedRoute() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const debeCambiar = useAuthStore(s => s.user?.debe_cambiar_contrasena === true)
  const { pathname } = useLocation()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  // Con contraseña temporal solo se llega a la pantalla de cambio; con una propia, esa pantalla ya no aplica
  if (debeCambiar && pathname !== RUTA_CAMBIO) return <Navigate to={RUTA_CAMBIO} replace />
  if (!debeCambiar && pathname === RUTA_CAMBIO) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

/** Redirige al dashboard si ya está logueado (para rutas de auth) */
export function GuestRoute() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Outlet />
}
