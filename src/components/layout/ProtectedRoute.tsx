import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@store/authStore'

/** Wraps protected routes — redirige a /login si no está autenticado */
export function ProtectedRoute() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}

/** Redirige al dashboard si ya está logueado (para rutas de auth) */
export function GuestRoute() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Outlet />
}
