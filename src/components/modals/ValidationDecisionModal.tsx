import { useState } from 'react'
import { X, ShieldCheck, ShieldAlert, Check, Ban } from 'lucide-react'
import { Button } from '@components/ui'
import './modals.css'

interface ValidationDecisionModalProps {
  isOpen: boolean
  onClose: () => void
  techName?: string
  techId?: string
  onResolve?: (approved: boolean, reason?: string, blockUser?: boolean) => void
}

export default function ValidationDecisionModal({
  isOpen, onClose, techName = 'Roberto García', techId = 'PTEC-0041', onResolve
}: ValidationDecisionModalProps) {
  const [action, setAction] = useState<'approve' | 'reject'>('approve')
  const [rejectReason, setRejectReason] = useState('Sospecha de fraude')
  const [customReason, setCustomReason] = useState('')
  const [blockUser, setBlockUser] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleConfirm = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      const finalReason = rejectReason === 'Otro' ? customReason : rejectReason
      if (onResolve) {
        onResolve(action === 'approve', action === 'reject' ? finalReason : undefined, blockUser)
      }
      alert(action === 'approve' 
        ? `Técnico ${techName} autorizado exitosamente con firma de sistema.` 
        : `Expediente de ${techName} rechazado (${finalReason})${blockUser ? ' y usuario bloqueado' : ''}.`
      )
      onClose()
    }, 400)
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-container--sm fade-in">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">Resolución de Auditoría</h3>
            <p className="modal-subtitle">{techId} • {techName}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Action Selector */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              onClick={() => setAction('approve')}
              style={{
                padding: '14px', borderRadius: 8, border: '2px solid',
                borderColor: action === 'approve' ? 'var(--accent-dim)' : '#e2e8f0',
                background: action === 'approve' ? '#f0fdf4' : '#fff',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                fontWeight: 700, fontSize: 13, color: action === 'approve' ? '#166534' : '#64748b'
              }}
            >
              <ShieldCheck size={24} color={action === 'approve' ? '#166534' : '#64748b'} />
              AUTORIZAR ACCESO (RF-42)
            </button>

            <button
              onClick={() => setAction('reject')}
              style={{
                padding: '14px', borderRadius: 8, border: '2px solid',
                borderColor: action === 'reject' ? 'var(--danger)' : '#e2e8f0',
                background: action === 'reject' ? '#fef2f2' : '#fff',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                fontWeight: 700, fontSize: 13, color: action === 'reject' ? '#991b1b' : '#64748b'
              }}
            >
              <ShieldAlert size={24} color={action === 'reject' ? '#991b1b' : '#64748b'} />
              RECHAZAR SOLICITUD (RF-41)
            </button>
          </div>

          {action === 'approve' ? (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 14, borderRadius: 6, fontSize: 13, color: '#166534' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>Protocolo de Autorización y Firma (RF-42)</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.9 }}>
                Al confirmar, se otorgará el estatus operativo "ACTIVO" en la red Lázaro Cárdenas y se enviará la notificación oficial al técnico.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>
                  Motivo de Rechazo Predefinido (RF-41)
                </label>
                <select
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                >
                  <option value="Sospecha de fraude">Sospecha de fraude en documentos</option>
                  <option value="Inconsistencia de cédula">Cédula Profesional no coincide con SEP</option>
                  <option value="Documento ilegible">Documentos borrosos o ilegibles</option>
                  <option value="Identidad no verificada">Falló coincidencia en biometría facial</option>
                  <option value="Otro">Otro motivo personalizado...</option>
                </select>
              </div>

              {rejectReason === 'Otro' && (
                <textarea
                  placeholder="Escribe la justificación detallada..."
                  value={customReason}
                  onChange={e => setCustomReason(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, height: 70, fontFamily: 'inherit' }}
                />
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#991b1b', fontWeight: 600, cursor: 'pointer', background: '#fef2f2', padding: 10, borderRadius: 6 }}>
                <input type="checkbox" checked={blockUser} onChange={e => setBlockUser(e.target.checked)} />
                <Ban size={16} /> Bloquear usuario e inhabilitar nuevos registros
              </label>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <Button variant="outline" onClick={onClose}>
            CANCELAR
          </Button>
          <Button
            loading={loading}
            style={{
              background: action === 'approve' ? 'var(--accent-dim)' : 'var(--danger)',
              color: '#fff'
            }}
            onClick={handleConfirm}
          >
            {action === 'approve' ? <><Check size={14} /> AUTORIZAR Y REGISTRAR FIRMA</> : <><ShieldAlert size={14} /> EJECUTAR RECHAZO</>}
          </Button>
        </div>
      </div>
    </div>
  )
}

