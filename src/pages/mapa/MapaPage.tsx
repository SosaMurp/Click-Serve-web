import { useMemo, useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { RotateCcw, ExternalLink, AlertTriangle, WifiOff } from 'lucide-react'
import ServiceDetailModal from '@components/modals/ServiceDetailModal'
import { useServiciosUbicados } from '@hooks/useServicios'
import type { ServicioUbicado } from '@api/servicios'
import 'leaflet/dist/leaflet.css'
import './mapa.css'

// ── Coordenadas de Lázaro Cárdenas, Michoacán ────────────────────────────────
const LZC_CENTER: [number, number] = [17.9750, -102.2050]
const DEFAULT_ZOOM = 13

// Un punto por servicio, coloreado por estado. El SOS es un punto rojo que parpadea.
type Grupo = 'pendiente' | 'en_curso' | 'completado' | 'cancelado' | 'sos'

const GRUPOS: { id: Grupo; label: string; color: string }[] = [
  { id: 'sos', label: 'SOS', color: '#D92D20' },
  { id: 'pendiente', label: 'Pendientes', color: '#0C1C40' },
  { id: 'en_curso', label: 'En curso', color: '#E25900' },
  { id: 'completado', label: 'Completados', color: '#0E7A42' },
  { id: 'cancelado', label: 'Cancelados', color: '#98A2B3' },
]
const COLOR = Object.fromEntries(GRUPOS.map(g => [g.id, g.color])) as Record<Grupo, string>
// Lo que se ve al abrir: lo que está pasando ahora. Lo cerrado se activa desde la leyenda.
const VISIBLES_AL_ABRIR: Grupo[] = ['sos', 'pendiente', 'en_curso']

interface Punto {
  id: number
  codigo: string
  lat: number
  lng: number
  grupo: Grupo
  titulo: string
  direccion: string
  estatus: string
}

function grupoDe(s: ServicioUbicado): Grupo {
  if (s.alerta_sos && !['Completado', 'Cancelado'].includes(s.estatus)) return 'sos'
  const e = s.estatus.toLowerCase()
  if (e.includes('cancel')) return 'cancelado'
  if (e.includes('complet')) return 'completado'
  if (e.includes('curso')) return 'en_curso'
  return 'pendiente'
}

function aPunto(s: ServicioUbicado): Punto | null {
  const lat = Number(s.latitud)
  const lng = Number(s.longitud)
  if (s.latitud == null || s.longitud == null || Number.isNaN(lat) || Number.isNaN(lng)) return null
  return {
    id: s.id_servicio,
    codigo: s.codigo || `#${s.id_servicio}`,
    lat, lng,
    grupo: grupoDe(s),
    titulo: s.titulo || 'Servicio sin título',
    direccion: s.direccion || 'Sin dirección registrada',
    estatus: s.estatus,
  }
}

function iconoPunto(p: Punto, seleccionado: boolean) {
  return L.divIcon({
    className: 'mapa-dot-marker',
    html: `<span class="mapa-pt ${p.grupo === 'sos' ? 'mapa-pt--sos' : ''} ${seleccionado ? 'mapa-pt--sel' : ''}" style="--c:${COLOR[p.grupo]}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -10],
  })
}

// Cámara: vuela al punto elegido o vuelve a centrar
function Camara({ destino }: { destino: { pos: [number, number]; zoom: number; n: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (destino) map.flyTo(destino.pos, destino.zoom, { duration: 1 })
  }, [destino, map])
  return null
}

export default function MapaPage() {
  const servicios = useServiciosUbicados()
  const [visibles, setVisibles] = useState<Set<Grupo>>(new Set(VISIBLES_AL_ABRIR))
  const [seleccionado, setSeleccionado] = useState<number | null>(null)
  const [destino, setDestino] = useState<{ pos: [number, number]; zoom: number; n: number } | null>(null)
  const [detalleId, setDetalleId] = useState<number | null>(null)

  const puntos = useMemo(
    () => (servicios.data ?? []).map(aPunto).filter((p): p is Punto => p !== null),
    [servicios.data],
  )
  const conteo = useMemo(() => {
    const c: Record<Grupo, number> = { sos: 0, pendiente: 0, en_curso: 0, completado: 0, cancelado: 0 }
    for (const p of puntos) c[p.grupo] += 1
    return c
  }, [puntos])
  const mostrados = puntos.filter(p => visibles.has(p.grupo))

  const alternar = (g: Grupo) => setVisibles(prev => {
    const n = new Set(prev)
    if (n.has(g)) n.delete(g); else n.add(g)
    return n
  })
  const centrar = () => setDestino({ pos: LZC_CENTER, zoom: DEFAULT_ZOOM, n: Date.now() })

  return (
    <div className="mapa-page fade-in">
      <MapContainer center={LZC_CENTER} zoom={DEFAULT_ZOOM} scrollWheelZoom style={{ width: '100%', height: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={18}
        />
        <Camara destino={destino} />

        {mostrados.map(p => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={iconoPunto(p, seleccionado === p.id)}
            eventHandlers={{ click: () => { setSeleccionado(p.id); setDestino({ pos: [p.lat, p.lng], zoom: 15, n: Date.now() }) } }}
          >
            <Popup eventHandlers={{ remove: () => setSeleccionado(s => (s === p.id ? null : s)) }}>
              <div className="mapa-popup-card">
                <div className="mapa-popup-header">
                  <span className="mapa-popup-tag" style={{ backgroundColor: `${COLOR[p.grupo]}1a`, color: COLOR[p.grupo] }}>
                    {p.grupo === 'sos' ? 'SOS' : p.estatus}
                  </span>
                  <strong style={{ fontSize: 11, color: '#667085' }}>{p.codigo}</strong>
                </div>
                <h4 className="mapa-popup-title">{p.titulo}</h4>
                <p className="mapa-popup-sub">{p.direccion}</p>
                <button type="button" className="mapa-popup-btn" onClick={() => setDetalleId(p.id)}>
                  <ExternalLink size={12} /> Ver detalle del servicio
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Leyenda: puntos, conteo y filtro en una sola pieza flotante */}
      <div className="mapa-legend" role="group" aria-label="Estados de los servicios en el mapa">
        {GRUPOS.map(g => (
          <button key={g.id} type="button" aria-pressed={visibles.has(g.id)}
            className={`mapa-chip ${visibles.has(g.id) ? 'mapa-chip--on' : ''}`} onClick={() => alternar(g.id)}
            title={`${visibles.has(g.id) ? 'Ocultar' : 'Mostrar'} ${g.label.toLowerCase()}`}>
            <span className={`mapa-chip-dot ${g.id === 'sos' && conteo.sos > 0 ? 'mapa-chip-dot--sos' : ''}`} style={{ background: g.color }} />
            {g.label}
            <span className="mapa-chip-n">{servicios.isLoading ? '…' : conteo[g.id]}</span>
          </button>
        ))}
      </div>

      <button type="button" className="mapa-recenter" onClick={centrar} title="Centrar mapa en Lázaro Cárdenas">
        <RotateCcw size={14} /> Centrar
      </button>

      {servicios.isError && (
        <div className="mapa-aviso" role="alert"><WifiOff size={14} /> Sin conexión con el servidor</div>
      )}
      {!servicios.isError && !servicios.isLoading && puntos.length === 0 && (
        <div className="mapa-aviso"><AlertTriangle size={14} /> Ningún servicio tiene ubicación todavía</div>
      )}

      {detalleId != null && <ServiceDetailModal isOpen onClose={() => setDetalleId(null)} serviceId={detalleId} />}
    </div>
  )
}
