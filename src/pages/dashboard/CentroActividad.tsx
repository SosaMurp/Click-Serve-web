import { useState } from "react"
import { Activity, AlertTriangle, ChevronRight, RefreshCw } from "lucide-react"
import { useActividadFeed } from "@hooks/useDashboard"
import type { ActividadGrupo, ActividadItem } from "@/types/dashboard"
import { esErrorDeRed, mensajeDeError } from "@/lib/errores"

const GRUPOS: { id: ActividadGrupo; label: string }[] = [
  { id: "todos", label: "Todo" },
  { id: "servicios", label: "Servicios" },
  { id: "tecnicos", label: "Técnicos" },
  { id: "alertas", label: "Alertas" },
  { id: "finanzas", label: "Finanzas" },
  { id: "soporte", label: "Soporte" },
]

const COLOR: Record<ActividadItem["tipo"], string> = {
  servicio: "#0C1C40",
  tecnico: "#E25900",
  alerta: "#B91C1C",
  retiro: "#15803D",
  ticket: "#667085",
}

const ACCION: Record<ActividadItem["tipo"], string> = {
  servicio: "Ver el servicio",
  tecnico: "Ver el expediente del técnico",
  alerta: "Ir a la incidencia en Soporte",
  retiro: "Ir a Finanzas",
  ticket: "Ir al ticket en Soporte",
}

function relativo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (m < 1) return "ahora"
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} d`
}

/**
 * Centro de actividad: servicios, técnicos nuevos, incidencias, retiros y tickets en un solo listado con su propio
 * desplazamiento. Carga más al llegar al final; cada fila abre el elemento (lo decide `onAbrir`).
 */
export default function CentroActividad({ onAbrir }: { onAbrir: (item: ActividadItem) => void }) {
  const [grupo, setGrupo] = useState<ActividadGrupo>("todos")
  const feed = useActividadFeed(grupo)
  const items = feed.data?.pages.flatMap(p => p.items) ?? []

  const alScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80 && feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage()
  }

  return (
    <section className="db-panel ca" aria-label="Centro de actividad">
      <header className="db-panel-head">
        <div>
          <h2 className="db-panel-title">Centro de actividad</h2>
          <p className="db-panel-sub">Lo reciente y lo que espera tu atención · toca una fila para abrirla</p>
        </div>
      </header>

      <div className="ca-chips" role="tablist" aria-label="Filtrar actividad">
        {GRUPOS.map(g => (
          <button key={g.id} type="button" role="tab" aria-selected={grupo === g.id}
            className={`ca-chip ${grupo === g.id ? "ca-chip--on" : ""}`} onClick={() => setGrupo(g.id)}>
            {g.label}
          </button>
        ))}
      </div>

      <div className="ca-scroll" onScroll={alScroll} tabIndex={0} aria-label="Lista de actividad">
        {feed.isLoading ? (
          <div className="db-list-skeleton">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="db-skeleton" style={{ height: 34, borderRadius: 8 }} />)}</div>
        ) : feed.isError ? (
          <div className="db-empty" style={{ height: 180 }}>
            <AlertTriangle size={18} />
            <p>{esErrorDeRed(feed.error) ? "Sin conexión con el servidor" : mensajeDeError(feed.error, "No se pudo cargar la actividad")}</p>
            <button type="button" className="db-retry-btn" onClick={() => feed.refetch()}><RefreshCw size={13} /> Reintentar</button>
          </div>
        ) : items.length === 0 ? (
          <div className="db-empty" style={{ height: 180 }}><Activity size={18} /><p>Sin actividad en esta categoría</p></div>
        ) : (
          <ul className="db-feed">
            {items.map(item => (
              <li key={`${item.tipo}-${item.id}`} className="db-feed-item">
                <button type="button" className="db-feed-btn" onClick={() => onAbrir(item)}
                  title={ACCION[item.tipo]} aria-label={`${ACCION[item.tipo]}: ${item.descripcion}`}>
                  <span className="db-feed-dot" style={{ background: COLOR[item.tipo] }} />
                  <div className="db-feed-body">
                    <p className={`db-feed-text ${item.urgente ? "db-feed-text--urgent" : ""}`}>{item.descripcion}</p>
                    {item.sub && <p className="db-feed-sub">{item.sub}</p>}
                  </div>
                  <span className="db-feed-time">{relativo(item.creado_en)}</span>
                  <ChevronRight size={14} className="db-feed-go" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {feed.isFetchingNextPage && <p className="ca-more">Cargando más…</p>}
        {!feed.isFetchingNextPage && feed.hasNextPage && (
          <button type="button" className="ca-more ca-more--btn" onClick={() => feed.fetchNextPage()}>Cargar más</button>
        )}
        {!feed.hasNextPage && items.length > 0 && <p className="ca-more">Llegaste al final</p>}
      </div>
    </section>
  )
}
