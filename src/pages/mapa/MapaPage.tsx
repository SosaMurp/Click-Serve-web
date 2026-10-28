import { useState, useRef, useEffect } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import {
  SlidersHorizontal,
  MapPin,
  RotateCcw,
  ExternalLink,
  Navigation,
  Clock,
  User,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import ServiceDetailModal from '@components/modals/ServiceDetailModal'
import AdvancedFiltersModal from '@components/modals/AdvancedFiltersModal'
import 'leaflet/dist/leaflet.css'
import './mapa.css'

interface TelemetriaNode {
  id: number
  label: string
  lat: number
  lng: number
  status: 'online' | 'busy' | 'alert'
  color: string
  serviceId: string
  techName: string
  clientName: string
  serviceTitle: string
  address: string
  eta: string
}

// ── Coordenadas Reales de Lázaro Cárdenas, Michoacán ─────────────────────────
const LZC_CENTER: [number, number] = [17.9750, -102.2050]
const DEFAULT_ZOOM = 13

const NODES: TelemetriaNode[] = [
  {
    id: 1,
    label: 'CENTRO',
    lat: 17.9593,
    lng: -102.2006,
    status: 'online',
    color: '#E8590C',
    serviceId: 'SRV-108',
    techName: 'Roberto García',
    clientName: 'José López',
    serviceTitle: 'Soporte e Instalación de Redes',
    address: 'Av. Lázaro Cárdenas #120, Col. Centro',
    eta: 'En sitio',
  },
  {
    id: 2,
    label: 'LAS ADELITAS',
    lat: 17.9715,
    lng: -102.2105,
    status: 'busy',
    color: '#3b82f6',
    serviceId: 'SRV-182',
    techName: 'Ana Martínez',
    clientName: 'Comercializadora Pacífico',
    serviceTitle: 'Mantenimiento Preventivo Servidores',
    address: 'Blvd. Francisco J. Mújica #45, Las Adelitas',
    eta: '10 min',
  },
  {
    id: 3,
    label: 'ZONA INDUSTRIAL',
    lat: 17.9420,
    lng: -102.1950,
    status: 'alert',
    color: '#ef4444',
    serviceId: 'SRV-901',
    techName: 'Carlos Villalobos',
    clientName: 'Almacenes Portuarios LZC',
    serviceTitle: 'Reparación de Enlace Troncal',
    address: 'Isla de la Palma S/N, Parque Industrial',
    eta: '+25 min (Tráfico)',
  },
  {
    id: 4,
    label: 'FIDEICOMISO',
    lat: 17.9620,
    lng: -102.1860,
    status: 'online',
    color: '#E8590C',
    serviceId: 'SRV-404',
    techName: 'Luis Mendoza',
    clientName: 'Residencial Fideicomiso',
    serviceTitle: 'Cableado Estructurado UTP',
    address: 'Calle Río Balsas #310, Fideicomiso',
    eta: 'En sitio',
  },
  {
    id: 5,
    label: 'GUACAMAYAS',
    lat: 18.0125,
    lng: -102.2198,
    status: 'busy',
    color: '#3b82f6',
    serviceId: 'SRV-399',
    techName: 'Mario Paredes',
    clientName: 'Gabriel Solís',
    serviceTitle: 'Configuración Router MikroTik',
    address: 'Av. Circunvalación #88, Guacamayas',
    eta: '15 min',
  },
]

const LOG = [
  {
    time: '13:05',
    type: 'ALERTA',
    typeColor: 'danger',
    text: 'El técnico #TEC-4122 reporta tráfico pesado rumbo a Zona Industrial. ETA modificado a +15 mins.',
    serviceId: 'SRV-901',
  },
  {
    time: '13:21',
    type: 'INFO',
    typeColor: 'info',
    text: 'Servicio #SRV-182 iniciado por Roberto G. en Las Adelitas.',
    serviceId: 'SRV-182',
  },
  {
    time: '12:40',
    type: 'ÉXITO',
    typeColor: 'success',
    text: 'Servicio de Redes finalizado en Centro. Pago procesado correctamente.',
    serviceId: 'SRV-108',
  },
]

// ── Marcador personalizado HTML con Leaflet DivIcon ──────────────────────────
function createNodeDivIcon(node: TelemetriaNode, isSelected: boolean) {
  return L.divIcon({
    className: 'mapa-custom-leaflet-marker',
    html: `
      <div class="mapa-pin-wrapper ${isSelected ? 'mapa-pin-wrapper--selected' : ''}" style="--marker-color: ${node.color}">
        <div class="mapa-pulse-ring" style="background-color: ${node.color};"></div>
        <div class="mapa-pin-badge" style="background-color: ${node.color};">
          <span class="mapa-pin-code">#${node.serviceId.replace('SRV-', '')}</span>
        </div>
        <div class="mapa-pin-label">${node.label}</div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -20],
  })
}

// ── Controlador imperativo de cámara Leaflet ─────────────────────────────────
function MapFlightController({
  target,
  zoom,
}: {
  target: [number, number] | null
  zoom?: number
}) {
  const map = useMap()
  useEffect(() => {
    if (target) {
      map.flyTo(target, zoom ?? 15, { duration: 1.2 })
    }
  }, [target, zoom, map])
  return null
}

export default function MapaPage() {
  const [selectedNode, setSelectedNode] = useState<TelemetriaNode | null>(null)
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null)
  const [flyZoom, setFlyZoom] = useState<number | undefined>(undefined)
  const [isServiceOpen, setIsServiceOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const handleSelectNode = (node: TelemetriaNode) => {
    setSelectedNode(node)
    setFlyTarget([node.lat, node.lng])
    setFlyZoom(15)
  }

  const handleOpenModalForNode = (node: TelemetriaNode) => {
    setSelectedNode(node)
    setIsServiceOpen(true)
  }

  const handleRecenter = () => {
    setFlyTarget(LZC_CENTER)
    setFlyZoom(DEFAULT_ZOOM)
  }

  return (
    <div className="mapa-page fade-in">
      {/* Header row */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Telemetría de Red en Vivo</h1>
          <p className="dash-page-sub">
            MONITOREO GEOGRÁFICO DE SERVICIOS • NODO LÁZARO CÁRDENAS, MICHOACÁN
          </p>
        </div>
        <div className="mapa-date">
          <span className="mapa-dot" />
          NODO ACTIVO • LÁZARO CÁRDENAS
        </div>
      </div>

      <div className="mapa-layout">
        {/* Real Leaflet Map Canvas */}
        <div className="mapa-canvas">
          {/* Herramientas flotantes */}
          <div className="mapa-map-overlay-tools">
            <button
              type="button"
              className="mapa-recenter-btn"
              onClick={handleRecenter}
              title="Centrar mapa en Lázaro Cárdenas"
            >
              <RotateCcw size={13} /> Centrar LZC
            </button>
          </div>

          <div className="mapa-badge-city">
            <MapPin size={12} color="#E8590C" />
            <span>Lázaro Cárdenas, Michoacán (Nodo Operativo)</span>
          </div>

          <MapContainer
            center={LZC_CENTER}
            zoom={DEFAULT_ZOOM}
            scrollWheelZoom={true}
            style={{ width: '100%', height: '100%' }}
          >
            {/* Tiles OpenStreetMap limpios y de alta velocidad */}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={18}
            />

            <MapFlightController target={flyTarget} zoom={flyZoom} />

            {/* Marcadores reales de la ciudad */}
            {NODES.map((node) => {
              const isSelected = selectedNode?.id === node.id
              return (
                <Marker
                  key={node.id}
                  position={[node.lat, node.lng]}
                  icon={createNodeDivIcon(node, isSelected)}
                  eventHandlers={{
                    click: () => handleSelectNode(node),
                  }}
                >
                  <Popup>
                    <div className="mapa-popup-card">
                      <div className="mapa-popup-header">
                        <span
                          className="mapa-popup-tag"
                          style={{
                            backgroundColor: `${node.color}1a`,
                            color: node.color,
                          }}
                        >
                          {node.label}
                        </span>
                        <strong style={{ fontSize: 11, color: '#64748b' }}>
                          #{node.serviceId}
                        </strong>
                      </div>

                      <h4 className="mapa-popup-title">{node.serviceTitle}</h4>
                      <p className="mapa-popup-sub">{node.address}</p>

                      <div className="mapa-popup-detail">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <User size={12} color="#0284c7" />
                          <span>Técnico: <strong>{node.techName}</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={12} color="#0284c7" />
                          <span>ETA: <strong>{node.eta}</strong></span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="mapa-popup-btn"
                        onClick={() => handleOpenModalForNode(node)}
                      >
                        <ExternalLink size={12} /> Ver Expediente del Servicio
                      </button>
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>
        </div>

        {/* Right panel */}
        <div className="mapa-panel">
          {/* Status */}
          <div className="mapa-status-grid">
            <div className="mapa-stat">
              <p className="mapa-stat-label">EN LÍNEA</p>
              <p className="mapa-stat-value" style={{ color: 'var(--accent)' }}>42</p>
            </div>
            <div className="mapa-stat">
              <p className="mapa-stat-label">OCUPADOS</p>
              <p className="mapa-stat-value" style={{ color: '#3b82f6' }}>18</p>
            </div>
          </div>

          {/* Live log */}
          <div className="mapa-log-header">
            <p className="mapa-log-title">BITÁCORA EN VIVO</p>
            <span className="mapa-live-dot" />
          </div>

          <div className="mapa-log">
            {LOG.map((entry, i) => {
              const matchedNode = NODES.find((n) => n.serviceId === entry.serviceId) || NODES[0]
              const isSelected = selectedNode?.serviceId === entry.serviceId

              return (
                <div
                  key={i}
                  className={`mapa-log-entry ${isSelected ? 'mapa-log-entry--active' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleSelectNode(matchedNode)}
                >
                  <div className="mapa-log-meta">
                    <span>{entry.time}</span>
                    <span className={`mapa-log-type mapa-log-type--${entry.typeColor}`}>
                      {entry.type}
                    </span>
                  </div>
                  <p className="mapa-log-text">{entry.text}</p>
                </div>
              )
            })}
          </div>

          {/* Filter btn */}
          <button
            type="button"
            className="mapa-filter-btn"
            onClick={() => setIsFilterOpen(true)}
          >
            <SlidersHorizontal size={13} />
            FILTROS AVANZADOS (RF-39)
          </button>
        </div>
      </div>

      {/* Modals */}
      {selectedNode && (
        <ServiceDetailModal
          isOpen={isServiceOpen}
          onClose={() => setIsServiceOpen(false)}
          serviceId={selectedNode.serviceId}
          title={selectedNode.serviceTitle}
          techName={selectedNode.techName}
          clientName={selectedNode.clientName}
          status={selectedNode.status === 'online' ? 'Finalizado' : selectedNode.status === 'alert' ? 'Cancelado' : 'En Progreso'}
        />
      )}

      <AdvancedFiltersModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
      />
    </div>
  )
}
