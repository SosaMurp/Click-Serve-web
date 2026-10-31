import { useEffect, useState } from 'react'
import { X, Filter, RotateCcw } from 'lucide-react'
import { Button } from '@components/ui'
import { CATEGORIAS, RANGOS_FECHA, SIN_FILTROS, type Filtros } from '../../lib/filtros'
import './modals.css'

interface AdvancedFiltersModalProps {
  isOpen: boolean
  onClose: () => void
  value: Filtros
  onApply: (filters: Filtros) => void
  /** El estado de cuenta solo se filtra en el directorio; la cola de validaciones no lo usa. */
  showStatus?: boolean
  /** Lo que significa "verificado" en la pantalla que abre el modal (identidad, cédula SEP…). */
  verificationLabel?: string
}

const labelStyle = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-mid)', display: 'block', marginBottom: 6 } as const
const selectStyle = { width: '100%', padding: '10px 12px' } as const

export default function AdvancedFiltersModal({
  isOpen, onClose, value, onApply, showStatus = true, verificationLabel = 'identidad verificada',
}: AdvancedFiltersModalProps) {
  const [draft, setDraft] = useState<Filtros>(value)

  // Cada vez que se abre parte de los filtros vigentes, no de lo que quedó a medias la vez anterior
  useEffect(() => { if (isOpen) setDraft(value) }, [isOpen, value])

  if (!isOpen) return null

  const set = (k: keyof Filtros) => (e: React.ChangeEvent<HTMLSelectElement>) => setDraft(d => ({ ...d, [k]: e.target.value }))

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-container--sm fade-in">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">Filtros avanzados</h3>
            <p className="modal-subtitle">AFINA LA LISTA SIN SALIR DE LA PANTALLA</p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ gap: 16 }}>
          {showStatus && (
            <div>
              <label style={labelStyle} htmlFor="flt-status">Estado de cuenta</label>
              <select id="flt-status" className="tec-select" style={selectStyle} value={draft.status} onChange={set('status')}>
                <option value="ALL">Todos los estados</option>
                <option value="ACTIVO">Activo</option>
                <option value="EN REVISIÓN">En revisión</option>
                <option value="RECHAZADO">Rechazado</option>
                <option value="SUSPENDIDO">Suspendido</option>
              </select>
            </div>
          )}

          <div>
            <label style={labelStyle} htmlFor="flt-spec">Especialidad técnica</label>
            <select id="flt-spec" className="tec-select" style={selectStyle} value={draft.specialty} onChange={set('specialty')}>
              <option value="ALL">Todas las especialidades</option>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle} htmlFor="flt-rating">Calificación mínima</label>
            <select id="flt-rating" className="tec-select" style={selectStyle} value={draft.minRating} onChange={set('minRating')}>
              <option value="0">Cualquier calificación</option>
              <option value="4.5">★ 4.5 o superior</option>
              <option value="4">★ 4.0 o superior</option>
              <option value="3.5">★ 3.5 o superior</option>
            </select>
          </div>

          <div>
            <label style={labelStyle} htmlFor="flt-ver">Verificación</label>
            <select id="flt-ver" className="tec-select" style={selectStyle} value={draft.verification} onChange={set('verification')}>
              <option value="ALL">Sin filtro de verificación</option>
              <option value="VALIDADO">Con {verificationLabel}</option>
              <option value="PENDIENTE">Sin {verificationLabel}</option>
            </select>
          </div>

          <div>
            <label style={labelStyle} htmlFor="flt-date">Fecha de registro</label>
            <select id="flt-date" className="tec-select" style={selectStyle} value={draft.dateRange} onChange={set('dateRange')}>
              <option value="ALL">Cualquier fecha</option>
              {Object.entries(RANGOS_FECHA).map(([dias, texto]) => <option key={dias} value={dias}>{texto}</option>)}
            </select>
          </div>
        </div>

        <div className="modal-footer">
          <Button variant="ghost" onClick={() => setDraft(SIN_FILTROS)}>
            <RotateCcw size={13} /> RESTABLECER
          </Button>
          <Button variant="primary" onClick={() => { onApply(draft); onClose() }}>
            <Filter size={13} /> APLICAR FILTROS
          </Button>
        </div>
      </div>
    </div>
  )
}
