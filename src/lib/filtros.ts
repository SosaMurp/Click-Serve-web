// Filtros avanzados del directorio y de la cola de validaciones (RF-39). Se aplican en el navegador
// sobre las filas que ya trae el servidor, así que cambian al instante.
//
// Cada pantalla (y cada pestaña del directorio) usa solo los campos que tienen sentido para lo que lista:
// un cliente no tiene especialidad ni calificación, un administrador tampoco. Lo demás se ignora.

export interface Filtros {
  status: string
  specialty: string
  minRating: string
  verification: string
  dateRange: string
  /** Clientes: con o sin servicios solicitados */
  activity: string
}

export type CampoFiltro = keyof Filtros

export const SIN_FILTROS: Filtros = { status: 'ALL', specialty: 'ALL', minRating: '0', verification: 'ALL', dateRange: 'ALL', activity: 'ALL' }

// Campos que ofrece cada sección
export const CAMPOS_TECNICOS: CampoFiltro[] = ['status', 'specialty', 'minRating', 'verification', 'dateRange']
export const CAMPOS_CLIENTES: CampoFiltro[] = ['status', 'activity', 'dateRange']
export const CAMPOS_VALIDACION: CampoFiltro[] = ['specialty', 'minRating', 'verification', 'dateRange']

// Categorías de servicio de la app (tabla categorias_servicio)
export const CATEGORIAS = [
  'Cómputo y redes', 'Electricidad', 'Plomería', 'Climatización', 'Línea blanca',
  'Cerrajería', 'Pintura e impermeabilización', 'Mecánica automotriz',
]

export const RANGOS_FECHA: Record<string, string> = { '7': 'Últimos 7 días', '30': 'Últimos 30 días', '90': 'Últimos 90 días' }

/** Cuántos filtros hay puestos, contando solo los campos de la sección. */
export const filtrosActivos = (f: Filtros, campos: CampoFiltro[] = Object.keys(SIN_FILTROS) as CampoFiltro[]) =>
  campos.filter(k => f[k] !== SIN_FILTROS[k]).length

interface Candidato {
  specialty?: string
  rating?: number | null
  verificado?: boolean
  fecha?: string | null
  status?: string
  /** Servicios solicitados (clientes) */
  servicios?: number | null
}

export function pasaFiltros(f: Filtros, c: Candidato, campos: CampoFiltro[] = Object.keys(SIN_FILTROS) as CampoFiltro[]) {
  const usa = (k: CampoFiltro) => campos.includes(k)
  if (usa('status') && f.status !== 'ALL' && c.status !== undefined && c.status !== f.status) return false
  if (usa('specialty') && f.specialty !== 'ALL' && !(c.specialty ?? '').includes(f.specialty)) return false
  const minimo = Number(f.minRating)
  if (usa('minRating') && minimo > 0 && !(c.rating != null && c.rating >= minimo)) return false
  if (usa('verification') && f.verification === 'VALIDADO' && !c.verificado) return false
  if (usa('verification') && f.verification === 'PENDIENTE' && c.verificado) return false
  if (usa('activity') && f.activity === 'CON' && !(Number(c.servicios) > 0)) return false
  if (usa('activity') && f.activity === 'SIN' && Number(c.servicios) > 0) return false
  const dias = Number(f.dateRange)
  if (usa('dateRange') && dias > 0) {
    const t = c.fecha ? new Date(c.fecha).getTime() : NaN
    if (isNaN(t) || Date.now() - t > dias * 864e5) return false
  }
  return true
}
