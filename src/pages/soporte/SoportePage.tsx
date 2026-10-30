import { useMemo, useState } from 'react'
import { Search, Inbox, CheckCircle2, AlertCircle, Scale } from 'lucide-react'
import { Badge, StatCard } from '@components/ui'
import DisputeResolutionModal from '@components/modals/DisputeResolutionModal'
import { useDisputes, useSettleDispute } from '../../hooks/useAdminQueries'
import type { DisputaRow } from '../../types/api'
import './soporte.css'

type Filtro = 'abiertas' | 'resueltas' | 'todas'

const folio = (id: number) => `DSP-${String(id).padStart(3, '0')}`
const fullName = (n?: string, a?: string) => [n, a].filter(Boolean).join(' ') || '—'
const money = (v: string | number) =>
  Number(v || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function SoportePage() {
  const { data, isLoading, isError, refetch } = useDisputes()
  const settle = useSettleDispute()
  const [filtro, setFiltro] = useState<Filtro>('abiertas')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<DisputaRow | null>(null)

  const disputas = data ?? []
  const abiertas = disputas.filter(d => d.estado !== 'Resuelta')
  const resueltas = disputas.filter(d => d.estado === 'Resuelta')

  const filtered = useMemo(() => {
    const base = filtro === 'abiertas' ? abiertas : filtro === 'resueltas' ? resueltas : disputas
    const q = search.trim().toLowerCase()
    if (!q) return base
    return base.filter(d =>
      [folio(d.id_disputa), fullName(d.cliente_nombre, d.cliente_apellido), fullName(d.tecnico_nombre, d.tecnico_apellido), d.observaciones ?? '']
        .some(v => v.toLowerCase().includes(q)),
    )
  }, [filtro, search, disputas, abiertas, resueltas])

  const totalReembolsos = resueltas.reduce((s, d) => s + Number(d.monto_reembolso || 0), 0)

  return (
    <div className="sop-page fade-in">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Soporte y disputas</h1>
          <p className="dash-page-sub">Conflictos entre clientes y técnicos</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {([['abiertas', data ? `Abiertas (${abiertas.length})` : 'Abiertas'], ['resueltas', data ? `Resueltas (${resueltas.length})` : 'Resueltas'], ['todas', 'Todas']] as const).map(([k, label]) => (
            <button key={k} className={`sop-filter-pill ${filtro === k ? 'sop-filter-pill--active' : ''}`} onClick={() => setFiltro(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Disputas abiertas" value={isError ? '—' : String(abiertas.length)} icon={<Inbox size={15} />} tone="amber" note="Esperando resolución" />
        <StatCard label="Resueltas" value={isError ? '—' : String(resueltas.length)} icon={<CheckCircle2 size={15} />} tone="green" note="Historial completo" />
        <StatCard label="Reembolsado" value={isError ? '—' : money(totalReembolsos)} icon={<Scale size={15} />} tone="navy" note="En disputas resueltas" />
      </div>

      <div className="val-toolbar">
        <div className="val-search">
          <Search size={14} />
          <input placeholder="Buscar por folio, cliente, técnico u observaciones..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="dash-table sop-table">
          <thead>
            <tr>
              <th>FOLIO</th>
              <th>CLIENTE</th>
              <th>TÉCNICO</th>
              <th>ESTADO</th>
              <th>REEMBOLSO / MULTA</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="sop-empty">Cargando disputas…</td></tr>
            )}
            {isError && (
              <tr>
                <td colSpan={6} className="sop-empty">
                  <AlertCircle size={14} /> No se pudieron cargar las disputas.{' '}
                  <button className="sop-view-btn" onClick={() => refetch()}>REINTENTAR</button>
                </td>
              </tr>
            )}
            {!isLoading && !isError && filtered.length === 0 && (
              <tr><td colSpan={6} className="sop-empty">No hay disputas {filtro === 'todas' ? 'registradas' : filtro}.</td></tr>
            )}
            {filtered.map(d => {
              const cliente = fullName(d.cliente_nombre, d.cliente_apellido)
              const tecnico = fullName(d.tecnico_nombre, d.tecnico_apellido)
              const resuelta = d.estado === 'Resuelta'
              return (
                <tr key={d.id_disputa}>
                  <td>
                    <p className="sop-folio">{folio(d.id_disputa)}</p>
                    <p className="dash-table-id">{fecha(d.fecha_creacion)}</p>
                  </td>
                  <td>
                    <div className="val-tech-cell">
                      <div className="sop-avatar">{cliente[0]}</div>
                      <p className="dash-table-name">{cliente}</p>
                    </div>
                  </td>
                  <td><p className="dash-table-name">{tecnico}</p></td>
                  <td><Badge variant={resuelta ? 'success' : 'warning'}>{resuelta ? 'Resuelta' : 'Abierta'}</Badge></td>
                  <td>
                    <span className="dash-table-id">
                      {resuelta ? `${money(d.monto_reembolso)} / ${money(d.monto_multa)}` : 'Pendiente'}
                    </span>
                  </td>
                  <td>
                    {!resuelta && (
                      <button className="sop-view-btn" onClick={() => setSelected(d)}>RESOLVER</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <DisputeResolutionModal
        key={selected?.id_disputa}
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        ticketId={selected ? folio(selected.id_disputa) : ''}
        userName={selected ? fullName(selected.cliente_nombre, selected.cliente_apellido) : undefined}
        techName={selected ? fullName(selected.tecnico_nombre, selected.tecnico_apellido) : undefined}
        onResolve={async payload => {
          if (!selected) return
          await settle.mutateAsync({ id: selected.id_disputa, payload })
        }}
      />
    </div>
  )
}
