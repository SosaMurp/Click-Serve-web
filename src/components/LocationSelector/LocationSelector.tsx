/**
 * LocationSelector.tsx
 * Componente funcional React 19 para asignar ubicacion a servicios tecnicos.
 * Centrado por defecto en Lazaro Cardenas, Michoacan.
 * Integra React-Leaflet, geolocalizacion del navegador, React Hook Form + Zod.
 */

import { useEffect, useRef, useState, useCallback } from "react"
import {
  Controller,
  type Control,
  type FieldErrors,
  type UseFormSetValue,
} from "react-hook-form"
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet"
import L from "leaflet"
import {
  MapPin,
  LocateFixed,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Navigation,
} from "lucide-react"

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png"
import markerIcon from "leaflet/dist/images/marker-icon.png"
import markerShadow from "leaflet/dist/images/marker-shadow.png"
import "leaflet/dist/leaflet.css"
import "./LocationSelector.css"

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

// ── Custom accent marker ──────────────────────────────────────────────────────
const accentIcon = L.divIcon({
  className: "ls-custom-marker",
  html: `<div class="ls-marker-pin">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
             <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
             <circle cx="12" cy="10" r="3"/>
           </svg>
         </div>`,
  iconSize: [36, 48],
  iconAnchor: [18, 48],
  popupAnchor: [0, -50],
})

// ── Default center: Lazaro Cardenas, Michoacan ────────────────────────────────
const DEFAULT_CENTER: [number, number] = [17.9593, -102.2006]
const DEFAULT_ZOOM = 14

// ── Types ─────────────────────────────────────────────────────────────────────
export interface LocationValue {
  lat: number
  lng: number
  address: string
}

export interface LocationFormFields {
  location: LocationValue
}

interface LocationSelectorProps {
  name?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setValue: UseFormSetValue<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors?: FieldErrors<any>
  defaultValue?: LocationValue
  mapHeight?: number
  disabled?: boolean
}

// ── Inner: handle map clicks ──────────────────────────────────────────────────
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

// ── Reverse geocoding via Nominatim (no API key needed) ───────────────────────
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`
    const res = await fetch(url, { headers: { "Accept-Language": "es" } })
    if (!res.ok) throw new Error("Nominatim error")
    const data = await res.json()
    return data.display_name ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  } catch {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  }
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function LocationSelector({
  name = "location",
  control,
  setValue,
  errors,
  defaultValue,
  mapHeight = 380,
  disabled = false,
}: LocationSelectorProps) {
  const [position, setPosition] = useState<[number, number] | null>(
    defaultValue ? [defaultValue.lat, defaultValue.lng] : null,
  )
  const [geoState, setGeoState] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [geoError, setGeoError] = useState<string | null>(null)
  const [addressLoading, setAddressLoading] = useState(false)
  const [resolvedAddress, setResolvedAddress] = useState(defaultValue?.address ?? "")
  const mapRef = useRef<L.Map | null>(null)

  const fieldError =
    errors?.[name] as
      | { lat?: { message?: string }; lng?: { message?: string }; address?: { message?: string } }
      | { message?: string }
      | undefined

  const applyPosition = useCallback(
    async (lat: number, lng: number) => {
      setPosition([lat, lng])
      setAddressLoading(true)
      const address = await reverseGeocode(lat, lng)
      setAddressLoading(false)
      setResolvedAddress(address)
      setValue(name, { lat, lng, address }, { shouldValidate: true, shouldDirty: true })
      setValue(`${name}.address`, address, { shouldValidate: true })
    },
    [name, setValue],
  )

  useEffect(() => {
    if (defaultValue) setPosition([defaultValue.lat, defaultValue.lng])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Tu navegador no soporta geolocalizacion.")
      setGeoState("error")
      return
    }
    setGeoState("loading")
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords
        setGeoState("success")
        applyPosition(lat, lng)
        mapRef.current?.setView([lat, lng], 16)
      },
      (err) => {
        setGeoState("error")
        const messages: Record<number, string> = {
          1: "Permiso de ubicacion denegado.",
          2: "Posicion no disponible.",
          3: "Tiempo de espera agotado.",
        }
        setGeoError(messages[err.code] ?? "Error desconocido de geolocalizacion.")
      },
      { timeout: 10000, maximumAge: 0, enableHighAccuracy: true },
    )
  }, [applyPosition])

  return (
    <div className={`ls-root ${disabled ? "ls-root--disabled" : ""}`}>
      {/* Header */}
      <div className="ls-header">
        <div className="ls-header-left">
          <MapPin size={16} className="ls-header-icon" />
          <span className="ls-header-title">Ubicacion del Servicio</span>
        </div>
        <button
          type="button"
          id="btn-mi-ubicacion"
          className={`ls-geo-btn ls-geo-btn--${geoState}`}
          onClick={handleMyLocation}
          disabled={disabled || geoState === "loading"}
          aria-label="Usar mi ubicacion actual"
        >
          {geoState === "loading" ? (
            <Loader2 size={14} className="ls-spin" />
          ) : geoState === "success" ? (
            <CheckCircle2 size={14} />
          ) : geoState === "error" ? (
            <AlertCircle size={14} />
          ) : (
            <LocateFixed size={14} />
          )}
          <span>
            {geoState === "loading"
              ? "Localizando..."
              : geoState === "success"
              ? "Ubicado!"
              : geoState === "error"
              ? "Reintentar"
              : "Mi ubicacion actual"}
          </span>
        </button>
      </div>

      {/* Geo error */}
      {geoError && (
        <div className="ls-alert ls-alert--error" role="alert">
          <AlertCircle size={13} />
          {geoError}
        </div>
      )}

      {/* Map hint */}
      {!position && (
        <div className="ls-hint">
          <Navigation size={14} />
          <span>Haz clic en el mapa o usa &quot;Mi ubicacion actual&quot; para colocar el pin.</span>
        </div>
      )}

      {/* Leaflet map */}
      <Controller
        name={name}
        control={control}
        defaultValue={defaultValue ?? { lat: 0, lng: 0, address: "" }}
        render={() => (
          <div
            className={`ls-map-wrapper ${fieldError ? "ls-map-wrapper--error" : ""}`}
            style={{ height: mapHeight }}
          >
            <MapContainer
              center={position ?? DEFAULT_CENTER}
              zoom={DEFAULT_ZOOM}
              style={{ height: "100%", width: "100%" }}
              ref={mapRef as React.RefObject<L.Map>}
              zoomControl
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapClickHandler
                onMapClick={(lat, lng) => {
                  if (!disabled) applyPosition(lat, lng)
                }}
              />
              {position && (
                <Marker
                  position={position}
                  icon={accentIcon}
                  draggable={!disabled}
                  eventHandlers={{
                    dragend(e) {
                      const m = e.target as L.Marker
                      const { lat, lng } = m.getLatLng()
                      applyPosition(lat, lng)
                    },
                  }}
                />
              )}
            </MapContainer>
          </div>
        )}
      />

      {/* Coord chips */}
      {position && (
        <div className="ls-coords-row">
          <div className="ls-coord-chip">
            <span className="ls-coord-label">LAT</span>
            <span className="ls-coord-value">{position[0].toFixed(6)}</span>
          </div>
          <div className="ls-coord-chip">
            <span className="ls-coord-label">LNG</span>
            <span className="ls-coord-value">{position[1].toFixed(6)}</span>
          </div>
          <div className="ls-address-chip">
            {addressLoading ? <Loader2 size={12} className="ls-spin" /> : <MapPin size={12} />}
            <span className="ls-address-text">
              {addressLoading ? "Obteniendo direccion..." : resolvedAddress}
            </span>
          </div>
        </div>
      )}

      {/* Editable address field */}
      <Controller
        name={`${name}.address`}
        control={control}
        defaultValue={defaultValue?.address ?? ""}
        render={({ field, fieldState }) => (
          <div className={`ls-address-field ${fieldState.error ? "ls-address-field--error" : ""}`}>
            <label htmlFor="location-address" className="ls-field-label">
              DIRECCION TEXTUAL
            </label>
            <div className="ls-field-wrap">
              <MapPin size={15} className="ls-field-icon" />
              <input
                {...field}
                id="location-address"
                type="text"
                className="ls-field-input"
                placeholder="Ej. Calle Lazaro Cardenas 120, Col. Centro, Lazaro Cardenas, Mich."
                disabled={disabled}
                autoComplete="off"
              />
            </div>
            {fieldState.error && (
              <p className="ls-field-error">
                <AlertCircle size={11} />
                {fieldState.error.message}
              </p>
            )}
          </div>
        )}
      />

      {fieldError && "message" in fieldError && fieldError.message && (
        <p className="ls-field-error ls-field-error--top">
          <AlertCircle size={11} />
          {fieldError.message}
        </p>
      )}
    </div>
  )
}
