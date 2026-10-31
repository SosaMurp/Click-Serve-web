import { useState } from 'react'
import { X, Check, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@components/ui'
import { useLiquidacion, useLiquidar } from '../../hooks/useAdminQueries'
import type { IncidenciaRow, LiquidarResultado } from '../../types/api'
import './modals.css'

// Liquidación de conflictos (RF-82, RF-83): cuánto se devuelve al cliente y qué multa operativa se aplica al técnico.
// Al confirmar, el servidor asienta el movimiento y actualiza la billetera del técnico; el caso se liquida una sola vez.

const mxn = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
const fechaLarga = (iso: string) => new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function LiquidacionModal({ incidencia: i, onClose }: { incidencia: IncidenciaRow; onClose: () => void }) {
  const { data: info, isLoading, isError } = useLiquidacion(i.id_incidencia)
  const liquidar = useLiquidar()
  const [devolucion, setDevolucion] = useState('')
  const [multa, setMulta] = useState('')
  const [descontar, setDescontar] = useState(false)
  const [notas, setNotas] = useState('')
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState<LiquidarResultado | null>(null)

  const dev = Number(devolucion) || 0
  const mul = Number(multa) || 0
  const cargo = mul + (descontar ? dev : 0)
  const saldoDespues = info?.saldo_tecnico != null ? info.saldo_tecnico - cargo : null

  const problema = !info ? '' :
    dev < 0 || mul < 0 ? 'Los montos no pueden ser negativos.' :
    dev > info.reembolsable ? `Solo se pueden devolver ${mxn(info.reembolsable)}.` :
    mul > info.multa_maxima ? `La multa máxima es ${mxn(info.multa_maxima)}.` :
    dev + mul <= 0 ? 'Define un monto a devolver o una multa.' : ''

  const confirmar = async () => {
    if (!info || problema) return
    const lineas = [
      dev > 0 ? `• Devolver ${mxn(dev)} al cliente${descontar ? ' (se descuenta al técnico)' : ''}` : '',
      mul > 0 ? `• Multa de ${mxn(mul)} a ${info.tecnico || 'el técnico'}` : '',
    ].filter(Boolean).join('\n')
    if (!window.confirm(`Vas a liquidar el caso ${i.folio}:\n\n${lineas}\n\nEsto no se puede deshacer.`)) return
    setError('')
    try {
      setHecho(await liquidar.mutateAsync({
        id: i.id_incidencia,
        payload: { devolucion: dev || undefined, multa: mul || undefined, descontar_devolucion: descontar, notas: notas.trim() || undefined },
      }))
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'No se pudo liquidar el caso. Intenta de nuevo.')
    }
  }

  const aviso: React.CSSProperties = { background: '#FFF3D6', border: '1px solid #FFE3A3', padding: 12, borderRadius: 8, fontSize: 12, color: 'var(--warning)', display: 'flex', gap: 8, alignItems: 'flex-start' }
  const resumen: React.CSSProperties = { background: 'var(--bg-sunk)', border: '1px solid var(--border-light)', borderRadius: 8, padding: 12, fontSize: 13, display: 'grid', gap: 4 }

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-container--sm fade-in">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">Liquidación de conflictos</h3>
            <p className="modal-subtitle">{i.folio} · ORDEN {i.folio_solicitud ?? '—'}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ gap: 14 }}>
          {isLoading && <p style={{ color: 'var(--text-mid)' }}>Cargando datos del cobro…</p>}
          {isError && <p style={{ color: 'var(--danger-ink)' }}>No se pudieron cargar los datos del caso.</p>}

          {hecho && (
            <div style={{ ...aviso, background: 'var(--success-soft)', border: '1px solid #B7E1C7', color: 'var(--success)' }} role="status">
              <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>Caso liquidado.</strong>
                <div style={{ marginTop: 4 }}>
                  {hecho.liquidacion.monto_reembolso > 0 && <>Reembolso al cliente: {mxn(hecho.liquidacion.monto_reembolso)}. </>}
                  {hecho.liquidacion.multa > 0 && <>Multa al técnico: {mxn(hecho.liquidacion.multa)}. </>}
                  {hecho.liquidacion.saldo_tecnico != null && <>Saldo del técnico: {mxn(hecho.liquidacion.saldo_tecnico)}.</>}
                </div>
                {hecho.liquidacion.saldo_negativo && (
                  <div style={{ marginTop: 4, color: 'var(--danger-ink)' }}>
                    El saldo quedó en negativo: el técnico no podrá retirar hasta cubrirlo con sus próximos servicios.
                  </div>
                )}
              </div>
            </div>
          )}

          {info?.liquidada && !hecho && (
            <div style={resumen}>
              <strong>Este caso ya fue liquidado{info.fecha_liquidacion ? ` el ${fechaLarga(info.fecha_liquidacion)}` : ''}.</strong>
              <span>Devuelto al cliente: {mxn(info.monto_reembolso ?? 0)}</span>
              <span>Multa al técnico: {mxn(info.multa ?? 0)}{info.reembolso_a_cargo_tecnico ? ' · la devolución se descontó al técnico' : ''}</span>
            </div>
          )}

          {info && !info.liquidada && !hecho && (
            <>
              <div style={aviso}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  {info.pagado > 0
                    ? <>Cobrado: <strong>{mxn(info.pagado)}</strong>{info.reembolsado > 0 && <> · ya devuelto: {mxn(info.reembolsado)}</>} · disponible para devolver: <strong>{mxn(info.reembolsable)}</strong>.</>
                    : <>Esta orden no tiene un cobro registrado: solo se puede aplicar una multa.</>}
                  {info.modo_pago === 'CONEKTA' && info.pagado > 0 && (
                    <div style={{ marginTop: 4 }}>El cobro fue con tarjeta real: el sistema asienta la devolución, pero el reembolso a la tarjeta se hace desde Conekta.</div>
                  )}
                  {info.modo_pago === 'SANDBOX' && info.pagado > 0 && <div style={{ marginTop: 4 }}>Cobro de prueba (sin cargo real).</div>}
                </div>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="liq-dev">Devolver al cliente (MXN)</label>
                <input id="liq-dev" className="field-input" type="number" min={0} max={info.reembolsable} step="0.01" inputMode="decimal"
                  value={devolucion} disabled={info.reembolsable <= 0} placeholder="0.00" onChange={e => setDevolucion(e.target.value)} />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="liq-mul">Multa operativa al técnico{info.tecnico ? ` (${info.tecnico})` : ''} (MXN)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input id="liq-mul" className="field-input" type="number" min={0} max={info.multa_maxima} step="0.01" inputMode="decimal"
                    value={multa} disabled={!info.id_tecnico} placeholder="0.00" onChange={e => setMulta(e.target.value)} />
                  {info.id_tecnico && (
                    <Button variant="outline" size="sm" onClick={() => setMulta(String(info.multa_sugerida))}>
                      Estándar {mxn(info.multa_sugerida)}
                    </Button>
                  )}
                </div>
                {!info.id_tecnico && <span className="field-msg">La orden no tiene técnico asignado.</span>}
              </div>

              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, opacity: info.id_tecnico && dev > 0 ? 1 : 0.5 }}>
                <input type="checkbox" checked={descontar} disabled={!info.id_tecnico || dev <= 0} onChange={e => setDescontar(e.target.checked)} />
                Descontar la devolución a la billetera del técnico
              </label>

              <div className="field">
                <label className="field-label" htmlFor="liq-notas">Dictamen</label>
                <textarea id="liq-notas" className="field-input" style={{ minHeight: 60, fontFamily: 'inherit' }} maxLength={500}
                  value={notas} onChange={e => setNotas(e.target.value)} placeholder="Motivo de la devolución o de la multa" />
              </div>

              {info.saldo_tecnico != null && (
                <div style={resumen}>
                  <span>Saldo del técnico: <strong>{mxn(info.saldo_tecnico)}</strong>{cargo > 0 && saldoDespues != null && <> → <strong style={{ color: saldoDespues < 0 ? 'var(--danger-ink)' : undefined }}>{mxn(saldoDespues)}</strong></>}</span>
                  {saldoDespues != null && saldoDespues < 0 && <span style={{ color: 'var(--danger-ink)' }}>Quedaría en negativo y no podría retirar hasta cubrirlo.</span>}
                </div>
              )}
              {(problema && (devolucion || multa)) && <p style={{ margin: 0, fontSize: 12, color: 'var(--danger-ink)' }}>{problema}</p>}
            </>
          )}
          {error && <p role="alert" style={{ margin: 0, fontSize: 12, color: 'var(--danger-ink)' }}>{error}</p>}
        </div>

        <div className="modal-footer">
          <Button variant="ghost" size="sm" onClick={onClose}>{info && !info.liquidada && !hecho ? 'CANCELAR' : 'CERRAR'}</Button>
          {info && !info.liquidada && !hecho && (
            <Button variant="primary" size="sm" loading={liquidar.isPending} disabled={!!problema} onClick={confirmar}>
              <Check size={14} /> LIQUIDAR CASO
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
