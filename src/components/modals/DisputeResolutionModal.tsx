import { useState } from 'react'
import { X, Download, Check, AlertCircle } from 'lucide-react'
import { Button } from '@components/ui'
import './modals.css'

interface DisputeResolutionModalProps {
  isOpen: boolean
  onClose: () => void
  ticketId?: string
  userName?: string
  techName?: string
}

export default function DisputeResolutionModal({
  isOpen,
  onClose,
  ticketId = 'ICS-399',
  userName = 'José López',
  techName = 'Roberto García',
}: DisputeResolutionModalProps) {
  const [refundAmount, setRefundAmount] = useState('250.00')
  const [fineAmount, setFineAmount] = useState('100.00')
  const [reason, setReason] = useState('Violación de Términos y Condiciones / Cancelación en ruta')

  if (!isOpen) return null

  const handleExportPDF = () => {
    alert(`Expediente de disputa #${ticketId} exportado en PDF (RF-80).`)
  }

  const handleResolve = () => {
    alert(
      `Conflicto resuelto exitosamente. Reembolso a cliente: $${refundAmount} MXN. Multa a técnico: $${fineAmount} MXN. Billetera ajustada (RF-83).`,
    )
    onClose()
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-container--sm fade-in">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">Liquidación de Conflictos (RF-81, RF-82)</h3>
            <p className="modal-subtitle">FOLIO DE TICKET #{ticketId}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ gap: 14 }}>
          <div
            style={{
              background: '#fffbf0',
              border: '1px solid #fde68a',
              padding: 12,
              borderRadius: 6,
              fontSize: 12,
              color: '#92400e',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Resolución Económica y Administrativa:</strong>
              <br />
              Define el saldo a reembolsar al usuario afectado y aplica la sanción económica correspondiente al técnico.
            </div>
          </div>

          <div>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--text-mid)',
                display: 'block',
                marginBottom: 6,
              }}
            >
              Monto a Reembolsar al Cliente ({userName})
            </label>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span
                style={{
                  padding: '10px 14px',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRight: 'none',
                  borderRadius: '6px 0 0 6px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#334155',
                }}
              >
                $
              </span>
              <input
                type="number"
                value={refundAmount}
                onChange={e => setRefundAmount(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '0 6px 6px 0',
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                }}
              />
            </div>
          </div>

          <div>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--text-mid)',
                display: 'block',
                marginBottom: 6,
              }}
            >
              Multa Operativa al Técnico ({techName})
            </label>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span
                style={{
                  padding: '10px 14px',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRight: 'none',
                  borderRadius: '6px 0 0 6px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#334155',
                }}
              >
                $
              </span>
              <input
                type="number"
                value={fineAmount}
                onChange={e => setFineAmount(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '0 6px 6px 0',
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                }}
              />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-mid)', margin: '4px 0 0' }}>
              Estándar por T&C: $100.00 MXN por violación de servicio.
            </p>
          </div>

          <div>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--text-mid)',
                display: 'block',
                marginBottom: 6,
              }}
            >
              Dictamen de Resolución
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: 13,
                height: 60,
                fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <Button variant="outline" size="sm" onClick={handleExportPDF} title="Exportar PDF (RF-80)">
            <Download size={13} /> EXPORTAR PDF
          </Button>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button variant="ghost" size="sm" onClick={onClose}>
              CANCELAR
            </Button>
            <Button variant="primary" size="sm" onClick={handleResolve} title="Ejecutar Movimiento (RF-83)">
              <Check size={14} /> EJECUTAR MOVIMIENTO
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
