import { useState } from 'react'
import { X, Filter, RotateCcw } from 'lucide-react'
import { Button } from '@components/ui'
import './modals.css'

interface AdvancedFiltersModalProps {
  isOpen: boolean
  onClose: () => void
  onApplyFilters?: (filters: Record<string, string>) => void
}

export default function AdvancedFiltersModal({ isOpen, onClose, onApplyFilters }: AdvancedFiltersModalProps) {
  const [status, setStatus] = useState('ALL')
  const [specialty, setSpecialty] = useState('ALL')
  const [minRating, setMinRating] = useState('0')
  const [verification, setVerification] = useState('ALL')
  const [dateRange, setDateRange] = useState('ALL')

  if (!isOpen) return null

  const handleReset = () => {
    setStatus('ALL')
    setSpecialty('ALL')
    setMinRating('0')
    setVerification('ALL')
    setDateRange('ALL')
  }

  const handleApply = () => {
    if (onApplyFilters) {
      onApplyFilters({ status, specialty, minRating, verification, dateRange })
    }
    onClose()
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-container--sm fade-in">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">Filtros Avanzados</h3>
            <p className="modal-subtitle">REFINAMIENTO DE DATOS MULTIDIMENSIONAL</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>
              Estado de Cuenta
            </label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #CDD3E0', fontSize: 13 }}>
              <option value="ALL">Todos los Estados</option>
              <option value="ACTIVO">Activo</option>
              <option value="EN REVISIÓN">En Revisión</option>
              <option value="SUSPENDIDO">Suspendido</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>
              Especialidad Técnica
            </label>
            <select value={specialty} onChange={e => setSpecialty(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #CDD3E0', fontSize: 13 }}>
              <option value="ALL">Todas las Especialidades</option>
              <option value="Soporte y Hardware">Soporte y Hardware</option>
              <option value="Desarrollo Web">Desarrollo Web</option>
              <option value="Redes y Conectividad">Redes y Conectividad</option>
              <option value="Mantenimiento Preventivo">Mantenimiento Preventivo</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>
              Calificación Mínima
            </label>
            <select value={minRating} onChange={e => setMinRating(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #CDD3E0', fontSize: 13 }}>
              <option value="0">Cualquier Calificación</option>
              <option value="4.5">★ 4.5 o superior</option>
              <option value="4.0">★ 4.0 o superior</option>
              <option value="3.5">★ 3.5 o superior</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>
              Verificación SEP / Biometría
            </label>
            <select value={verification} onChange={e => setVerification(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #CDD3E0', fontSize: 13 }}>
              <option value="ALL">Sin Filtro de Verificación</option>
              <option value="VALIDADO">Cédula Validada en SEP</option>
              <option value="PENDIENTE">Pendiente de Verificación</option>
            </select>
          </div>
        </div>

        <div className="modal-footer">
          <Button variant="ghost" onClick={handleReset}>
            <RotateCcw size={13} /> RESTABLECER
          </Button>
          <Button variant="primary" onClick={handleApply}>
            <Filter size={13} /> APLICAR FILTROS
          </Button>
        </div>
      </div>
    </div>
  )
}

