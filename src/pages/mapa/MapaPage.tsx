import { useState, useEffect, useMemo } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import { MapPin, RotateCcw, ExternalLink, AlertTriangle } from 'lucide-react'
import ServiceDetailModal from '@components/modals/ServiceDetailModal'
import { useServiciosUbicados } from '@hooks/useServicios'
import { useActividad, useDashboardStats } from '@hooks/useDashboard'
import { getServicioById, type ServicioUbicado } from '@api/servicios'
import type { RecentService } from '@/types/dashboard'
import 'leaflet/dist/leaflet.css'
import './mapa.css'

// ── Coordenadas Reales de Lázaro Cárdenas, Michoacán ─────────────────────────
const LZC_CENTER: [number, number] = [17.9750, -102.2050]
const DEFAULT_ZOOM = 13

interface ServicioNodo {
  id: number
  codigo: string
  lat: number
  lng: number
  color: string
  titulo: string
  direccion: string
  estatus: string
}

// Colores de estado de la paleta compartida con la app móvil
function colorPorEstatus(estatus: string) {
  const e = estatus.toLowerCase()
  if (e.includes('cancel')) return '#D92D20'
  if (e.includes('complet') || e.includes('finaliz')) return '#0E7A42'
  if (e.includes('curso') || e.includes('progreso') || e.includes('camino')) return '#E25900'
  return '#0C1C40'
}

const codigo = (id: number) => `SRV-${String(id).padStart(3, '0')}`

function toNodo(s: ServicioUbicado): ServicioNodo | null {
  const lat = Number(s.latitud)
  const lng = Number(s.longitud)
  if (s.latitud == null || s.longitud == null || Number.isNaN(lat) || Number.isNaN(lng)) return null
  return {
    id: s.id_servicio,
    codigo: codigo(s.id_servicio),
    lat,
    lng,
    color: colorPorEstatus(s.estatus),
    titulo: s.titulo || 'Servicio sin título',
    direccion: s.direccion || 'Sin dirección registrada',
    estatus: s.estatus,
  }
}

// ── Marcador personalizado HTML con Leaflet DivIcon ──────────────────────────
function createNodeDivIcon(node: ServicioNodo, isSelected: boolean) {
  return L.divIcon({
    className: 'mapa-custom-leaflet-marker',
    html: `
      <div class="mapa-pin-wrapper ${isSelected ? 'mapa-pin-wrapper--selected' : ''}" style="--marker-color: ${node.color}">
        <div class="mapa-pulse-ring" style="background-color: ${node.color};"></div>
        <div class="mapa-pin-badge" style="background-color: ${node.color};">
          <span class="mapa-pin-code">#${node.id}</span>
        </div>
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

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

export default function MapaPage() {
  const servicios = useServiciosUbicados()
  const stats = useDashboardStats()
  const actividad = useActividad()

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null)
  const [flyZoom, setFlyZoom] = useState<number | undefined>(undefined)
  const [detalle, setDetalle] = useState<RecentService | null>(null)
  const [detalleError, setDetalleError] = useState('')

  const nodos = useMemo(
    () => (servicios.data ?? []).map(toNodo).filter((n): n is ServicioNodo => n !== null),
    [servicios.data],
  )

  const handleSelectNode = (node: ServicioNodo) => {
    setSelectedId(node.id)
    setFlyTarget([node.lat, node.lng])
    setFlyZoom(15)
  }

  const handleOpenDetail = async (id: number) => {
    setDetalleError('')
    try {
      setDetalle(await getServicioById(id))
    } catch {
      setDetalleError(`No se pudo abrir ${codigo(id)}`)
    }
  }

  const handleRecenter = () => {
    setFlyTarget(LZC_CENTER)
    setFlyZoom(DEFAULT_ZOOM)
  }

  const statValue = (v: number | undefined) => (stats.isError || v === undefined ? '—' : v)

  return (
    <div className="mapa-page fade-in">
      {/* Header row */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Mapa en vivo</h1>
          <p className="dash-page-sub">Servicios con ubicación en Lázaro Cárdenas, Michoacán</p>
        </div>
        <div className="mapa-date">
          <span className="mapa-dot" />
          {servicios.isError ? 'SIN CONEXIÓN CON EL SERVIDOR' : `${nodos.length} SERVICIOS EN EL MAPA`}
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
            <MapPin size={12} color="#E25900" />
            <span>Lázaro Cárdenas, Michoacán</span>
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

            {nodos.map((node) => (
              <Marker
                key={node.id}
                position={[node.lat, node.lng]}
                icon={createNodeDivIcon(node, selectedId === node.id)}
                eventHandlers={{ click: () => handleSelectNode(node) }}
              >
                <Popup>
                  <div className="mapa-popup-card">
                    <div className="mapa-popup-header">
                      <span
                        className="mapa-popup-tag"
                        style={{ backgroundColor: `${node.color}1a`, color: node.color }}
                      >
                        {node.estatus}
                      </span>
                      <strong style={{ fontSize: 11, color: '#667085' }}>{node.codigo}</strong>
                    </div>

                    <h4 className="mapa-popup-title">{node.titulo}</h4>
                    <p className="mapa-popup-sub">{node.direccion}</p>

                    <button
                      type="button"
                      className="mapa-popup-btn"
                      onClick={() => handleOpenDetail(node.id)}
                    >
                      <ExternalLink size={12} /> Ver detalle del servicio
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Right panel */}
        <div className="mapa-panel">
          <div className="mapa-status-grid">
            <div className="mapa-stat">
              <p className="mapa-stat-label">TÉCNICOS EN LÍNEA</p>
              <p className="mapa-stat-value" style={{ color: 'var(--accent)' }}>{statValue(stats.data?.tecnicos_online)}</p>
            </div>
            <div className="mapa-stat">
              <p className="mapa-stat-label">SERVICIOS EN CURSO</p>
              <p className="mapa-stat-value" style={{ color: '#0C1C40' }}>{statValue(stats.data?.servicios_en_curso)}</p>
            </div>
          </div>

          {detalleError && (
            <p className="mapa-log-text" style={{ color: 'var(--danger-ink)' }}>{detalleError}</p>
          )}

          {/* Actividad real del sistema */}
          <div className="mapa-log-header">
            <p className="mapa-log-title">ACTIVIDAD RECIENTE</p>
            <span className="mapa-live-dot" />
          </div>

          <div className="mapa-log">
            {actividad.isError && (
              <p className="mapa-log-text"><AlertTriangle size={12} /> Sin conexión con el registro de actividad.</p>
            )}
            {!actividad.isError && (actividad.data?.items ?? []).length === 0 && !actividad.isLoading && (
              <p className="mapa-log-text">Todavía no hay actividad registrada.</p>
            )}
            {(actividad.data?.items ?? []).map((entry) => {
              const nodo = entry.tipo === 'servicio' ? nodos.find((n) => n.id === entry.id) : undefined
              return (
                <div
                  key={`${entry.tipo}-${entry.id}`}
                  className={`mapa-log-entry ${nodo && selectedId === nodo.id ? 'mapa-log-entry--active' : ''}`}
                  style={{ cursor: nodo ? 'pointer' : 'default' }}
                  onClick={() => nodo && handleSelectNode(nodo)}
                >
                  <div className="mapa-log-meta">
                    <span>{hora(entry.creado_en)}</span>
                    <span className={`mapa-log-type mapa-log-type--${entry.urgente ? 'danger' : 'info'}`}>
                      {entry.tipo === 'servicio' ? 'SERVICIO' : 'TÉCNICO'}
                    </span>
                  </div>
                  <p className="mapa-log-text">{entry.descripcion}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {detalle && (
        <ServiceDetailModal
          key={detalle.id_servicio}
          isOpen
          onClose={() => setDetalle(null)}
          serviceId={detalle.id_servicio}
          title={detalle.titulo}
          clientName={`${detalle.cliente_nombre ?? ''} ${detalle.cliente_apellido ?? ''}`.trim() || 'Sin cliente'}
          techName={detalle.tecnico_nombre ? `${detalle.tecnico_nombre} ${detalle.tecnico_apellido ?? ''}` : 'Sin asignar'}
          status={detalle.estatus}
        />
      )}
    </div>
  )
}
