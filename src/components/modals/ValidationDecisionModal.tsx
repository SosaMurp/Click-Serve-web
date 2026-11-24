import { useId, useState } from 'react'
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
  // Sin decisión por defecto: aprobar una identidad tiene que ser una elección explícita.
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [rejectReason, setRejectReason] = useState('Sospecha de fraude')
  const [customReason, setCustomReason] = useState('')
  const [blockUser, setBlockUser] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const motivoId = useId()
  const detalleId = useId()

  if (!isOpen) return null

  const handleConfirm = async () => {
    if (!action) return
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
            <h3 className="modal-title">Resolución de auditoría</h3>
            <p className="modal-subtitle">{techId ? `${techId} • ` : ''}{techName}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="decision-grid" role="radiogroup" aria-label="Decisión sobre el expediente">
            <button type="button" role="radio" aria-checked={action === 'approve'}
              className={`decision-choice decision-choice--approve ${action === 'approve' ? 'decision-choice--on' : ''}`}
              onClick={() => setAction('approve')}>
              <ShieldCheck size={24} aria-hidden="true" />
              Autorizar acceso
            </button>
            <button type="button" role="radio" aria-checked={action === 'reject'}
              className={`decision-choice decision-choice--reject ${action === 'reject' ? 'decision-choice--on' : ''}`}
              onClick={() => setAction('reject')}>
              <ShieldAlert size={24} aria-hidden="true" />
              Rechazar solicitud
            </button>
          </div>

          {action === null && (
            <p className="decision-hint">Elige si autorizas o rechazas el expediente para continuar.</p>
          )}

          {action === 'approve' && (
            <div className="callout callout--success">
              <p className="callout-title">Protocolo de autorización y firma</p>
              <p className="callout-text">
                Al confirmar, se otorgará el estatus operativo "ACTIVO" en la red Lázaro Cárdenas y se enviará la notificación oficial al técnico.
              </p>
            </div>
          )}

          {action === 'reject' && (
            <div className="decision-form">
              <div className="field">
                <label className="field-label" htmlFor={motivoId}>Motivo del rechazo</label>
                <select id={motivoId} className="field-input" value={rejectReason} onChange={e => setRejectReason(e.target.value)}>
                  <option value="Sospecha de fraude">Sospecha de fraude en documentos</option>
                  <option value="Inconsistencia de cédula">Cédula Profesional no coincide con SEP</option>
                  <option value="Documento ilegible">Documentos borrosos o ilegibles</option>
                  <option value="Identidad no verificada">Falló coincidencia en biometría facial</option>
                  <option value="Otro">Otro motivo personalizado…</option>
                </select>
              </div>

              {rejectReason === 'Otro' && (
                <div className="field">
                  <label className="field-label" htmlFor={detalleId}>Justificación</label>
                  <textarea id={detalleId} className="field-input" rows={3}
                    placeholder="Escribe la justificación detallada…"
                    value={customReason} onChange={e => setCustomReason(e.target.value)} />
                </div>
              )}

              <label className="callout callout--danger callout--check">
                <input type="checkbox" checked={blockUser} onChange={e => setBlockUser(e.target.checked)} />
                <Ban size={16} aria-hidden="true" /> Bloquear usuario e inhabilitar nuevos registros
              </label>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="modal-error">{error}</p>
        )}
        <div className="modal-footer">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            variant={action === 'reject' ? 'danger' : 'accent'}
            loading={loading}
            disabled={!action}
            onClick={handleConfirm}
          >
            {action === 'reject'
              ? <><ShieldAlert size={14} /> Ejecutar rechazo</>
              : <><Check size={14} /> Autorizar y registrar firma</>}
          </Button>
        </div>
      </div>
    </div>
  )
}
