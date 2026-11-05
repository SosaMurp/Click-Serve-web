import { useState } from 'react'
import { X, ShieldCheck, ShieldAlert, Check, Ban } from 'lucide-react'
import { Button } from '@components/ui'
import { toast } from '@components/ui/Toaster'
import { mensajeDeError } from '@/lib/errores'
import './modals.css'

interface ValidationDecisionModalProps {
  isOpen: boolean
  onClose: () => void
  techName?: string
  techId?: string
  /** Debe completar la acción en el servidor; si falla, el modal muestra el error y sigue abierto. */
  onResolve: (approved: boolean, reason?: string, blockUser?: boolean) => Promise<void>
}

export default function ValidationDecisionModal({
  isOpen, onClose, techName = 'el técnico', techId, onResolve
}: ValidationDecisionModalProps) {
  const [action, setAction] = useState<'approve' | 'reject'>('approve')
  const [rejectReason, setRejectReason] = useState('Sospecha de fraude')
  const [customReason, setCustomReason] = useState('')
  const [blockUser, setBlockUser] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleConfirm = async () => {
    const finalReason = (rejectReason === 'Otro' ? customReason : rejectReason).trim()
    if (action === 'reject' && finalReason.length < 3) {
      setError('Escribe el motivo del rechazo.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await onResolve(action === 'approve', action === 'reject' ? finalReason : undefined, blockUser)
      toast.success(action === 'approve'
        ? `${techName} quedó aprobado y ya puede aceptar servicios.`
        : `Expediente de ${techName} rechazado${blockUser ? ' y cuenta bloqueada' : ''}.`)
      onClose()
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo guardar la decisión. Intenta de nuevo.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-container--sm fade-in">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">Resolución de Auditoría</h3>
            <p className="modal-subtitle">{techId ? `${techId} • ` : ''}{techName}</p>
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
                borderColor: action === 'approve' ? 'var(--accent-dim)' : '#E6E9EE',
                background: action === 'approve' ? '#E3F4EA' : '#fff',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                fontWeight: 700, fontSize: 13, color: action === 'approve' ? '#0B6235' : '#667085'
              }}
            >
              <ShieldCheck size={24} color={action === 'approve' ? '#0B6235' : '#667085'} />
              AUTORIZAR ACCESO
            </button>

            <button
              onClick={() => setAction('reject')}
              style={{
                padding: '14px', borderRadius: 8, border: '2px solid',
                borderColor: action === 'reject' ? 'var(--danger)' : '#E6E9EE',
                background: action === 'reject' ? '#FDE8E6' : '#fff',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                fontWeight: 700, fontSize: 13, color: action === 'reject' ? '#A41F15' : '#667085'
              }}
            >
              <ShieldAlert size={24} color={action === 'reject' ? '#A41F15' : '#667085'} />
              RECHAZAR SOLICITUD
            </button>
          </div>

          {action === 'approve' ? (
            <div style={{ background: '#E3F4EA', border: '1px solid #BFE3CD', padding: 14, borderRadius: 6, fontSize: 13, color: '#0B6235' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>Protocolo de Autorización y Firma</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.9 }}>
                Al confirmar, se otorgará el estatus operativo "ACTIVO" en la red Lázaro Cárdenas y se enviará la notificación oficial al técnico.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>
                  Motivo de Rechazo Predefinido
                </label>
                <select
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #CDD3E0', fontSize: 13 }}
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
                  style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #CDD3E0', fontSize: 13, height: 70, fontFamily: 'inherit' }}
                />
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#A41F15', fontWeight: 600, cursor: 'pointer', background: '#FDE8E6', padding: 10, borderRadius: 6 }}>
                <input type="checkbox" checked={blockUser} onChange={e => setBlockUser(e.target.checked)} />
                <Ban size={16} /> Bloquear usuario e inhabilitar nuevos registros
              </label>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" style={{ margin: '0 24px 12px', fontSize: 13, color: 'var(--danger-ink)' }}>{error}</p>
        )}
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

