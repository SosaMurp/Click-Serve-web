// Rango de fechas que elige el administrador en el tablero. Las fechas son AAAA-MM-DD en la hora de
// Lázaro Cárdenas, igual que las interpreta el backend (ambos extremos incluidos).

export type PresetId = 'hoy' | '7d' | '30d' | 'mes' | 'mes_anterior' | 'personalizado'

export interface Rango {
  preset: PresetId
  desde: string
  hasta: string
}

export const MAX_DIAS = 366
const DIA_MS = 86_400_000
const ZONA = 'America/Mexico_City'

export const PRESETS: { id: Exclude<PresetId, 'personalizado'>; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: '7d', label: 'Últimos 7 días' },
  { id: '30d', label: 'Últimos 30 días' },
  { id: 'mes', label: 'Este mes' },
  { id: 'mes_anterior', label: 'Mes anterior' },
]

const aMs = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))
const aIso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export const hoyMx = () => new Date().toLocaleDateString('en-CA', { timeZone: ZONA })

export function rangoDePreset(preset: Exclude<PresetId, 'personalizado'>, hoy = hoyMx()): Rango {
  const t = aMs(hoy)
  switch (preset) {
    case 'hoy': return { preset, desde: hoy, hasta: hoy }
    case '7d': return { preset, desde: aIso(t - 6 * DIA_MS), hasta: hoy }
    case '30d': return { preset, desde: aIso(t - 29 * DIA_MS), hasta: hoy }
    case 'mes': return { preset, desde: `${hoy.slice(0, 7)}-01`, hasta: hoy }
    case 'mes_anterior': {
      const inicioMes = aMs(`${hoy.slice(0, 7)}-01`)
      const ultimo = inicioMes - DIA_MS
      return { preset, desde: `${aIso(ultimo).slice(0, 7)}-01`, hasta: aIso(ultimo) }
    }
  }
}

export const RANGO_INICIAL: Rango = rangoDePreset('30d')

export const diasDelRango = (r: Pick<Rango, 'desde' | 'hasta'>) => (aMs(r.hasta) - aMs(r.desde)) / DIA_MS + 1

/** Mensaje de error de un rango personalizado, o null si es válido. */
export function validarRango(desde: string, hasta: string): string | null {
  if (!desde || !hasta) return 'Elige la fecha de inicio y la de fin.'
  if (desde > hasta) return 'La fecha de inicio no puede ser posterior a la de fin.'
  if (hasta > hoyMx()) return 'La fecha de fin no puede ser futura.'
  if (diasDelRango({ desde, hasta }) > MAX_DIAS) return 'El rango máximo es de un año.'
  return null
}

const corta = (iso: string, conAnio: boolean) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', ...(conAnio ? { year: 'numeric' } : {}),
  }).replace(/\./g, '')

/** "7 oct – 5 nov 2026", "5 nov 2026" o, si cruza de año, "28 dic 2025 – 3 ene 2026". */
export function etiquetaRango({ desde, hasta }: Pick<Rango, 'desde' | 'hasta'>): string {
  if (desde === hasta) return corta(desde, true)
  const mismoAnio = desde.slice(0, 4) === hasta.slice(0, 4)
  return `${corta(desde, !mismoAnio)} – ${corta(hasta, true)}`
}

const CLAVE = 'dash_rango'

/** Último rango elegido en esta pestaña (las presets se recalculan para que "Hoy" siga siendo hoy). */
export function leerRango(): Rango {
  try {
    const g = JSON.parse(sessionStorage.getItem(CLAVE) || 'null') as Rango | null
    if (g?.preset && g.preset !== 'personalizado' && PRESETS.some(p => p.id === g.preset)) return rangoDePreset(g.preset)
    if (g?.preset === 'personalizado' && !validarRango(g.desde, g.hasta)) return g
  } catch {
    /* sin almacenamiento o dato dañado: se usa el rango inicial */
  }
  return rangoDePreset('30d')
}

export function guardarRango(r: Rango) {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(r))
  } catch {
    /* sin almacenamiento: el rango solo dura mientras la página está abierta */
  }
}
