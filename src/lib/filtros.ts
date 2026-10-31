// Filtros avanzados del directorio y de la cola de validaciones (RF-39). Se aplican en el navegador
// sobre las filas que ya trae el servidor, así que cambian al instante.

export interface Filtros {
  status: string
  specialty: string
  minRating: string
  verification: string
  dateRange: string
}

export const SIN_FILTROS: Filtros = { status: 'ALL', specialty: 'ALL', minRating: '0', verification: 'ALL', dateRange: 'ALL' }

// Categorías de servicio de la app (tabla categorias_servicio)
export const CATEGORIAS = [
  'Cómputo y redes', 'Electricidad', 'Plomería', 'Climatización', 'Línea blanca',
  'Cerrajería', 'Pintura e impermeabilización', 'Mecánica automotriz',
]

export const RANGOS_FECHA: Record<string, string> = { '7': 'Últimos 7 días', '30': 'Últimos 30 días', '90': 'Últimos 90 días' }

export const filtrosActivos = (f: Filtros) =>
  (Object.keys(SIN_FILTROS) as (keyof Filtros)[]).filter(k => f[k] !== SIN_FILTROS[k]).length

interface Candidato {
  specialty: string
  rating: number | null
  verificado: boolean
  fecha: string | null
  status?: string
}

export function pasaFiltros(f: Filtros, c: Candidato) {
  if (f.status !== 'ALL' && c.status !== undefined && c.status !== f.status) return false
  if (f.specialty !== 'ALL' && !c.specialty.includes(f.specialty)) return false
  const minimo = Number(f.minRating)
  if (minimo > 0 && !(c.rating != null && c.rating >= minimo)) return false
  if (f.verification === 'VALIDADO' && !c.verificado) return false
  if (f.verification === 'PENDIENTE' && c.verificado) return false
  const dias = Number(f.dateRange)
  if (dias > 0) {
    const t = c.fecha ? new Date(c.fecha).getTime() : NaN
    if (isNaN(t) || Date.now() - t > dias * 864e5) return false
  }
  return true
}
