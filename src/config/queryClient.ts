import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useAuthStore } from '../store/authStore'
import { appNavigate } from '../lib/navigation'

/**
 * QueryClient global con manejadores de errores centralizados.
 *
 * - Queries: 2 minutos de staleTime, 1 reintento, sin refetch al reenfocar.
 * - Mutaciones: sin reintento automático.
 * - Errores globales: detectan 401/403 para forzar logout + redirect.
 */

function handleGlobalError(error: unknown) {
  if (!isAxiosError(error)) return

  const status = error.response?.status

  // Si axios ya manejó el 401/403 en su interceptor, evitamos duplicar
  // pero nos aseguramos de que el estado esté limpio
  if (status === 401 || status === 403) {
    const { isAuthenticated, logout } = useAuthStore.getState()
    if (isAuthenticated) {
      logout()
      appNavigate('/login', { replace: true })
    }
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // No reintentar en errores de autenticación/permisos
        if (isAxiosError(error)) {
          const status = error.response?.status
          if (status === 401 || status === 403 || status === 404) return false
        }
        return failureCount < 2
      },
      staleTime: 1000 * 60 * 2, // 2 minutos
    },
    mutations: {
      retry: false,
    },
  },
  queryCache: new QueryCache({
    onError: handleGlobalError,
  }),
  mutationCache: new MutationCache({
    onError: handleGlobalError,
  }),
})
