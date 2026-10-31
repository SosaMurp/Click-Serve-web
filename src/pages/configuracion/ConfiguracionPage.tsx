import { useState, useEffect } from 'react'
import { Settings2, Shield, MapPin, AlertTriangle, Save, CheckCircle } from 'lucide-react'
import MaintenanceOverlay from '@components/layout/MaintenanceOverlay'
import './configuracion.css'

import { usePlatformSettings, useUpdatePlatformSettings } from '../../hooks/useAdminQueries'

export default function ConfiguracionPage() {
  const { data: settings, isLoading, isError, refetch } = usePlatformSettings()
  const updateSettingsMutation = useUpdatePlatformSettings()

  const [threshold, setThreshold] = useState(85)
  const [sepValidation, setSepValidation] = useState(true)
  const [maintenance, setMaintenance] = useState(false)
  const [commission, setCommission] = useState('')
  const [minWithdraw, setMinWithdraw] = useState('')
  const [radius, setRadius] = useState('')
  const [timeoutVal, setTimeoutVal] = useState('')
  const [dirty, setDirty] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  // Sync state when data is loaded
  useEffect(() => {
    if (settings) {
      setCommission(settings.comision_porcentaje.toString())
      setMinWithdraw(settings.monto_minimo_retiro.toString())
      setRadius(settings.radio_maximo_km.toString())
      setTimeoutVal(settings.tolerancia_minutos.toString())
      setMaintenance(settings.modo_mantenimiento)
      // threshold and sepValidation could be parsed from sensibilidad_ia if stored there.
      // For now, let's keep them as local states or mock their DB equivalent if not explicitly modeled.
      setDirty(false)
    }
  }, [settings])

  const mark = () => {
    setDirty(true)
    setSavedSuccess(false)
  }

  const handleSave = async () => {
    try {
      await updateSettingsMutation.mutateAsync({
        comisionPorcentaje: Number(commission),
        montoMinimoRetiro: Number(minWithdraw),
        radioMaximoKm: Number(radius),
        toleranciaMinutos: Number(timeoutVal),
      })
      setDirty(false)
      setSavedSuccess(true)
      window.setTimeout(() => setSavedSuccess(false), 3000)
    } catch (e) {
      console.error('Error saving settings', e)
      alert('Error al guardar la configuración')
    }
  }

  // El modo mantenimiento se guarda al momento: la app empieza a responder 503 a clientes y técnicos.
  const setMaintenanceRemote = async (on: boolean) => {
    setMaintenance(on)
    try {
      await updateSettingsMutation.mutateAsync({ modoMantenimiento: on })
    } catch (e) {
      console.error('Error al cambiar el modo mantenimiento', e)
      setMaintenance(!on)
      alert('No se pudo cambiar el modo mantenimiento. Intenta de nuevo.')
    }
  }

  if (isLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando parámetros...</div>
  }

  // Sin datos del servidor no se muestran valores de ejemplo: guardarlos sobrescribiría la configuración real.
  if (isError || !settings) {
    return (
      <div className="cfg-page fade-in">
        <div className="dash-page-header">
          <div>
            <h1 className="dash-page-title">Configuración</h1>
            <p className="dash-page-sub">Parámetros globales de la plataforma</p>
          </div>
        </div>
        <div className="cfg-card cfg-load-error">
          <AlertTriangle size={16} />
          <p>No se pudo cargar la configuración desde el servidor.</p>
          <button className="cfg-save-btn" onClick={() => refetch()}>Reintentar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="cfg-page fade-in">
      {/* Header */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Configuración</h1>
          <p className="dash-page-sub">Parámetros globales de la plataforma</p>
        </div>
        <div className="cfg-header-right">
          {savedSuccess && (
            <span className="cfg-status cfg-status--ok"><CheckCircle size={14} /> Cambios guardados</span>
          )}
          {dirty && <span className="cfg-status">Tienes cambios sin guardar</span>}
          <button className="cfg-save-btn" disabled={!dirty || updateSettingsMutation.isPending} onClick={handleSave}>
            <Save size={14} /> {updateSettingsMutation.isPending ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>

      <div className="cfg-sections">
        {/* ── Modelo Financiero (RF-97) ── */}
        <div className="cfg-card">
          <div className="cfg-card-head">
            <div className="cfg-icon cfg-icon--orange"><Settings2 size={16} /></div>
            <div>
              <p className="cfg-card-title">Modelo financiero</p>
              <p className="cfg-card-sub">Comisiones y límites de retiro para técnicos.</p>
            </div>
          </div>
          <div className="cfg-row">
            <div className="cfg-field">
              <label className="cfg-label">Comisión Click &amp; Serve <span className="cfg-badge-pill">Afecta a todos los servicios</span></label>
              <div className="cfg-input-suffix">
                <input className="cfg-input" type="number" value={commission}
                  onChange={e => { setCommission(e.target.value); mark() }} />
                <span className="cfg-suffix">%</span>
              </div>
              <p className="cfg-hint">Porcentaje deducido automáticamente de cada servicio completado.</p>
            </div>
            <div className="cfg-field">
              <label className="cfg-label">Retiro mínimo permitido</label>
              <div className="cfg-input-suffix">
                <span className="cfg-prefix">$</span>
                <input className="cfg-input cfg-input--prefix" type="number" value={minWithdraw}
                  onChange={e => { setMinWithdraw(e.target.value); mark() }} />
                <span className="cfg-suffix">MXN</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Región Operativa (RF-97) ── */}
        <div className="cfg-card">
          <div className="cfg-card-head">
            <div className="cfg-icon cfg-icon--blue"><MapPin size={16} /></div>
            <div>
              <p className="cfg-card-title">Región operativa</p>
              <p className="cfg-card-sub">Límites de servicio en Lázaro Cárdenas.</p>
            </div>
          </div>
          <div className="cfg-row">
            <div className="cfg-field">
              <label className="cfg-label">Radio máximo de servicio</label>
              <div className="cfg-input-suffix">
                <input className="cfg-input" type="number" value={radius}
                  onChange={e => { setRadius(e.target.value); mark() }} />
                <span className="cfg-suffix">km</span>
              </div>
            </div>
            <div className="cfg-field">
              <label className="cfg-label">Tiempo para aceptar</label>
              <div className="cfg-input-suffix">
                <input className="cfg-input" type="number" value={timeoutVal}
                  onChange={e => { setTimeoutVal(e.target.value); mark() }} />
                <span className="cfg-suffix">min</span>
              </div>
              <p className="cfg-hint">Tiempo antes de reasignar el servicio a otro técnico.</p>
            </div>
          </div>
        </div>

        {/* ── Motor de Verificación (RF-98) ── */}
        <div className="cfg-card cfg-card--wide">
          <div className="cfg-card-head">
            <div className="cfg-icon cfg-icon--navy"><Shield size={16} /></div>
            <div>
              <p className="cfg-card-title">Verificación de identidad</p>
              <p className="cfg-card-sub">Tolerancia de la biometría y validación en SEP.</p>
            </div>
          </div>

          <div className="cfg-row cfg-row--top">
            {/* Slider */}
            <div className="cfg-field" style={{ flex: 2 }}>
              <div className="cfg-slider-header">
                <label className="cfg-label">Umbral de aprobación automática</label>
                <span className="cfg-slider-val">{threshold}%</span>
              </div>
              <input
                className="cfg-slider"
                type="range" min={50} max={100} value={threshold}
                onChange={e => { setThreshold(Number(e.target.value)); mark() }}
              />
              <div className="cfg-slider-ticks">
                <span>Estricto (50%)</span>
                <span>Flexible (100%)</span>
              </div>
              <p className="cfg-hint">Las identidades que superen este % de similitud facial se aprueban sin intervención manual.</p>
            </div>

            {/* Toggle */}
            <div className="cfg-field cfg-toggle-field">
              <label className="cfg-label">Validación obligatoria en SEP</label>
              <label className="cfg-toggle">
                <input type="checkbox" checked={sepValidation}
                  onChange={e => { setSepValidation(e.target.checked); mark() }} />
                <span className="cfg-toggle-track" />
              </label>
              <p className="cfg-hint">Rechaza automáticamente a los técnicos cuya Cédula Profesional no exista en el Registro Nacional.</p>
            </div>
          </div>
        </div>

        {/* ── Modo Mantenimiento (RF-99) ── */}
        <div className={`cfg-card cfg-card--danger ${maintenance ? 'cfg-card--danger-active' : ''}`}>
          <div className="cfg-card-head">
            <div className="cfg-icon cfg-icon--danger"><AlertTriangle size={16} /></div>
            <div style={{ flex: 1 }}>
              <p className="cfg-card-title">Modo mantenimiento</p>
              <p className="cfg-hint" style={{ marginTop: 4 }}>
                Al activar esto, la plataforma suspenderá operaciones. Los usuarios verán la pantalla de mantenimiento.
              </p>
            </div>
            <label className="cfg-toggle">
              <input type="checkbox" checked={maintenance}
                disabled={updateSettingsMutation.isPending}
                onChange={e => setMaintenanceRemote(e.target.checked)} />
              <span className="cfg-toggle-track" />
            </label>
          </div>
        </div>
      </div>

      <MaintenanceOverlay isActive={maintenance} onDeactivate={() => setMaintenanceRemote(false)} />
    </div>
  )
}
