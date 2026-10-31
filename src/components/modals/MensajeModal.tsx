import { useState } from 'react'
import { X, Send } from 'lucide-react'
import { Button } from '@components/ui'
import { useComunicados, useEnviarComunicado } from '../../hooks/useAdminQueries'
import './modals.css'

// Mensaje personalizado del administrador a un cliente o técnico (RF-116 medio de entrega y redacción rápida,
// RF-117 envío). Se manda por notificación de la app (APP PUSH) o por correo (EMAIL).

type Canal = 'PUSH' | 'EMAIL'

const PLANTILLAS = [
  { nombre: 'Documento por vencer', asunto: 'Actualiza tu documento', mensaje: 'Uno de tus documentos está por vencer. Súbelo de nuevo desde la app para seguir recibiendo servicios.' },
  { nombre: 'Falta verificación', asunto: 'Completa tu verificación', mensaje: 'Aún falta completar tu verificación de identidad. Hazlo desde la app para activar tu cuenta.' },
  { nombre: 'Aviso de servicio', asunto: 'Sobre tu servicio', mensaje: 'Revisamos tu caso y queremos darte seguimiento. Responde a este mensaje o abre un ticket de soporte desde la app.' },
  { nombre: 'Agradecimiento', asunto: 'Gracias por usar Click & Serve', mensaje: 'Gracias por ser parte de Click & Serve. Tu trabajo hace posible que la comunidad de Lázaro Cárdenas encuentre ayuda de confianza.' },
]

const fecha = (iso: string) => new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function MensajeModal({ userId, nombre, onClose }: { userId: number; nombre: string; onClose: () => void }) {
  const historial = useComunicados(userId)
  const enviar = useEnviarComunicado()
  const [canal, setCanal] = useState<Canal>('PUSH')
  const [asunto, setAsunto] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const mandar = async () => {
    setError('')
    setOk('')
    try {
      const r = await enviar.mutateAsync({ id_usuario: userId, canal, asunto: asunto.trim(), mensaje: mensaje.trim() })
      setOk(r.mensaje)
      setAsunto('')
      setMensaje('')
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'No se pudo enviar el mensaje.')
    }
  }

  const listo = asunto.trim().length >= 3 && mensaje.trim().length >= 5

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-container--sm fade-in">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">Enviar mensaje</h3>
            <p className="modal-subtitle">PARA {nombre.toUpperCase()}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ gap: 14 }}>
          <div className="field">
            <span className="field-label">Medio de entrega</span>
            <div className="fin-filter-tabs" style={{ padding: 0 }} role="radiogroup" aria-label="Medio de entrega">
              {([['PUSH', 'APP PUSH'], ['EMAIL', 'EMAIL']] as const).map(([k, label]) => (
                <button key={k} type="button" role="radio" aria-checked={canal === k} className={`fin-filter-tab ${canal === k ? 'active' : ''}`}
                  onClick={() => setCanal(k)}>{label}</button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field-label">Redacción rápida</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PLANTILLAS.map(t => (
                <button key={t.nombre} type="button" className="dash-search-tab" onClick={() => { setAsunto(t.asunto); setMensaje(t.mensaje) }}>{t.nombre}</button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="msg-asunto">Asunto</label>
            <input id="msg-asunto" className="field-input" maxLength={80} value={asunto} onChange={e => setAsunto(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="msg-texto">Mensaje</label>
            <textarea id="msg-texto" className="field-input" style={{ minHeight: 90, fontFamily: 'inherit' }} maxLength={500}
              value={mensaje} onChange={e => setMensaje(e.target.value)} />
            <span className="field-msg">{mensaje.length}/500</span>
          </div>

          {ok && <p role="status" style={{ margin: 0, fontSize: 13, color: 'var(--success)' }}>{ok}</p>}
          {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--danger-ink)' }}>{error}</p>}

          {(historial.data?.length ?? 0) > 0 && (
            <div>
              <span className="field-label">Enviados antes</span>
              <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'grid', gap: 6, fontSize: 12.5 }}>
                {historial.data!.slice(0, 5).map(c => (
                  <li key={c.id_comunicado} style={{ background: 'var(--bg-sunk)', borderRadius: 8, padding: '8px 10px' }}>
                    <strong>{c.asunto}</strong> <span style={{ color: 'var(--text-muted)' }}>· {c.canal === 'PUSH' ? 'App' : 'Correo'} · {fecha(c.fecha)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <Button variant="ghost" size="sm" onClick={onClose}>CERRAR</Button>
          <Button variant="primary" size="sm" loading={enviar.isPending} disabled={!listo} onClick={mandar}>
            <Send size={13} /> ENVIAR
          </Button>
        </div>
      </div>
    </div>
  )
}
