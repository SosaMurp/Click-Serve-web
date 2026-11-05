import { isAxiosError } from 'axios'

// Mensaje para la persona a partir de un error de Axios. El backend responde { error, code }.
export function mensajeDeError(err: unknown, fallback = 'No se pudo completar la acción.'): string {
  if (isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined
    if (data?.error) return data.error
    if (!err.response) return 'No hay conexión con el servidor. Revisa tu red e intenta de nuevo.'
    // 502/504 sin cuerpo del backend: el proxy no alcanzó la API (backend apagado o sin respuesta).
    if (err.response.status === 502 || err.response.status === 504) {
      return 'No se pudo contactar al backend. Verifica que esté encendido e intenta de nuevo.'
    }
    if (err.response.status >= 500) return 'El servidor tuvo un error. Intenta de nuevo en unos minutos.'
  }
  return fallback
}

export const esErrorDeRed = (err: unknown) => isAxiosError(err) && !err.response

/** Código estable del backend ({ code }), si lo hay. */
export const codigoDeError = (err: unknown): string | undefined =>
  isAxiosError(err) ? (err.response?.data as { code?: string } | undefined)?.code : undefined
