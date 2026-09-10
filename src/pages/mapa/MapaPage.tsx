import { SlidersHorizontal } from 'lucide-react'
import './mapa.css'

const NODES = [
  { id: 1, label: 'CENTRO',          x: 58, y: 45, color: 'green',  size: 10 },
  { id: 2, label: 'LAS ADELITAS',    x: 28, y: 62, color: 'dark',   size: 8  },
  { id: 3, label: 'ZONA INDUSTRIAL', x: 60, y: 80, color: 'red',    size: 10 },
  { id: 4, label: 'FIDEICOMISO',     x: 78, y: 72, color: 'muted',  size: 6  },
  { id: 5, label: 'GUACAMAYAS',      x: 30, y: 25, color: 'muted',  size: 6  },
]

const LOG = [
  { time: '13:05', type: 'ALERTA', typeColor: 'danger', text: 'El técnico #TEC-4122 reporta tráfico pesado rumbo a Zona Industrial. ETA modificado a +15 mins.' },
  { time: '13:21', type: 'INFO',   typeColor: 'info',   text: 'Servicio #SRV-182 iniciado por Roberto G. en Las Adelitas.' },
  { time: '12:40', type: 'ÉXITO',  typeColor: 'success',text: 'Servicio de Redes finalizado en Centro. Pago procesado correctamente.' },
]

export default function MapaPage() {
  return (
    <div className="mapa-page fade-in">
      {/* Header row */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Telemetría de Red</h1>
          <p className="dash-page-sub">LÁZARO CÁRDENAS, MICHOACÁN</p>
        </div>
        <div className="mapa-date">
          <span className="mapa-dot" />
          30 FEB 2026 • 11:20 AM
        </div>
      </div>

      <div className="mapa-layout">
        {/* Map canvas */}
        <div className="mapa-canvas">
          {/* Zoom controls */}
          <div className="mapa-zoom">
            <button>+</button>
            <button>−</button>
          </div>

          {/* SVG background grid */}
          <svg className="mapa-grid" width="100%" height="100%">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,0,0,.06)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Nodes */}
          {NODES.map(n => (
            <div key={n.id} className={`mapa-node mapa-node--${n.color}`}
              style={{ left: `${n.x}%`, top: `${n.y}%` }}>
              <span className="mapa-node-dot" style={{ width: n.size, height: n.size }} />
              <span className="mapa-node-label">{n.label}</span>
            </div>
          ))}
        </div>

        {/* Right panel */}
        <div className="mapa-panel">
          {/* Status */}
          <div className="mapa-status-grid">
            <div className="mapa-stat">
              <p className="mapa-stat-label">EN LÍNEA</p>
              <p className="mapa-stat-value">42</p>
            </div>
            <div className="mapa-stat">
              <p className="mapa-stat-label">OCUPADOS</p>
              <p className="mapa-stat-value">18</p>
            </div>
          </div>

          {/* Live log */}
          <div className="mapa-log-header">
            <p className="mapa-log-title">BITÁCORA EN VIVO</p>
            <span className="mapa-live-dot" />
          </div>

          <div className="mapa-log">
            {LOG.map((entry, i) => (
              <div key={i} className="mapa-log-entry">
                <p className="mapa-log-meta">
                  {entry.time}
                  <span className={`mapa-log-type mapa-log-type--${entry.typeColor}`}>{entry.type}</span>
                </p>
                <p className="mapa-log-text">{entry.text}</p>
              </div>
            ))}
          </div>

          {/* Filter btn */}
          <button className="mapa-filter-btn">
            <SlidersHorizontal size={13} />
            FILTROS AVANZADOS
          </button>
        </div>
      </div>
    </div>
  )
}
