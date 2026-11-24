import { useState } from "react"
import {
  Activity, AlertTriangle, ChevronRight, RefreshCw, Wrench, UserPlus, Wallet, MessageSquare, LayoutList,
  type LucideIcon,
} from "lucide-react"
import { useActividadFeed } from "@hooks/useDashboard"
import type { ActividadGrupo, ActividadItem } from "@/types/dashboard"
import { esErrorDeRed, mensajeDeError } from "@/lib/errores"

// Cada tipo tiene su ícono y su color: se reconoce de qué se trata sin leer la frase completa
const TIPO: Record<ActividadItem["tipo"], { icon: LucideIcon; nombre: string; accion: string }> = {
  servicio: { icon: Wrench,        nombre: "Servicio",  accion: "Ver el servicio" },
  tecnico:  { icon: UserPlus,      nombre: "Técnico",   accion: "Ver el expediente del técnico" },
  alerta:   { icon: AlertTriangle, nombre: "Alerta",    accion: "Ir a la incidencia en Soporte" },
  retiro:   { icon: Wallet,        nombre: "Pago",      accion: "Ir a Finanzas" },
  ticket:   { icon: MessageSquare, nombre: "Soporte",   accion: "Ir al ticket en Soporte" },
}

const GRUPOS: { id: ActividadGrupo; label: string; icon: LucideIcon }[] = [
  { id: "todos",     label: "Todo",      icon: LayoutList },
  { id: "servicios", label: "Servicios", icon: Wrench },
  { id: "tecnicos",  label: "Técnicos",  icon: UserPlus },
  { id: "alertas",   label: "Alertas",   icon: AlertTriangle },
  { id: "finanzas",  label: "Pagos",     icon: Wallet },
  { id: "soporte",   label: "Soporte",   icon: MessageSquare },
]

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
    <section className="db-panel ca" aria-label="Actividad reciente">
      <header className="db-panel-head">
        <div>
          <h2 className="db-panel-title">Actividad reciente</h2>
          <p className="db-panel-sub">Lo último que pasó en la plataforma</p>
        </div>
      </header>

      <div className="ca-chips" role="tablist" aria-label="Filtrar actividad">
        {GRUPOS.map(g => (
          <button key={g.id} type="button" role="tab" aria-selected={grupo === g.id}
            className={`ca-chip ${grupo === g.id ? "ca-chip--on" : ""}`} onClick={() => setGrupo(g.id)}>
            <g.icon size={13} aria-hidden /> {g.label}
          </button>
        ))}
      </div>

      <div className="ca-scroll" onScroll={alScroll} tabIndex={0} aria-label="Lista de actividad">
        {feed.isLoading ? (
          <div className="db-list-skeleton">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="db-skeleton" style={{ height: 40, borderRadius: 10 }} />)}</div>
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
            {items.map(item => {
              const t = TIPO[item.tipo]
              return (
                <li key={`${item.tipo}-${item.id}`} className="db-feed-item">
                  <button type="button" className="db-feed-btn" onClick={() => onAbrir(item)}
                    title={t.accion} aria-label={`${t.nombre}: ${item.descripcion}. ${t.accion}`}>
                    <span className={`ca-ico ca-ico--${item.tipo}`} aria-hidden><t.icon size={15} /></span>
                    <div className="db-feed-body">
                      <p className={`db-feed-text ${item.urgente ? "db-feed-text--urgent" : ""}`}>{item.descripcion}</p>
                      <p className="db-feed-sub">
                        {item.sub ? `${item.sub} · ` : ""}{relativo(item.creado_en)}
                      </p>
                    </div>
                    <ChevronRight size={14} className="db-feed-go" aria-hidden />
                  </button>
                </li>
              )
            })}
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
