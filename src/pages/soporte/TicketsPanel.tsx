import { useEffect, useRef, useState } from 'react'
import { Send, X, Lock, RotateCcw, Paperclip } from 'lucide-react'
import { Badge, Button } from '@components/ui'
import { env } from '../../config/env'
import { useTickets, useTicketMensajes, useResponderTicket, useActualizarTicket } from '../../hooks/useAdminQueries'
import type { TicketRow } from '../../types/api'

// Bandeja de tickets que clientes y técnicos abren desde la app (RF-107): el asesor lee, responde,
// clasifica la prioridad y cierra el caso. La persona ve la respuesta en tiempo real en la app.

const ESTADO: Record<TicketRow['estado'], { label: string; variant: 'warning' | 'info' | 'danger' | 'neutral' }> = {
  ABIERTO: { label: 'Abierto', variant: 'warning' },
  EN_ATENCION: { label: 'En atención', variant: 'info' },
  ESCALADO: { label: 'Escalado', variant: 'danger' },
  CERRADO: { label: 'Cerrado', variant: 'neutral' },
}
const CATEGORIA: Record<TicketRow['categoria'], string> = {
  PAGOS: 'Pagos', SERVICIO: 'Servicio', CUENTA: 'Cuenta', SEGURIDAD: 'Seguridad', OTRO: 'Otro',
}
const API_ORIGIN = env.VITE_API_BASE_URL.replace(/\/api\/?$/, '')
const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function TicketsPanel() {
  const [vista, setVista] = useState<'ACTIVOS' | 'CERRADO'>('ACTIVOS')
  const [abierto, setAbierto] = useState<number | null>(null)
  const { data, isLoading, isError, refetch } = useTickets(vista)

  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className={`sop-filter-pill ${vista === 'ACTIVOS' ? 'sop-filter-pill--active' : ''}`} onClick={() => setVista('ACTIVOS')}>
          Activos{vista === 'ACTIVOS' && data ? ` (${data.length})` : ''}
        </button>
        <button className={`sop-filter-pill ${vista === 'CERRADO' ? 'sop-filter-pill--active' : ''}`} onClick={() => setVista('CERRADO')}>
          Cerrados
        </button>
      </div>

      <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="dash-table sop-table">
          <thead>
            <tr>
              <th>FOLIO / ACTUALIZADO</th>
              <th>PERSONA</th>
              <th>ASUNTO / ÚLTIMO MENSAJE</th>
              <th>ESTADO</th>
              <th>PRIORIDAD</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="sop-empty">Cargando tickets…</td></tr>}
            {isError && (
              <tr><td colSpan={6} className="sop-empty">
                No se pudieron cargar los tickets. <button className="sop-view-btn" onClick={() => refetch()}>REINTENTAR</button>
              </td></tr>
            )}
            {data && data.length === 0 && (
              <tr><td colSpan={6} className="sop-empty">{vista === 'ACTIVOS' ? 'No hay tickets pendientes.' : 'Todavía no hay tickets cerrados.'}</td></tr>
            )}
            {data?.map(t => (
              <tr key={t.id_ticket}>
                <td>
                  <p className="sop-folio">{t.folio}</p>
                  <p className="dash-table-id">{fecha(t.fecha_actualizacion)}</p>
                </td>
                <td>
                  <p className="dash-table-name">{t.nombre} {t.apellido}</p>
                  <p className="dash-table-id">{t.id_rol === 2 ? 'Técnico' : 'Cliente'}{t.folio_solicitud ? ` · ${t.folio_solicitud}` : ''}</p>
                </td>
                <td>
                  <p className="dash-table-name">{t.asunto} <span className="dash-table-id">· {CATEGORIA[t.categoria]}</span></p>
                  <p className="dash-table-id" style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.ultimo_es_asesor ? 'Soporte: ' : ''}{t.ultimo_mensaje}
                  </p>
                </td>
                <td><Badge variant={ESTADO[t.estado].variant}>{ESTADO[t.estado].label}</Badge></td>
                <td><Badge variant={t.prioridad === 'ALTA' ? 'danger' : t.prioridad === 'MEDIA' ? 'warning' : 'neutral'}>{t.prioridad}</Badge></td>
                <td>
                  <button className="sop-view-btn" onClick={() => setAbierto(t.id_ticket)}>
                    {t.estado === 'CERRADO' ? 'VER' : t.ultimo_es_asesor ? 'ABRIR' : 'RESPONDER'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {abierto != null && <TicketChat key={abierto} id={abierto} onClose={() => setAbierto(null)} />}
    </>
  )
}

function TicketChat({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, isLoading } = useTicketMensajes(id)
  const responder = useResponderTicket()
  const actualizar = useActualizarTicket()
  const [texto, setTexto] = useState('')
  const [error, setError] = useState('')
  const fin = useRef<HTMLDivElement>(null)

  useEffect(() => { fin.current?.scrollIntoView({ block: 'end' }) }, [data?.mensajes.length])

  const t = data?.ticket
  const cerrado = t?.estado === 'CERRADO'
  const errorDe = (err: unknown) => (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'No se pudo completar la acción.'

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!texto.trim()) return
    setError('')
    try {
      await responder.mutateAsync({ id, mensaje: texto.trim() })
      setTexto('')
    } catch (err) { setError(errorDe(err)) }
  }

  const cambiar = async (payload: { estado?: string; prioridad?: string }) => {
    setError('')
    try { await actualizar.mutateAsync({ id, ...payload }) } catch (err) { setError(errorDe(err)) }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-container--lg modal-container--fixed fade-in">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">{t ? t.asunto : 'Cargando…'}</h3>
            <p className="modal-subtitle">
              {t ? `${t.folio} · ${t.nombre} ${t.apellido} · ${t.correo}${t.folio_solicitud ? ` · ORDEN ${t.folio_solicitud}` : ''}` : ''}
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {t && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 24px', borderBottom: '1px solid var(--border-light)' }}>
            <Badge variant={ESTADO[t.estado].variant}>{ESTADO[t.estado].label}</Badge>
            <select className="tec-select" value={t.prioridad} disabled={actualizar.isPending}
              onChange={e => cambiar({ prioridad: e.target.value })}>
              <option value="ALTA">Prioridad alta</option>
              <option value="MEDIA">Prioridad media</option>
              <option value="BAJA">Prioridad baja</option>
            </select>
            <span style={{ flex: 1 }} />
            {cerrado ? (
              <Button size="sm" variant="outline" loading={actualizar.isPending} onClick={() => cambiar({ estado: 'EN_ATENCION' })}>
                <RotateCcw size={13} /> REABRIR
              </Button>
            ) : (
              <Button size="sm" variant="outline" loading={actualizar.isPending} onClick={() => cambiar({ estado: 'CERRADO' })}>
                <Lock size={13} /> CERRAR CASO
              </Button>
            )}
          </div>
        )}

        <div className="modal-body" style={{ gap: 10, background: 'var(--bg-sunk)' }}>
          {isLoading && <p style={{ color: 'var(--text-mid)' }}>Cargando conversación…</p>}
          {data?.mensajes.map(m => (
            <div key={m.id_mensaje} style={{ alignSelf: m.es_asesor ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
              <div style={{
                background: m.es_asesor ? 'var(--navy)' : '#fff', color: m.es_asesor ? '#fff' : 'var(--text-dark)',
                border: m.es_asesor ? 'none' : '1px solid var(--border-light)', borderRadius: 12, padding: '10px 12px', fontSize: 14, whiteSpace: 'pre-wrap',
              }}>
                {m.mensaje}
                {m.adjunto_url && (
                  <a href={`${API_ORIGIN}${m.adjunto_url}`} target="_blank" rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 12, color: m.es_asesor ? '#fff' : 'var(--accent-ink)' }}>
                    <Paperclip size={12} /> Ver adjunto
                  </a>
                )}
              </div>
              <p style={{ margin: '2px 4px 0', fontSize: 11, color: 'var(--text-muted)', textAlign: m.es_asesor ? 'right' : 'left' }}>
                {m.es_asesor ? (m.id_emisor ? 'Soporte' : 'Respuesta automática') : `${t?.nombre ?? ''}`} · {fecha(m.fecha_envio)}
              </p>
            </div>
          ))}
          <div ref={fin} />
        </div>

        <form className="modal-footer" onSubmit={enviar} style={{ gap: 8 }}>
          {error && <p style={{ margin: 0, fontSize: 12, color: 'var(--danger-ink)', flex: '1 0 100%' }}>{error}</p>}
          <input className="field-input" style={{ flex: 1 }} value={texto} onChange={e => setTexto(e.target.value)}
            placeholder={cerrado ? 'El caso está cerrado; reábrelo para responder.' : 'Escribe la respuesta para la persona…'}
            disabled={cerrado} maxLength={2000} />
          <Button type="submit" variant="primary" size="sm" loading={responder.isPending} disabled={cerrado || !texto.trim()}>
            <Send size={13} /> ENVIAR
          </Button>
        </form>
      </div>
    </div>
  )
}
