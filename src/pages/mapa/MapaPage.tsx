import { useMemo, useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { RotateCcw, ExternalLink, AlertTriangle, WifiOff, Search, List, X, UserRound, MapPin } from 'lucide-react'
import ServiceDetailModal from '@components/modals/ServiceDetailModal'
import { useServiciosUbicados } from '@hooks/useServicios'
import type { ServicioUbicado } from '@api/servicios'
import 'leaflet/dist/leaflet.css'
import './mapa.css'

// ── Coordenadas de Lázaro Cárdenas, Michoacán ────────────────────────────────
const LZC_CENTER: [number, number] = [17.9750, -102.2050]
const DEFAULT_ZOOM = 13

// Un punto por servicio, coloreado por estado. El SOS es un punto rojo que parpadea; ningún otro estado usa
// rojo ni naranja, para que no se confunda con él (en curso es azul y pendiente es ámbar).
type Grupo = 'pendiente' | 'en_curso' | 'completado' | 'cancelado' | 'sos'

const GRUPOS: { id: Grupo; label: string; color: string }[] = [
  { id: 'en_curso', label: 'En curso', color: '#2F6FD0' },
  { id: 'sos', label: 'SOS', color: '#D92D20' },
  { id: 'pendiente', label: 'Pendientes', color: '#E0A100' },
  { id: 'completado', label: 'Completados', color: '#0E7A42' },
  { id: 'cancelado', label: 'Cancelados', color: '#98A2B3' },
]
const COLOR = Object.fromEntries(GRUPOS.map(g => [g.id, g.color])) as Record<Grupo, string>
const NOMBRE = Object.fromEntries(GRUPOS.map(g => [g.id, g.label])) as Record<Grupo, string>
// Al abrir se ve lo que está pasando ahora: servicios en curso y emergencias. Lo demás se activa con los filtros.
const VISIBLES_AL_ABRIR: Grupo[] = ['en_curso', 'sos']
// Orden de la lista: emergencias primero
const PRIORIDAD: Record<Grupo, number> = { sos: 0, en_curso: 1, pendiente: 2, completado: 3, cancelado: 4 }

interface Punto {
  id: number
  codigo: string
  lat: number
  lng: number
  grupo: Grupo
  titulo: string
  direccion: string
  estatus: string
  tecnico: string | null
  cliente: string | null
}

const nombreCompleto = (n?: string | null, a?: string | null) => {
  const t = `${n ?? ''} ${a ?? ''}`.trim()
  return t || null
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
    tecnico: nombreCompleto(s.tecnico_nombre, s.tecnico_apellido),
    cliente: nombreCompleto(s.cliente_nombre, s.cliente_apellido),
  }
}

// Sin acentos ni mayúsculas, para que "maria" encuentre a "María"
const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

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
    if (destino) map.flyTo(destino.pos, destino.zoom, { duration: 0.8 })
  }, [destino, map])
  return null
}

export default function MapaPage() {
  const servicios = useServiciosUbicados()
  const [visibles, setVisibles] = useState<Set<Grupo>>(new Set(VISIBLES_AL_ABRIR))
  const [busqueda, setBusqueda] = useState('')
  const [tecnico, setTecnico] = useState('')
  const [panelAbierto, setPanelAbierto] = useState(() => window.matchMedia('(min-width: 721px)').matches)
  const [seleccionado, setSeleccionado] = useState<number | null>(null)
  const [destino, setDestino] = useState<{ pos: [number, number]; zoom: number; n: number } | null>(null)
  const [detalleId, setDetalleId] = useState<number | null>(null)
  const marcadores = useRef<Record<number, L.Marker | null>>({})

  const puntos = useMemo(
    () => (servicios.data ?? []).map(aPunto).filter((p): p is Punto => p !== null),
    [servicios.data],
  )
  const conteo = useMemo(() => {
    const c: Record<Grupo, number> = { sos: 0, pendiente: 0, en_curso: 0, completado: 0, cancelado: 0 }
    for (const p of puntos) c[p.grupo] += 1
    return c
  }, [puntos])
  const tecnicos = useMemo(
    () => [...new Set(puntos.map(p => p.tecnico).filter((t): t is string => !!t))].sort((a, b) => a.localeCompare(b, 'es')),
    [puntos],
  )

  // Búsqueda y técnico se aplican a todos los estados; los filtros de estado deciden qué se ve
  const coincide = useMemo(() => {
    const q = normal(busqueda.trim())
    return (p: Punto) =>
      (!tecnico || p.tecnico === tecnico) &&
      (!q || [p.codigo, p.titulo, p.direccion, p.tecnico ?? '', p.cliente ?? ''].some(t => normal(t).includes(q)))
  }, [busqueda, tecnico])
  const mostrados = useMemo(
    () => puntos.filter(p => visibles.has(p.grupo) && coincide(p)).sort((a, b) => PRIORIDAD[a.grupo] - PRIORIDAD[b.grupo]),
    [puntos, visibles, coincide],
  )
  const ocultosPorEstado = useMemo(
    () => (busqueda || tecnico ? puntos.filter(p => !visibles.has(p.grupo) && coincide(p)).length : 0),
    [puntos, visibles, coincide, busqueda, tecnico],
  )

  const alternar = (g: Grupo) => setVisibles(prev => {
    const n = new Set(prev)
    if (n.has(g)) n.delete(g); else n.add(g)
    return n
  })
  const centrar = () => setDestino({ pos: LZC_CENTER, zoom: DEFAULT_ZOOM, n: Date.now() })
  const limpiar = () => { setBusqueda(''); setTecnico(''); setVisibles(new Set(VISIBLES_AL_ABRIR)) }
  const hayFiltros = !!busqueda || !!tecnico || visibles.size !== VISIBLES_AL_ABRIR.length || !VISIBLES_AL_ABRIR.every(g => visibles.has(g))

  const irA = (p: Punto) => {
    setSeleccionado(p.id)
    setDestino({ pos: [p.lat, p.lng], zoom: 16, n: Date.now() })
    // La ficha se abre cuando la cámara termina de moverse
    setTimeout(() => marcadores.current[p.id]?.openPopup(), 850)
    if (window.matchMedia('(max-width: 720px)').matches) setPanelAbierto(false)
  }

  return (
    <div className={`mapa-page fade-in ${panelAbierto ? 'mapa-page--panel' : ''}`}>
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
            ref={m => { marcadores.current[p.id] = m }}
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
                  <strong className="mapa-popup-code">{p.codigo}</strong>
                </div>
                <h4 className="mapa-popup-title">{p.titulo}</h4>
                <p className="mapa-popup-sub">{p.direccion}</p>
                <p className="mapa-popup-sub"><strong>Técnico:</strong> {p.tecnico ?? 'Sin asignar'}</p>
                <button type="button" className="mapa-popup-btn" onClick={() => setDetalleId(p.id)}>
                  <ExternalLink size={12} /> Ver detalle del servicio
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Panel de servicios: búsqueda, filtros y lista. Elegir uno lleva al punto en el mapa. */}
      {panelAbierto ? (
        <aside className="mapa-panel" aria-label="Servicios en el mapa">
          <div className="mapa-panel-head">
            <div>
              <h2 className="mapa-panel-title">Servicios</h2>
              <p className="mapa-panel-sub" aria-live="polite">
                {servicios.isLoading ? 'Cargando…' : `${mostrados.length} en el mapa`}
              </p>
            </div>
            <button type="button" className="mapa-icon-btn" onClick={() => setPanelAbierto(false)} aria-label="Ocultar la lista de servicios" title="Ocultar lista">
              <X size={16} />
            </button>
          </div>

          <div className="mapa-search">
            <Search size={14} aria-hidden />
            <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Técnico, cliente, folio o calle" aria-label="Buscar servicios por técnico, cliente, folio o dirección" />
          </div>

          <label className="sr-only" htmlFor="mapa-tecnico">Técnico</label>
          <select id="mapa-tecnico" className="mapa-select" value={tecnico} onChange={e => setTecnico(e.target.value)}>
            <option value="">Todos los técnicos</option>
            {tecnicos.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <div className="mapa-legend" role="group" aria-label="Estados que se muestran">
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

          {hayFiltros && (
            <button type="button" className="mapa-link" onClick={limpiar}>Volver a la vista inicial</button>
          )}

          <ul className="mapa-list">
            {mostrados.map(p => (
              <li key={p.id}>
                <button type="button" className={`mapa-item ${seleccionado === p.id ? 'mapa-item--on' : ''}`} onClick={() => irA(p)}
                  aria-current={seleccionado === p.id ? 'true' : undefined}>
                  <span className={`mapa-chip-dot ${p.grupo === 'sos' ? 'mapa-chip-dot--sos' : ''}`} style={{ background: COLOR[p.grupo] }} aria-hidden />
                  <span className="mapa-item-body">
                    <span className="mapa-item-title">{p.titulo}</span>
                    <span className="mapa-item-meta"><UserRound size={12} aria-hidden /> {p.tecnico ?? 'Sin técnico asignado'}</span>
                    <span className="mapa-item-meta"><MapPin size={12} aria-hidden /> {p.codigo} · {NOMBRE[p.grupo]}</span>
                  </span>
                </button>
              </li>
            ))}
            {!servicios.isLoading && mostrados.length === 0 && (
              <li className="mapa-list-empty">
                {ocultosPorEstado > 0 ? (
                  <>
                    <p>Hay {ocultosPorEstado} {ocultosPorEstado === 1 ? 'coincidencia' : 'coincidencias'} en estados que no se están mostrando.</p>
                    <button type="button" className="mapa-link" onClick={() => setVisibles(new Set(GRUPOS.map(g => g.id)))}>Mostrar todos los estados</button>
                  </>
                ) : busqueda || tecnico ? (
                  <p>Ningún servicio coincide con la búsqueda.</p>
                ) : (
                  <p>No hay servicios en estos estados ahora mismo.</p>
                )}
              </li>
            )}
          </ul>
        </aside>
      ) : (
        <button type="button" className="mapa-panel-open" onClick={() => setPanelAbierto(true)}>
          <List size={15} aria-hidden /> Servicios
          <span className="mapa-chip-n">{mostrados.length}</span>
        </button>
      )}

      <button type="button" className="mapa-recenter" onClick={centrar} title="Centrar mapa en Lázaro Cárdenas">
        <RotateCcw size={14} aria-hidden /> Centrar
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
