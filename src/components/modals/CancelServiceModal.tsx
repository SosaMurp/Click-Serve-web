import { useState } from 'react'
import { X, XCircle, ShieldAlert } from 'lucide-react'
import { Button } from '../ui'
import { toast } from '../ui/Toaster'
import { useCancelService } from '../../hooks/useServicios'
import { mensajeDeError } from '../../lib/errores'
import './modals.css'

interface CancelServiceModalProps {
  isOpen: boolean
  onClose: () => void
  serviceId: number
  serviceCode?: string
  serviceTitle?: string
  clientName?: string
  onCancelled?: () => void
}

// Única acción sobre el estado de un servicio que hace el panel: cancelarlo sin cargo (RF-61).
// El avance (en camino, en sitio, finalizado) lo registran técnico y cliente desde la app.
export default function CancelServiceModal({ isOpen, onClose, serviceId, serviceCode, serviceTitle, clientName, onCancelled }: CancelServiceModalProps) {
  const [motivo, setMotivo] = useState('')
  const [notificar, setNotificar] = useState(true)
  const [error, setError] = useState('')
  const cancelar = useCancelService()

  if (!isOpen) return null

  const cerrar = () => {
    if (cancelar.isPending) return
    setMotivo('')
    setError('')
    onClose()
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    const texto = motivo.trim()
    if (texto.length < 5) {
      setError('Escribe el motivo de la cancelación (mínimo 5 caracteres). El cliente y el técnico lo verán.')
      return
    }
    setError('')
    try {
      const res = await cancelar.mutateAsync({ id: serviceId, payload: { estatus: 'Cancelado', notificarCliente: notificar, motivoCambio: texto } })
      toast.success(res.mensaje)
      onCancelled?.()
      setMotivo('')
      onClose()
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo cancelar el servicio.'))
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-container--sm fade-in" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">Cancelar servicio sin cargo</h3>
            <p className="modal-subtitle">{serviceCode ?? `#${serviceId}`}{serviceTitle ? ` · ${serviceTitle}` : ''}</p>
          </div>
          <button type="button" className="modal-close-btn" onClick={cerrar} disabled={cancelar.isPending}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={enviar}>
          <div className="modal-body" style={{ gap: 14 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.5 }}>
              El servicio{clientName ? ` de ${clientName}` : ''} quedará <strong>cancelado sin cobro</strong> y el técnico asignado
              dejará de verlo en curso. El avance del servicio (en camino, en sitio, finalizado) lo registran el técnico y el cliente
              desde la app; si el servicio ya tiene un cobro, atiéndelo como incidencia.
            </p>

            <label className="field-label" htmlFor="motivo-cancelacion">Motivo de la cancelación</label>
            <textarea
              id="motivo-cancelacion"
              rows={3}
              maxLength={300}
              value={motivo}
              onChange={e => { setMotivo(e.target.value); setError('') }}
              placeholder="Ej. El cliente reportó que ya no necesita el servicio."
              style={{ width: '100%', padding: 10, borderRadius: 8, fontSize: 13, resize: 'vertical' }}
              autoFocus
            />

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={notificar} onChange={e => setNotificar(e.target.checked)} />
              Avisar al cliente con una notificación en la app
            </label>

            {error && (
              <div role="alert" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--danger-soft)', color: 'var(--danger-ink)', padding: '10px 12px', borderRadius: 8, fontSize: 13 }}>
                <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{error}</span>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <Button type="button" variant="secondary" onClick={cerrar} disabled={cancelar.isPending}>VOLVER</Button>
            <Button type="submit" variant="primary" loading={cancelar.isPending} style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}>
              <XCircle size={14} /> CANCELAR SERVICIO
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
