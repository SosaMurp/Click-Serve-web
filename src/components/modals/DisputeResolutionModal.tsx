import { useState } from 'react'
import { X, Check, AlertCircle } from 'lucide-react'
import { Button } from '@components/ui'
import type { SettleDisputePayload } from '../../types/api'
import './modals.css'

interface DisputeResolutionModalProps {
  isOpen: boolean
  onClose: () => void
  ticketId?: string
  userName?: string
  techName?: string
  /** Liquida la disputa en el servidor (POST /api/admin/disputes/:id/settle) */
  onResolve?: (payload: SettleDisputePayload) => Promise<void>
}

export default function DisputeResolutionModal({
  isOpen,
  onClose,
  ticketId = '',
  userName = 'cliente',
  techName = 'técnico',
  onResolve,
}: DisputeResolutionModalProps) {
  const [refundAmount, setRefundAmount] = useState('0')
  const [fineAmount, setFineAmount] = useState('0')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleResolve = async () => {
    if (!onResolve) return
    setSaving(true)
    setError('')
    try {
      await onResolve({
        montoReembolso: Number(refundAmount) || 0,
        montoMulta: Number(fineAmount) || 0,
        observaciones: reason.trim() || undefined,
      })
      onClose()
    } catch {
      setError('No se pudo registrar la liquidación. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-container--sm fade-in">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">Liquidación de Conflictos</h3>
            <p className="modal-subtitle">FOLIO DE TICKET #{ticketId}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ gap: 14 }}>
          <div
            style={{
              background: '#FFF3D6',
              border: '1px solid #FFE3A3',
              padding: 12,
              borderRadius: 6,
              fontSize: 12,
              color: 'var(--warning)',
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
                  background: '#F7F8F9',
                  border: '1px solid #CDD3E0',
                  borderRight: 'none',
                  borderRadius: '6px 0 0 6px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#4B5563',
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
                  border: '1px solid #CDD3E0',
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
                  background: '#F7F8F9',
                  border: '1px solid #CDD3E0',
                  borderRight: 'none',
                  borderRadius: '6px 0 0 6px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#4B5563',
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
                  border: '1px solid #CDD3E0',
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
              Dictamen de Resolución
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 6,
                border: '1px solid #CDD3E0',
                fontSize: 13,
                height: 60,
                fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <p style={{ fontSize: 12, color: 'var(--danger-ink)', margin: 0 }}>{error}</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button variant="ghost" size="sm" onClick={onClose}>
              CANCELAR
            </Button>
            <Button variant="primary" size="sm" onClick={handleResolve} loading={saving} disabled={!onResolve} title="Ejecutar Movimiento">
              <Check size={14} /> EJECUTAR MOVIMIENTO
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
