import { useState } from 'react'
import { X, CheckCircle, CreditCard, DollarSign, Download, Building, FileText, Ban } from 'lucide-react'
import { Button, Badge } from '@components/ui'
import './modals.css'

interface WithdrawalDetailModalProps {
  isOpen: boolean
  onClose: () => void
  withdrawalData?: {
    req: string
    date: string
    name: string
    techId: string
    bank: string
    clabe: string
    amount: string
  }
}

export default function WithdrawalDetailModal({ isOpen, onClose, withdrawalData }: WithdrawalDetailModalProps) {
  const [processed, setProcessed] = useState(false)
  const [folio, setFolio] = useState('#TRX-889-C5')

  if (!isOpen) return null

  const data = withdrawalData || {
    req: '#REQ-9021',
    date: 'Hoy, 10:45 AM',
    name: 'Roberto García',
    techId: 'ID: #TEC-8041',
    bank: 'Nu México',
    clabe: '012 180 0150 9941 8001',
    amount: '$1,420.00'
  }

  const handleApprove = () => {
    setProcessed(true)
    alert(`Transferencia de ${data.amount} abonada a la cuenta de ${data.name}. Folio generado: ${folio}`)
  }

  const handleDeny = () => {
    alert(`Solicitud de retiro ${data.req} denegada.`)
    onClose()
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-container--sm fade-in">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">Comprobante Financiero</h3>
            <p className="modal-subtitle">SOLICITUD {data.req}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ gap: 16 }}>
          <div style={{ background: '#F7F8F9', padding: 16, borderRadius: 8, border: '1px solid #E6E9EE', textAlign: 'center' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-mid)', textTransform: 'uppercase', margin: 0 }}>MONTO SOLICITADO</p>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-dark)', margin: '4px 0' }}>{data.amount} MXN</h2>
            <Badge variant={processed ? 'success' : 'warning'}>
              {processed ? 'TRANSACCIÓN LIQUIDADA' : 'PENDIENTE DE AUTORIZACIÓN'}
            </Badge>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F7F8F9', paddingBottom: 6 }}>
              <span style={{ color: 'var(--text-mid)' }}>Beneficiario:</span>
              <strong style={{ color: 'var(--text-dark)' }}>{data.name} ({data.techId})</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F7F8F9', paddingBottom: 6 }}>
              <span style={{ color: 'var(--text-mid)' }}>Institución Bancaria:</span>
              <strong style={{ color: 'var(--text-dark)' }}>{data.bank}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F7F8F9', paddingBottom: 6 }}>
              <span style={{ color: 'var(--text-mid)' }}>Cuenta CLABE:</span>
              <strong style={{ fontFamily: 'monospace', color: 'var(--text-dark)' }}>{data.clabe}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6 }}>
              <span style={{ color: 'var(--text-mid)' }}>Folio de Reasignación:</span>
              <strong style={{ color: 'var(--accent-dim)' }}>{folio}</strong>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          {!processed ? (
            <>
              <Button variant="outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={handleDeny}>
                <Ban size={13} /> DENEGAR RETIRO
              </Button>
              <Button variant="primary" onClick={handleApprove}>
                <CheckCircle size={13} /> AUTORIZAR Y ABONAR
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={onClose}>
              CERRAR COMPROBANTE
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
