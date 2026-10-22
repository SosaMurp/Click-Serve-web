import { useState } from 'react'
import { Download, TrendingUp, Clock, CheckCircle, X, Check } from 'lucide-react'
import WithdrawalDetailModal from '@components/modals/WithdrawalDetailModal'
import './finanzas.css'

import { useWithdrawals, useApproveWithdrawal } from '../../hooks/useAdminQueries'

export default function FinanzasPage() {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState<'todos' | 'pendientes'>('pendientes')
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const statusFilter = filter === 'pendientes' ? 'Pendiente' : undefined
  const { data: retirosData, isLoading, isError } = useWithdrawals(statusFilter)
  const approveMutation = useApproveWithdrawal()

  const WITHDRAWALS = (retirosData || []).map(r => ({
    realId: r.id_retiro,
    req: `#REQ-${r.id_retiro}`,
    date: new Date(r.fecha_solicitud).toLocaleString(),
    name: `${r.nombre} ${r.apellido}`,
    techId: `ID: #TEC-${r.id_usuario}`,
    bank: r.banco || 'Desconocido',
    bankColor: '#1565c0', // Using a default generic color for now
    clabe: String(r.clabe || 'No especificada'),
    amount: `$${Number(r.monto).toFixed(2)}`
  }))

  const toggleSelect = (i: number) => {
    const next = new Set(selected)
    next.has(i) ? next.delete(i) : next.add(i)
    setSelected(next)
  }

  const handleApproveBatch = async () => {
    if (selected.size === 0) {
      alert('Selecciona al menos una solicitud para aprobar en lote.')
      return
    }
    try {
      const selectedIds = Array.from(selected).map(i => WITHDRAWALS[i].realId)
      for (const id of selectedIds) {
         await approveMutation.mutateAsync(id)
      }
      alert(`Lote de ${selected.size} solicitudes de retiro autorizadas exitosamente. (RF-77)`)
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
          <h1 className="dash-page-title">Centro Financiero (RF-66 A RF-83)</h1>
          <p className="dash-page-sub">GESTIÓN DE RETIROS Y BÓVEDA</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="dash-export-btn" onClick={handleExportCSV}>
            <Download size={13} /> EXPORTAR CSV (RF-78)
          </button>
          <button className="fin-approve-batch" onClick={handleApproveBatch}>
            APROBAR LOTE ({selected.size}) (RF-77)
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="fin-stats-grid">
        <div className="fin-stat fin-stat--warning">
          <div className="fin-stat-body">
            <p className="fin-stat-label">RETIROS PENDIENTES</p>
            <p className="fin-stat-value">...</p>
            <p className="fin-stat-sub">en {isLoading ? '...' : WITHDRAWALS.length} solicitudes activas</p>
          </div>
          <div className="fin-stat-icon"><Clock size={28} /></div>
        </div>

        <div className="fin-stat fin-stat--default">
          <div className="fin-stat-body">
            <p className="fin-stat-label">PROCESADO (HOY)</p>
            <p className="fin-stat-value">...</p>
            <p className="fin-stat-ok"><CheckCircle size={11} /> liquidez correctamente</p>
          </div>
          <div className="fin-stat-icon"><CheckCircle size={28} /></div>
        </div>

        <div className="fin-stat fin-stat--dark">
          <div className="fin-stat-body">
            <p className="fin-stat-label" style={{ color: 'rgba(255,255,255,.5)' }}>COMISIONES LZC (HOY)</p>
            <p className="fin-stat-value" style={{ color: '#fff' }}>...</p>
            <p className="fin-stat-sub" style={{ color: 'rgba(255,255,255,.4)' }}>Fondo de operación de plataforma</p>
          </div>
          <div className="fin-stat-icon" style={{ color: 'rgba(255,255,255,.3)' }}><TrendingUp size={28} /></div>
        </div>
      </div>

      {/* Queue */}
      <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="fin-queue-header">
          <h2 className="dash-card-title" style={{ padding: '16px 20px 0' }}>Cola de Autorización de Retiros</h2>
          <div className="fin-filter-tabs">
            <button className={`fin-filter-tab ${filter === 'todos' ? 'active' : ''}`} onClick={() => setFilter('todos')}>TODOS</button>
            <button className={`fin-filter-tab ${filter === 'pendientes' ? 'active' : ''}`} onClick={() => setFilter('pendientes')}>PENDIENTES</button>
          </div>
        </div>

        {isLoading ? (
           <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando solicitudes...</div>
        ) : isError ? (
           <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>Error al cargar los retiros</div>
        ) : (
          <table className="dash-table fin-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>SOLICITUD / FECHA</th>
                <th>TÉCNICO</th>
                <th>DESTINO BANCARIO</th>
                <th>MONTO A TRANSFERIR</th>
                <th>ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              {WITHDRAWALS.length === 0 && (
                <tr><td colSpan={6} style={{textAlign: 'center', padding: '1rem'}}>No hay retiros {filter}</td></tr>
              )}
              {WITHDRAWALS.map((row, i) => (
                <tr key={i} className={selected.has(i) ? 'fin-row--selected' : ''}>
                  <td>
                    <input type="checkbox" className="fin-checkbox"
                      checked={selected.has(i)} onChange={() => toggleSelect(i)} />
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
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="fin-btn-deny" onClick={() => handleOpenDetail(row)}>
                        <X size={11} /> DENEGAR
                      </button>
                      <button className="fin-btn-approve" onClick={() => handleOpenDetail(row)}>
                        <Check size={11} /> ABONAR
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      <WithdrawalDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        withdrawalData={selectedWithdrawal || undefined}
      />
    </div>
  )
}
