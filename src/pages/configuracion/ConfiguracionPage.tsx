import { useState } from 'react'
import { Settings2, Shield, MapPin, AlertTriangle, Save, RotateCcw } from 'lucide-react'
import './configuracion.css'

export default function ConfiguracionPage() {
  const [threshold, setThreshold] = useState(85)
  const [sepValidation, setSepValidation] = useState(true)
  const [maintenance, setMaintenance] = useState(false)
  const [commission, setCommission] = useState('15')
  const [minWithdraw, setMinWithdraw] = useState('500')
  const [radius, setRadius] = useState('15')
  const [timeout, setTimeout] = useState('5')
  const [dirty, setDirty] = useState(false)

  const mark = () => setDirty(true)

  return (
    <div className="cfg-page fade-in">
      {/* Header */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Parámetros del Sistema</h1>
          <p className="dash-page-sub">NIVEL SUPERADMINISTRADOR</p>
        </div>
        <div className="cfg-header-right">
          <span className="cfg-last-save">
            <RotateCcw size={11} /> Último cambio: hoy, 14:04
          </span>
          <button className="cfg-save-btn" disabled={!dirty} onClick={() => setDirty(false)}>
            <Save size={13} /> GUARDAR CAMBIOS
          </button>
        </div>
      </div>

      <div className="cfg-sections">
        {/* ── Modelo Financiero ── */}
        <div className="cfg-card">
          <div className="cfg-card-head">
            <div className="cfg-icon cfg-icon--blue"><Settings2 size={16} /></div>
            <div>
              <p className="cfg-card-title">MODELO FINANCIERO</p>
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

        {/* ── Motor de Verificación ── */}
        <div className="cfg-card">
          <div className="cfg-card-head">
            <div className="cfg-icon cfg-icon--purple"><Shield size={16} /></div>
            <div>
              <p className="cfg-card-title">MOTOR DE VERIFICACIÓN (AI)</p>
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
              <p className="cfg-hint">Rechaza automáticamente a los técnicos cuya Cédula Profesional no exista o no coincida con el web scraping del Registro Nacional.</p>
            </div>
          </div>
        </div>

        {/* ── Región Operativa ── */}
        <div className="cfg-card">
          <div className="cfg-card-head">
            <div className="cfg-icon cfg-icon--teal"><MapPin size={16} /></div>
            <div>
              <p className="cfg-card-title">REGIÓN OPERATIVA</p>
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
                <input className="cfg-input" type="number" value={timeout}
                  onChange={e => { setTimeout(e.target.value); mark() }} />
                <span className="cfg-suffix">Minutos</span>
              </div>
              <p className="cfg-hint">Tiempo antes de reasignar el servicio a otro técnico.</p>
            </div>
          </div>
        </div>

        {/* ── Modo Mantenimiento ── */}
        <div className={`cfg-card cfg-card--danger ${maintenance ? 'cfg-card--danger-active' : ''}`}>
          <div className="cfg-card-head">
            <div className="cfg-icon cfg-icon--danger"><AlertTriangle size={16} /></div>
            <div style={{ flex: 1 }}>
              <p className="cfg-card-title">MODO DE MANTENIMIENTO</p>
              <p className="cfg-hint" style={{ marginTop: 4 }}>
                Al activar esto, la app mostrará una pantalla de "Mantenimiento" a todos los técnicos y clientes. Las sesiones activas se cerrarán.
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
    </div>
  )
}
