import type { ReactNode } from 'react'

export interface Metric {
  id: string
  label: string
  value: ReactNode
  /** `alert` resalta la cifra cuando hay algo por atender */
  tone?: 'default' | 'alert' | 'ok'
}

interface MetricStripProps {
  items: Metric[]
  /** Con `active` y `onSelect` la franja funciona como filtro (cada métrica es una pestaña con su conteo) */
  active?: string
  onSelect?: (id: string) => void
  label?: string
}

/**
 * Franja de métricas en una sola línea: reemplaza la fila de tarjetas. Si recibe `onSelect`, cada métrica filtra
 * la tabla de debajo; si no, es solo informativa.
 */
export default function MetricStrip({ items, active, onSelect, label = 'Resumen' }: MetricStripProps) {
  const interactiva = typeof onSelect === 'function'
  return (
    <div className="ms" role={interactiva ? 'tablist' : 'group'} aria-label={label}>
      {items.map(m => {
        const contenido = (
          <>
            <span className={`ms-value ${m.tone && m.tone !== 'default' ? `ms-value--${m.tone}` : ''}`}>{m.value}</span>
            <span className="ms-label">{m.label}</span>
          </>
        )
        return interactiva ? (
          <button key={m.id} type="button" role="tab" aria-selected={active === m.id}
            className={`ms-item ms-item--btn ${active === m.id ? 'ms-item--on' : ''}`} onClick={() => onSelect(m.id)}>
            {contenido}
          </button>
        ) : (
          <div key={m.id} className="ms-item">{contenido}</div>
        )
      })}
    </div>
  )
}
