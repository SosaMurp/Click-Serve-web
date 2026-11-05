import { QueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

/**
 * QueryClient global.
 *
 * - Consultas: 2 minutos de staleTime, sin refetch al reenfocar.
 * - Reintentos: nunca en errores 4xx (no cambian al repetir); un solo reintento en fallas de red o 5xx,
 *   para no inundar la consola ni el servidor cuando algo está roto.
 * - El cierre de sesión por 401 lo resuelve el interceptor de Axios.
 */
export function debeReintentar(failureCount: number, error: unknown) {
  if (isAxiosError(error)) {
    const status = error.response?.status
    if (status && status < 500) return false
  }
  return failureCount < 1
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: debeReintentar,
      staleTime: 1000 * 60 * 2,
    },
    mutations: {
      retry: false,
    },
  },
})

/** Sondeo periódico que se detiene mientras la consulta está en error (evita repetir un 500 cada minuto). */
export const sondeo = (ms: number) => (query: { state: { status: string } }) => (query.state.status === 'error' ? false : ms)
