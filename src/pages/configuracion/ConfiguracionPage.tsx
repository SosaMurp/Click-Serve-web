import { useState, useEffect } from 'react'
import { Settings2, Shield, MapPin, AlertTriangle, Save, RotateCcw, CheckCircle } from 'lucide-react'
import MaintenanceOverlay from '@components/layout/MaintenanceOverlay'
import './configuracion.css'

import { usePlatformSettings, useUpdatePlatformSettings } from '../../hooks/useAdminQueries'

export default function ConfiguracionPage() {
  const { data: settings, isLoading } = usePlatformSettings()
  const updateSettingsMutation = useUpdatePlatformSettings()

  const [threshold, setThreshold] = useState(85)
  const [sepValidation, setSepValidation] = useState(true)
  const [maintenance, setMaintenance] = useState(false)
  const [commission, setCommission] = useState('15')
  const [minWithdraw, setMinWithdraw] = useState('500')
  const [radius, setRadius] = useState('15')
  const [timeoutVal, setTimeoutVal] = useState('5')
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
        // other fields if supported by your API
      })
      setDirty(false)
      setSavedSuccess(true)
      window.setTimeout(() => setSavedSuccess(false), 3000)
    } catch (e) {
      console.error('Error saving settings', e)
      alert('Error al guardar la configuración')
    }
  }

  if (isLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando parámetros...</div>
  }

  return (
    <div className="cfg-page fade-in">
      {/* Header */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Parámetros del Sistema (RF-84 A RF-99)</h1>
          <p className="dash-page-sub">NIVEL SUPERADMINISTRADOR</p>
        </div>
        <div className="cfg-header-right">
          {savedSuccess && (
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-dim)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle size={14} /> Cambios guardados en BD (RF-85)
            </span>
          )}
          <span className="cfg-last-save">
            <RotateCcw size={11} /> Último cambio: hoy, 14:04
          </span>
          <button className="cfg-save-btn" disabled={!dirty} onClick={handleSave}>
            <Save size={13} /> GUARDAR CAMBIOS (RF-85)
          </button>
        </div>
      </div>

      <div className="cfg-sections">
        {/* ── Modelo Financiero (RF-97) ── */}
        <div className="cfg-card">
          <div className="cfg-card-head">
            <div className="cfg-icon cfg-icon--blue"><Settings2 size={16} /></div>
            <div>
              <p className="cfg-card-title">MODELO FINANCIERO (RF-97)</p>
              <p className="cfg-card-sub">Comisiones y límites de retiro para técnicos.</p>
            </div>
          </div>
          <div className="cfg-row">
            <div className="cfg-field">
              <label className="cfg-label">COMISIÓN CLICK&amp;SERVE <span className="cfg-badge-pill">IMPACTO GLOBAL</span></label>
              <div className="cfg-input-suffix">
                <input className="cfg-input" type="number" value={commission}
                  onChange={e => { setCommission(e.target.value); mark() }} />
                <span className="cfg-suffix">%</span>
              </div>
              <p className="cfg-hint">Porcentaje deducido automáticamente de cada servicio completado.</p>
            </div>
            <div className="cfg-field">
              <label className="cfg-label">RETIRO MÍNIMO PERMITIDO</label>
              <div className="cfg-input-suffix">
                <span className="cfg-prefix">$</span>
                <input className="cfg-input cfg-input--prefix" type="number" value={minWithdraw}
                  onChange={e => { setMinWithdraw(e.target.value); mark() }} />
                <span className="cfg-suffix">MXN</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Motor de Verificación (RF-98) ── */}
        <div className="cfg-card">
          <div className="cfg-card-head">
            <div className="cfg-icon cfg-icon--purple"><Shield size={16} /></div>
            <div>
              <p className="cfg-card-title">MOTOR DE VERIFICACIÓN AI & SEP (RF-98)</p>
              <p className="cfg-card-sub">Parámetros de tolerancia para biometría y scraping.</p>
            </div>
          </div>

          <div className="cfg-row cfg-row--top">
            {/* Slider */}
            <div className="cfg-field" style={{ flex: 2 }}>
              <div className="cfg-slider-header">
                <label className="cfg-label">UMBRAL APROBACIÓN AUTOMÁTICA (OPENCV)</label>
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
              <label className="cfg-label">VALIDACIÓN FORZOSA EN SEP</label>
              <label className="cfg-toggle">
                <input type="checkbox" checked={sepValidation}
                  onChange={e => { setSepValidation(e.target.checked); mark() }} />
                <span className="cfg-toggle-track" />
              </label>
              <p className="cfg-hint">Rechaza automáticamente a los técnicos cuya Cédula Profesional no exista en el Registro Nacional.</p>
            </div>
          </div>
        </div>

        {/* ── Región Operativa (RF-97) ── */}
        <div className="cfg-card">
          <div className="cfg-card-head">
            <div className="cfg-icon cfg-icon--teal"><MapPin size={16} /></div>
            <div>
              <p className="cfg-card-title">REGIÓN OPERATIVA (RF-97)</p>
              <p className="cfg-card-sub">Límites de servicio para el nodo Lázaro Cárdenas.</p>
            </div>
          </div>
          <div className="cfg-row">
            <div className="cfg-field">
              <label className="cfg-label">RADIO MÁXIMO DE SERVICIO</label>
              <div className="cfg-input-suffix">
                <input className="cfg-input" type="number" value={radius}
                  onChange={e => { setRadius(e.target.value); mark() }} />
                <span className="cfg-suffix">Kilómetros</span>
              </div>
            </div>
            <div className="cfg-field">
              <label className="cfg-label">TIMEOUT DE ACEPTACIÓN</label>
              <div className="cfg-input-suffix">
                <input className="cfg-input" type="number" value={timeoutVal}
                  onChange={e => { setTimeoutVal(e.target.value); mark() }} />
                <span className="cfg-suffix">Minutos</span>
              </div>
              <p className="cfg-hint">Tiempo antes de reasignar el servicio a otro técnico.</p>
            </div>
          </div>
        </div>

        {/* ── Modo Mantenimiento (RF-99) ── */}
        <div className={`cfg-card cfg-card--danger ${maintenance ? 'cfg-card--danger-active' : ''}`}>
          <div className="cfg-card-head">
            <div className="cfg-icon cfg-icon--danger"><AlertTriangle size={16} /></div>
            <div style={{ flex: 1 }}>
              <p className="cfg-card-title">MODO DE MANTENIMIENTO DE CONTINGENCIA (RF-99)</p>
              <p className="cfg-hint" style={{ marginTop: 4 }}>
                Al activar esto, la plataforma suspenderá operaciones. Los usuarios verán la pantalla de mantenimiento.
              </p>
            </div>
            <label className="cfg-toggle">
              <input type="checkbox" checked={maintenance}
                onChange={e => { setMaintenance(e.target.checked); mark() }} />
              <span className="cfg-toggle-track" />
            </label>
          </div>
        </div>
      </div>

      <MaintenanceOverlay isActive={maintenance} onDeactivate={() => setMaintenance(false)} />
    </div>
  )
}
