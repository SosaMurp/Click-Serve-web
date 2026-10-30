import { useState } from 'react'
import { X, Calendar, Clock, Check } from 'lucide-react'
import { Button } from '@components/ui'
import './modals.css'

interface RescheduleModalProps {
  isOpen: boolean
  onClose: () => void
  serviceId?: string
}

export default function RescheduleModal({ isOpen, onClose, serviceId = 'SRV-108' }: RescheduleModalProps) {
  const [newDate, setNewDate] = useState('2026-09-22')
  const [newTime, setNewTime] = useState('11:00')
  const [reason, setReason] = useState('Solicitud del cliente por traslape de agenda')

  if (!isOpen) return null

  const handleConfirm = () => {
    alert(`Reprogramación formalizada para el servicio #${serviceId} el ${newDate} a las ${newTime}.`)
    onClose()
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-container--sm fade-in">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">Reprogramación de Cita</h3>
            <p className="modal-subtitle">SERVICIO #{serviceId}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>
              Nueva Fecha Sugerida
            </label>
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #CDD3E0', fontSize: 13 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>
              Nuevo Horario Sugerido
            </label>
            <input
              type="time"
              value={newTime}
              onChange={e => setNewTime(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #CDD3E0', fontSize: 13 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>
              Motivo de Reprogramación
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #CDD3E0', fontSize: 13, height: 60, fontFamily: 'inherit' }}
            />
          </div>
        </div>

        <div className="modal-footer">
          <Button variant="outline" onClick={onClose}>
            CANCELAR
          </Button>
          <Button variant="primary" onClick={handleConfirm}>
            <Check size={14} /> CONFIRMAR REPROGRAMACIÓN
          </Button>
        </div>
      </div>
    </div>
  )
}

