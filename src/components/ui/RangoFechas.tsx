import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronDown, Check } from 'lucide-react'
import {
  PRESETS, etiquetaRango, hoyMx, rangoDePreset, validarRango, type Rango,
} from '@/lib/rango'

interface RangoFechasProps {
  value: Rango
  onChange: (rango: Rango) => void
}

/** Selector del rango de fechas del tablero: atajos (hoy, 7 días, mes…) y un rango personalizado. */
export default function RangoFechas({ value, onChange }: RangoFechasProps) {
  const [abierto, setAbierto] = useState(false)
  const [desde, setDesde] = useState(value.desde)
  const [hasta, setHasta] = useState(value.hasta)
  const [error, setError] = useState('')
  const raiz = useRef<HTMLDivElement>(null)
  const hoy = hoyMx()

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) setAbierto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [abierto])

  const abrir = () => {
    setDesde(value.desde)
    setHasta(value.hasta)
    setError('')
    setAbierto(a => !a)
  }

  const elegir = (id: (typeof PRESETS)[number]['id']) => {
    onChange(rangoDePreset(id))
    setAbierto(false)
  }

  const aplicar = (e: React.FormEvent) => {
    e.preventDefault()
    const problema = validarRango(desde, hasta)
    if (problema) { setError(problema); return }
    onChange({ preset: 'personalizado', desde, hasta })
    setAbierto(false)
  }

  return (
    <div className="rf" ref={raiz}>
      <button type="button" className="db-range db-range--btn" onClick={abrir} aria-haspopup="dialog" aria-expanded={abierto}
        aria-label={`Rango de fechas: ${etiquetaRango(value)}. Cambiar`}>
        <CalendarDays size={15} /> {etiquetaRango(value)} <ChevronDown size={14} className={abierto ? 'rf-chev rf-chev--up' : 'rf-chev'} />
      </button>

      {abierto && (
        <div className="rf-pop" role="dialog" aria-label="Elegir rango de fechas">
          <ul className="rf-list">
            {PRESETS.map(p => (
              <li key={p.id}>
                <button type="button" className={`rf-opt ${value.preset === p.id ? 'rf-opt--on' : ''}`} onClick={() => elegir(p.id)}>
                  {p.label}
                  {value.preset === p.id && <Check size={14} aria-label="Seleccionado" />}
                </button>
              </li>
            ))}
          </ul>

          <form className="rf-custom" onSubmit={aplicar} noValidate>
            <p className={`rf-custom-title ${value.preset === 'personalizado' ? 'rf-custom-title--on' : ''}`}>Personalizado</p>
            <div className="rf-dates">
              <label>
                <span>Desde</span>
                <input type="date" value={desde} max={hoy} onChange={e => { setDesde(e.target.value); setError('') }} />
              </label>
              <label>
                <span>Hasta</span>
                <input type="date" value={hasta} max={hoy} min={desde || undefined} onChange={e => { setHasta(e.target.value); setError('') }} />
              </label>
            </div>
            {error && <p className="rf-error" role="alert">{error}</p>}
            <button type="submit" className="rf-apply">Aplicar rango</button>
          </form>
        </div>
      )}
    </div>
  )
}
