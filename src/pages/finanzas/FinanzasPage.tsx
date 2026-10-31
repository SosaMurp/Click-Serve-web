import { useState } from 'react'
import { Download, Clock, Wallet, Percent, X, Check } from 'lucide-react'
import { StatCard } from '@components/ui'
import WithdrawalDetailModal from '@components/modals/WithdrawalDetailModal'
import './finanzas.css'

import { useWithdrawals, useApproveWithdrawal, useRejectWithdrawal, usePlatformSettings } from '../../hooks/useAdminQueries'
import { useDashboardStats } from '@hooks/useDashboard'

const fmtMXN = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

export default function FinanzasPage() {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState<'todos' | 'pendientes'>('pendientes')
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const statusFilter = filter === 'pendientes' ? 'Pendiente' : undefined
  const { data: retirosData, isLoading, isError } = useWithdrawals(statusFilter)
  const approveMutation = useApproveWithdrawal()
  const rejectMutation = useRejectWithdrawal()

  // Datos de las tarjetas (independientes del filtro de la tabla)
  const pendientes = useWithdrawals('Pendiente')
  const stats = useDashboardStats()
  const settings = usePlatformSettings()
  const totalPendiente = (pendientes.data ?? []).reduce((acc, r) => acc + Number(r.monto || 0), 0)
  const ingresosHoy = Number(stats.data?.ingresos_hoy ?? 0)
  const comisionPct = Number(settings.data?.comision_porcentaje ?? 0)

  const WITHDRAWALS = (retirosData || []).map(r => ({
    realId: r.id_retiro,
    req: r.folio_trx || `#${r.id_retiro}`,
    estado: r.estado,
    motivoRechazo: r.motivo_rechazo,
    date: new Date(r.fecha_solicitud).toLocaleString(),
    name: `${r.nombre} ${r.apellido}`,
    techId: `ID: #TEC-${r.id_usuario}`,
    bank: r.banco || 'Desconocido',
    bankColor: '#1565c0', // Using a default generic color for now
    // La CLABE llega enmascarada desde el servidor (RNF-09)
    clabe: String(r.clabe || 'No especificada'),
    amount: `$${Number(r.monto).toFixed(2)}`
  }))

  // La selección guarda el id del retiro, no su posición: si la lista cambia (otro administrador procesa uno)
  // no queda apuntando a otra fila.
  const pendientesIds = WITHDRAWALS.filter(w => w.estado === 'Pendiente').map(w => w.realId)
  const seleccionados = pendientesIds.filter(id => selected.has(id))
  const todosMarcados = pendientesIds.length > 0 && seleccionados.length === pendientesIds.length

  const toggleSelect = (id: number) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }
  const toggleAll = () => setSelected(todosMarcados ? new Set() : new Set(pendientesIds))

  const handleApproveBatch = async () => {
    try {
      const selectedIds = seleccionados
      // Uno por uno: si alguno ya fue procesado, los demás siguen y se informa cuántos fallaron
      const results = await Promise.allSettled(selectedIds.map(id => approveMutation.mutateAsync(id)))
      const fallidos = results.filter(r => r.status === 'rejected').length
      alert(fallidos === 0
        ? `Se autorizaron ${selectedIds.length} retiros.`
        : `Se autorizaron ${selectedIds.length - fallidos} retiros; ${fallidos} no se pudieron procesar.`)
      setSelected(new Set())
    } catch (e) {
       console.error("Error batch approving withdrawals", e)
       alert("Ocurrió un error al aprobar en lote")
    }
  }

  const handleOpenDetail = (row: any) => {
    setSelectedWithdrawal(row)
    setIsModalOpen(true)
  }

  const handleExportCSV = () => {
    const csvHeader = "Solicitud,Fecha,Técnico,Banco,CLABE,Monto\n"
    const csvRows = WITHDRAWALS.map(w => `${w.req},${w.date},"${w.name}",${w.bank},${w.clabe},"${w.amount}"`).join("\n")
    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Movimientos_Financieros_LZC_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    a.remove()
  }

  const getBankInitials = (bank: string) => bank.substring(0,2).toUpperCase()

  return (
    <div className="fin-page fade-in">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Finanzas</h1>
          <p className="dash-page-sub">Retiros de técnicos e ingresos de la plataforma</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="dash-export-btn" onClick={handleExportCSV}>
            <Download size={13} /> Exportar CSV
          </button>
          <button className="fin-approve-batch" onClick={handleApproveBatch}
            disabled={seleccionados.length === 0 || approveMutation.isPending}>
            Aprobar seleccionados ({seleccionados.length})
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        <StatCard
          label="Retiros pendientes" tone="amber" icon={<Clock size={15} />}
          value={pendientes.isLoading ? '—' : fmtMXN(totalPendiente)}
          note={pendientes.isLoading ? 'Cargando…' : `${pendientes.data?.length ?? 0} solicitudes por autorizar`}
        />
        <StatCard
          label="Ingresos de hoy" tone="green" icon={<Wallet size={15} />}
          value={stats.isLoading ? '—' : fmtMXN(ingresosHoy)}
          note="Pagos confirmados"
        />
        <StatCard
          label="Comisión de plataforma" tone="orange" icon={<Percent size={15} />}
          value={stats.isLoading || settings.isLoading ? '—' : fmtMXN(ingresosHoy * comisionPct / 100)}
          note={`Hoy · ${comisionPct}% de los ingresos`}
        />
      </div>

      {/* Queue */}
      <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="fin-queue-header">
          <h2 className="dash-card-title" style={{ padding: '16px 20px 0' }}>Solicitudes de retiro</h2>
          <div className="fin-filter-tabs">
            <button className={`fin-filter-tab ${filter === 'todos' ? 'active' : ''}`} onClick={() => setFilter('todos')}>Todos</button>
            <button className={`fin-filter-tab ${filter === 'pendientes' ? 'active' : ''}`} onClick={() => setFilter('pendientes')}>Pendientes</button>
          </div>
        </div>

        {isLoading ? (
           <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando solicitudes...</div>
        ) : isError ? (
           <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>Error al cargar los retiros</div>
        ) : (
          <div className="table-scroll"><table className="dash-table fin-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  {pendientesIds.length > 0 && (
                    <input type="checkbox" className="fin-checkbox" aria-label="Seleccionar todos los retiros pendientes"
                      checked={todosMarcados} onChange={toggleAll} />
                  )}
                </th>
                <th>SOLICITUD / FECHA</th>
                <th>TÉCNICO</th>
                <th>DESTINO BANCARIO</th>
                <th>MONTO A TRANSFERIR</th>
                <th>ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              {WITHDRAWALS.length === 0 && (
                <tr><td colSpan={6} style={{textAlign: 'center', padding: '1rem'}}>{filter === 'pendientes' ? 'No hay retiros pendientes' : 'Todavía no hay retiros'}</td></tr>
              )}
              {WITHDRAWALS.map(row => (
                <tr key={row.realId} className={selected.has(row.realId) ? 'fin-row--selected' : ''}>
                  <td>
                    {row.estado === 'Pendiente' && (
                      <input type="checkbox" className="fin-checkbox"
                        aria-label={`Seleccionar ${row.req}`}
                        checked={selected.has(row.realId)} onChange={() => toggleSelect(row.realId)} />
                    )}
                  </td>
                  <td>
                    <p className="fin-req">{row.req}</p>
                    <p className="dash-table-id">{row.date}</p>
                  </td>
                  <td>
                    <p className="dash-table-name">{row.name}</p>
                    <p className="dash-table-id">{row.techId}</p>
                  </td>
                  <td>
                    <div className="fin-bank-cell">
                      <div className="fin-bank-logo" style={{ background: row.bankColor }}>
                        {getBankInitials(row.bank)}
                      </div>
                      <div>
                        <p className="dash-table-name">{row.bank}</p>
                        <p className="dash-table-id">CLABE: *** {row.clabe.slice(-4)}</p>
                      </div>
                    </div>
                  </td>
                  <td><p className="fin-amount">{row.amount}</p></td>
                  <td>
                    {row.estado === 'Pendiente' ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="fin-btn-deny" onClick={() => handleOpenDetail(row)}>
                          <X size={11} /> DENEGAR
                        </button>
                        <button className="fin-btn-approve" onClick={() => handleOpenDetail(row)}>
                          <Check size={11} /> AUTORIZAR
                        </button>
                      </div>
                    ) : (
                      <button className="fin-btn-approve" onClick={() => handleOpenDetail(row)}>
                        {row.estado === 'Aprobado' ? 'AUTORIZADO' : 'RECHAZADO'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {/* Modal */}
      <WithdrawalDetailModal
        key={selectedWithdrawal?.realId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        withdrawalData={selectedWithdrawal || undefined}
        onApprove={id => approveMutation.mutateAsync(id)}
        onReject={(id, motivo) => rejectMutation.mutateAsync({ id, motivo })}
      />
    </div>
  )
}
