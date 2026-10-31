import { useState } from 'react'
import { X, CheckCircle, Ban } from 'lucide-react'
import { Button, Badge } from '@components/ui'
import './modals.css'

interface WithdrawalDetailModalProps {
  isOpen: boolean
  onClose: () => void
  withdrawalData?: {
    realId: number
    req: string
    date: string
    name: string
    techId: string
    bank: string
    clabe: string
    amount: string
    estado: 'Pendiente' | 'Aprobado' | 'Rechazado'
    motivoRechazo?: string | null
  }
  /** Autoriza el retiro en el servidor (POST /api/admin/retiros/:id/aprobar) */
  onApprove?: (id: number) => Promise<unknown>
  /** Rechaza el retiro; el monto regresa a la billetera del técnico */
  onReject?: (id: number, motivo: string) => Promise<unknown>
}

const ESTADO_BADGE = {
  Pendiente: { variant: 'warning', label: 'PENDIENTE DE AUTORIZACIÓN' },
  Aprobado: { variant: 'success', label: 'TRANSFERENCIA AUTORIZADA' },
  Rechazado: { variant: 'danger', label: 'RETIRO RECHAZADO' },
} as const

export default function WithdrawalDetailModal({ isOpen, onClose, withdrawalData: data, onApprove, onReject }: WithdrawalDetailModalProps) {
  const [estado, setEstado] = useState(data?.estado ?? 'Pendiente')
  const [rechazando, setRechazando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen || !data) return null

  const run = async (accion: () => Promise<unknown>, siguiente: typeof estado) => {
    setSaving(true)
    setError('')
    try {
      await accion()
      setEstado(siguiente)
      setRechazando(false)
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'No se pudo procesar el retiro. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const badge = ESTADO_BADGE[estado]

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-container--sm fade-in">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">Comprobante de retiro</h3>
            <p className="modal-subtitle">FOLIO {data.req}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ gap: 16 }}>
          <div style={{ background: 'var(--bg-sunk, #F7F8F9)', padding: 16, borderRadius: 8, border: '1px solid var(--border-light, #E6E9EE)', textAlign: 'center' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-mid)', textTransform: 'uppercase', margin: 0 }}>MONTO SOLICITADO</p>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-dark)', margin: '4px 0' }}>{data.amount} MXN</h2>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light, #E6E9EE)', paddingBottom: 6 }}>
              <span style={{ color: 'var(--text-mid)' }}>Beneficiario:</span>
              <strong style={{ color: 'var(--text-dark)' }}>{data.name} ({data.techId})</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light, #E6E9EE)', paddingBottom: 6 }}>
              <span style={{ color: 'var(--text-mid)' }}>Institución bancaria:</span>
              <strong style={{ color: 'var(--text-dark)' }}>{data.bank}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light, #E6E9EE)', paddingBottom: 6 }}>
              <span style={{ color: 'var(--text-mid)' }}>Cuenta CLABE:</span>
              <strong style={{ fontFamily: 'monospace', color: 'var(--text-dark)' }}>{data.clabe}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6 }}>
              <span style={{ color: 'var(--text-mid)' }}>Solicitado:</span>
              <strong style={{ color: 'var(--text-dark)' }}>{data.date}</strong>
            </div>
            {data.motivoRechazo && estado === 'Rechazado' && (
              <p style={{ margin: 0, color: 'var(--danger-ink, #A41F15)' }}>Motivo: {data.motivoRechazo}</p>
            )}
          </div>

          {rechazando && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-dark)' }}>
              MOTIVO DEL RECHAZO
              <textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Ej. La CLABE no corresponde al titular de la cuenta."
                style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border-strong, #8B93A1)', fontFamily: 'inherit', fontSize: 13, minHeight: 64, fontWeight: 400 }}
              />
              <span style={{ fontWeight: 400, color: 'var(--text-mid)' }}>El monto regresará al saldo del técnico.</span>
            </label>
          )}
          {error && <p style={{ margin: 0, fontSize: 12, color: 'var(--danger-ink, #A41F15)' }}>{error}</p>}
        </div>

        <div className="modal-footer">
          {estado !== 'Pendiente' ? (
            <Button variant="primary" onClick={onClose}>CERRAR</Button>
          ) : rechazando ? (
            <>
              <Button variant="ghost" onClick={() => setRechazando(false)} disabled={saving}>VOLVER</Button>
              <Button
                variant="outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                loading={saving} disabled={!onReject || motivo.trim().length < 5}
                onClick={() => onReject && run(() => onReject(data.realId, motivo.trim()), 'Rechazado')}
              >
                <Ban size={13} /> CONFIRMAR RECHAZO
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => setRechazando(true)} disabled={!onReject || saving}>
                <Ban size={13} /> DENEGAR RETIRO
              </Button>
              <Button variant="primary" loading={saving} disabled={!onApprove}
                onClick={() => onApprove && run(() => onApprove(data.realId), 'Aprobado')}>
                <CheckCircle size={13} /> AUTORIZAR TRANSFERENCIA
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
