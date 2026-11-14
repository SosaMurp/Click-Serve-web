import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Settings2, Shield, MapPin, AlertTriangle, Save, CheckCircle, Power } from 'lucide-react'
import MaintenanceOverlay from '@components/layout/MaintenanceOverlay'
import PageHeader from '@components/ui/PageHeader'
import './configuracion.css'
import { toast } from '@components/ui/Toaster'
import { mensajeDeError } from '@/lib/errores'
import { usePlatformSettings, useUpdatePlatformSettings } from '../../hooks/useAdminQueries'
import type { UpdateSettingsPayload } from '../../types/api'

type Seccion = 'finanzas' | 'operacion' | 'identidad' | 'sistema'

const SECCIONES: { id: Seccion; label: string; sub: string; icon: typeof Settings2; pronto?: boolean }[] = [
  { id: 'finanzas', label: 'Finanzas', sub: 'Comisión, retiros y multas', icon: Settings2 },
  { id: 'operacion', label: 'Operación', sub: 'Radio y tiempos de servicio', icon: MapPin },
  { id: 'identidad', label: 'Identidad', sub: 'Verificación de técnicos', icon: Shield, pronto: true },
  { id: 'sistema', label: 'Sistema', sub: 'Modo mantenimiento', icon: Power },
]

const igual = (a: string, b: unknown) => Number(a) === Number(b)

export default function ConfiguracionPage() {
  const { data: settings, isLoading, isError, refetch } = usePlatformSettings()
  const guardar = useUpdatePlatformSettings()
  const [params, setParams] = useSearchParams()
  const pedida = params.get('seccion') as Seccion | null
  const seccion: Seccion = SECCIONES.some(s => s.id === pedida) ? (pedida as Seccion) : 'finanzas'
  const elegir = (id: Seccion) => setParams(id === 'finanzas' ? {} : { seccion: id }, { replace: true })

  const [commission, setCommission] = useState('')
  const [minWithdraw, setMinWithdraw] = useState('')
  const [fine, setFine] = useState('')
  const [radius, setRadius] = useState('')
  const [timeoutVal, setTimeoutVal] = useState('')
  const [maintenance, setMaintenance] = useState(false)
  const [confirmarMantenimiento, setConfirmarMantenimiento] = useState(false)
  const [guardado, setGuardado] = useState<Seccion | null>(null)

  // Los valores del servidor son la base: cada sección compara contra ellos para saber si hay cambios
  const cargar = () => {
    if (!settings) return
    setCommission(String(settings.comision_porcentaje))
    setMinWithdraw(String(settings.monto_minimo_retiro))
    setFine(String(settings.multa_operativa ?? '100'))
    setRadius(String(settings.radio_maximo_km))
    setTimeoutVal(String(settings.tolerancia_minutos))
    setMaintenance(settings.modo_mantenimiento)
  }
  useEffect(cargar, [settings]) // eslint-disable-line react-hooks/exhaustive-deps

  const sucia: Record<'finanzas' | 'operacion', boolean> = {
    finanzas: !!settings && (!igual(commission, settings.comision_porcentaje) || !igual(minWithdraw, settings.monto_minimo_retiro) || !igual(fine, settings.multa_operativa ?? 100)),
    operacion: !!settings && (!igual(radius, settings.radio_maximo_km) || !igual(timeoutVal, settings.tolerancia_minutos)),
  }

  const payload = (s: 'finanzas' | 'operacion'): UpdateSettingsPayload => s === 'finanzas'
    ? { comisionPorcentaje: Number(commission), montoMinimoRetiro: Number(minWithdraw), multaOperativa: Number(fine) }
    : { radioMaximoKm: Number(radius), toleranciaMinutos: Number(timeoutVal) }

  const guardarSeccion = async (s: 'finanzas' | 'operacion') => {
    try {
      await guardar.mutateAsync(payload(s))
      setGuardado(s)
      window.setTimeout(() => setGuardado(null), 3000)
    } catch (e) {
      toast.error(mensajeDeError(e, 'No se pudo guardar la configuración.'))
    }
  }

  const descartar = (s: 'finanzas' | 'operacion') => {
    if (!settings) return
    if (s === 'finanzas') {
      setCommission(String(settings.comision_porcentaje)); setMinWithdraw(String(settings.monto_minimo_retiro)); setFine(String(settings.multa_operativa ?? '100'))
    } else {
      setRadius(String(settings.radio_maximo_km)); setTimeoutVal(String(settings.tolerancia_minutos))
    }
  }

  // El modo mantenimiento se guarda al momento: la app empieza a responder 503 a clientes y técnicos.
  const cambiarMantenimiento = async (on: boolean) => {
    setMaintenance(on)
    setConfirmarMantenimiento(false)
    try {
      await guardar.mutateAsync({ modoMantenimiento: on })
      toast.success(on ? 'Modo mantenimiento activado.' : 'Modo mantenimiento desactivado.')
    } catch (e) {
      setMaintenance(!on)
      toast.error(mensajeDeError(e, 'No se pudo cambiar el modo mantenimiento. Intenta de nuevo.'))
    }
  }

  if (isLoading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando parámetros...</div>

  // Sin datos del servidor no se muestran valores de ejemplo: guardarlos sobrescribiría la configuración real.
  if (isError || !settings) {
    return (
      <div className="cfg-page fade-in">
        <PageHeader title="Configuración" sub="Parámetros globales de la plataforma" />
        <div className="cfg-card cfg-load-error">
          <AlertTriangle size={16} />
          <p>No se pudo cargar la configuración desde el servidor.</p>
          <button className="cfg-save-btn" onClick={() => refetch()}>Reintentar</button>
        </div>
      </div>
    )
  }

  const pie = (s: 'finanzas' | 'operacion') => (
    <div className="cfg-footer">
      {guardado === s && <span className="cfg-status cfg-status--ok"><CheckCircle size={14} /> Cambios guardados</span>}
      {sucia[s] && guardado !== s && <span className="cfg-status">Tienes cambios sin guardar</span>}
      <button type="button" className="cfg-discard-btn" disabled={!sucia[s] || guardar.isPending} onClick={() => descartar(s)}>Descartar</button>
      <button type="button" className="cfg-save-btn" disabled={!sucia[s] || guardar.isPending} onClick={() => guardarSeccion(s)}>
        <Save size={14} /> {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </div>
  )

  const actual = SECCIONES.find(s => s.id === seccion)!

  return (
    <div className="cfg-page fade-in">
      <PageHeader title="Configuración" sub="Parámetros globales de la plataforma" />

      <div className="cfg-layout">
        <nav className="cfg-nav" aria-label="Secciones de configuración">
          {SECCIONES.map(s => (
            <button key={s.id} type="button" aria-current={seccion === s.id ? 'page' : undefined}
              className={`cfg-nav-item ${seccion === s.id ? 'cfg-nav-item--on' : ''}`} onClick={() => elegir(s.id)}>
              <s.icon size={16} aria-hidden />
              <span className="cfg-nav-text">
                <span className="cfg-nav-label">{s.label}{s.pronto && <span className="cfg-badge-pill cfg-badge-pill--soon">Próximamente</span>}</span>
                <span className="cfg-nav-sub">{s.sub}</span>
              </span>
              {(s.id === 'finanzas' || s.id === 'operacion') && sucia[s.id] && <span className="cfg-nav-dot" aria-label="Cambios sin guardar" />}
            </button>
          ))}
        </nav>

        <section className="cfg-panel" aria-labelledby="cfg-titulo">
          <header className="cfg-panel-head">
            <h2 id="cfg-titulo" className="cfg-card-title">{actual.label}</h2>
            <p className="cfg-card-sub">{actual.sub}</p>
          </header>

          {seccion === 'finanzas' && (
            <>
              <div className="cfg-row">
                <div className="cfg-field">
                  <label className="cfg-label" htmlFor="cfg-comision">Comisión Click &amp; Serve</label>
                  <div className="cfg-input-suffix">
                    <input id="cfg-comision" className="cfg-input" type="number" min={0} max={100} step="0.1" value={commission} onChange={e => setCommission(e.target.value)} />
                    <span className="cfg-suffix">%</span>
                  </div>
                  <p className="cfg-hint">Porcentaje deducido de cada servicio completado. Afecta a todos los servicios que se liquiden desde que guardes el cambio.</p>
                </div>
                <div className="cfg-field">
                  <label className="cfg-label" htmlFor="cfg-retiro">Retiro mínimo permitido</label>
                  <div className="cfg-input-suffix">
                    <span className="cfg-prefix">$</span>
                    <input id="cfg-retiro" className="cfg-input cfg-input--prefix" type="number" min={0} value={minWithdraw} onChange={e => setMinWithdraw(e.target.value)} />
                    <span className="cfg-suffix">MXN</span>
                  </div>
                </div>
              </div>
              <div className="cfg-row">
                <div className="cfg-field">
                  <label className="cfg-label" htmlFor="cfg-multa">Multa operativa estándar</label>
                  <div className="cfg-input-suffix">
                    <span className="cfg-prefix">$</span>
                    <input id="cfg-multa" className="cfg-input cfg-input--prefix" type="number" min={0} value={fine} onChange={e => setFine(e.target.value)} />
                    <span className="cfg-suffix">MXN</span>
                  </div>
                  <p className="cfg-hint">Monto que se sugiere al liquidar un conflicto por violar los T&amp;C. Se puede ajustar en cada caso.</p>
                </div>
              </div>
              {pie('finanzas')}
            </>
          )}

          {seccion === 'operacion' && (
            <>
              <div className="cfg-row">
                <div className="cfg-field">
                  <label className="cfg-label" htmlFor="cfg-radio">Radio máximo de servicio</label>
                  <div className="cfg-input-suffix">
                    <input id="cfg-radio" className="cfg-input" type="number" min={1} value={radius} onChange={e => setRadius(e.target.value)} />
                    <span className="cfg-suffix">km</span>
                  </div>
                  <p className="cfg-hint">Los técnicos más lejos que esto desde el domicilio no se recomiendan al cliente.</p>
                </div>
                <div className="cfg-field">
                  <label className="cfg-label" htmlFor="cfg-tiempo">Tiempo para aceptar</label>
                  <div className="cfg-input-suffix">
                    <input id="cfg-tiempo" className="cfg-input" type="number" min={1} value={timeoutVal} onChange={e => setTimeoutVal(e.target.value)} />
                    <span className="cfg-suffix">min</span>
                  </div>
                  <p className="cfg-hint">Tiempo antes de reasignar el servicio a otro técnico.</p>
                </div>
              </div>
              {pie('operacion')}
            </>
          )}

          {seccion === 'identidad' && (
            <>
              <p className="cfg-hint">Todavía no modifican la app: se activarán junto con la verificación de INE y biometría.</p>
              <div className="cfg-row cfg-row--top">
                <div className="cfg-field" style={{ flex: 2 }}>
                  <div className="cfg-slider-header">
                    <label className="cfg-label" htmlFor="cfg-umbral">Umbral de aprobación automática</label>
                    <span className="cfg-slider-val">85%</span>
                  </div>
                  <input id="cfg-umbral" className="cfg-slider" type="range" min={50} max={100} value={85} disabled readOnly
                    style={{ '--fill': '70%' } as React.CSSProperties} />
                  <div className="cfg-slider-ticks"><span>Estricto (50%)</span><span>Flexible (100%)</span></div>
                  <p className="cfg-hint">Las identidades que superen este % de similitud facial se aprueban sin intervención manual.</p>
                </div>
                <div className="cfg-field cfg-toggle-field">
                  <label className="cfg-label" htmlFor="cfg-sep">Validación obligatoria en SEP</label>
                  <label className="cfg-toggle">
                    <input id="cfg-sep" type="checkbox" checked disabled readOnly />
                    <span className="cfg-toggle-track" />
                  </label>
                  <p className="cfg-hint">Rechaza automáticamente a los técnicos cuya Cédula Profesional no exista en el Registro Nacional.</p>
                </div>
              </div>
            </>
          )}

          {seccion === 'sistema' && (
            <div className={`cfg-danger ${maintenance ? 'cfg-danger--on' : ''}`}>
              <div className="cfg-danger-text">
                <p className="cfg-card-title">Modo mantenimiento {maintenance && <span className="cfg-badge-pill cfg-badge-pill--on">Activo</span>}</p>
                <p className="cfg-hint">
                  Al activarlo, la plataforma suspende operaciones: clientes y técnicos ven la pantalla de mantenimiento.
                  Tú sigues entrando al panel para apagarlo.
                </p>
              </div>
              {maintenance ? (
                <button type="button" className="cfg-save-btn" disabled={guardar.isPending} onClick={() => cambiarMantenimiento(false)}>
                  <Power size={14} /> Desactivar mantenimiento
                </button>
              ) : confirmarMantenimiento ? (
                <div className="cfg-confirm" role="alertdialog" aria-label="Confirmar mantenimiento">
                  <p>¿Suspender la plataforma ahora?</p>
                  <button type="button" className="cfg-discard-btn" onClick={() => setConfirmarMantenimiento(false)}>Cancelar</button>
                  <button type="button" className="cfg-danger-btn" disabled={guardar.isPending} onClick={() => cambiarMantenimiento(true)}>Sí, activar</button>
                </div>
              ) : (
                <button type="button" className="cfg-danger-btn" onClick={() => setConfirmarMantenimiento(true)}>
                  <Power size={14} /> Activar mantenimiento
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      <MaintenanceOverlay isActive={maintenance} onDeactivate={() => cambiarMantenimiento(false)} />
    </div>
  )
}
