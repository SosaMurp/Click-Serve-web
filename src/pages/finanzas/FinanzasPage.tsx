import { useState } from 'react'
import { Download, TrendingUp, Clock, CheckCircle, X, Check } from 'lucide-react'
import './finanzas.css'

const WITHDRAWALS = [
  { req: '#REQ-9021', date: 'Hoy, 10:45 AM', name: 'Roberto García', techId: 'ID: #TEC-8041', bank: 'Nu México',      bankColor: '#7c3aed', clabe: '*** *** *** 8001', amount: '$1,420.00' },
  { req: '#REQ-9019', date: 'Hoy, 09:12 AM', name: 'Luis Mendoza',   techId: 'ID: #TEC-5541', bank: 'BBVA Bancomer', bankColor: '#1565c0', clabe: '*** *** *** 4412', amount: '$2,300.00' },
  { req: '#REQ-9015', date: 'Ayer, 03:36 PM', name: 'Ana Martínez',  techId: 'ID: #TEC-0011', bank: 'Banorte',       bankColor: '#c62828', clabe: '*** *** *** 1198', amount: '$530.00'   },
]

const BANK_INITIALS: Record<string, string> = { 'Nu México': 'Nu', 'BBVA Bancomer': 'BB', 'Banorte': 'BN' }

export default function FinanzasPage() {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState<'todos' | 'pendientes'>('pendientes')

  const toggleSelect = (i: number) => {
    const next = new Set(selected)
    next.has(i) ? next.delete(i) : next.add(i)
    setSelected(next)
  }

  return (
    <div className="fin-page fade-in">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Centro Financiero</h1>
          <p className="dash-page-sub">GESTIÓN DE RETIROS Y BÓVEDA</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="dash-export-btn"><Download size={13} /> EXPORTAR CSV</button>
          <button className="fin-approve-batch">APROBAR LOTE ({selected.size})</button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="fin-stats-grid">
        <div className="fin-stat fin-stat--warning">
          <div className="fin-stat-body">
            <p className="fin-stat-label">RETIROS PENDIENTES</p>
            <p className="fin-stat-value">$4,250.00</p>
            <p className="fin-stat-sub">en 3 solicitudes activas</p>
          </div>
          <div className="fin-stat-icon"><Clock size={28} /></div>
        </div>

        <div className="fin-stat fin-stat--default">
          <div className="fin-stat-body">
            <p className="fin-stat-label">PROCESADO (HOY)</p>
            <p className="fin-stat-value">$12,800.00</p>
            <p className="fin-stat-ok"><CheckCircle size={11} /> liquidez correctamente</p>
          </div>
          <div className="fin-stat-icon"><CheckCircle size={28} /></div>
        </div>

        <div className="fin-stat fin-stat--dark">
          <div className="fin-stat-body">
            <p className="fin-stat-label" style={{ color: 'rgba(255,255,255,.5)' }}>COMISIONES LZC (HOY)</p>
            <p className="fin-stat-value" style={{ color: '#fff' }}>+$1,820.50</p>
            <p className="fin-stat-sub" style={{ color: 'rgba(255,255,255,.4)' }}>Fondo de operación de plataforma</p>
          </div>
          <div className="fin-stat-icon" style={{ color: 'rgba(255,255,255,.3)' }}><TrendingUp size={28} /></div>
        </div>
      </div>

      {/* Queue */}
      <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="fin-queue-header">
          <h2 className="dash-card-title" style={{ padding: '16px 20px 0' }}>Cola de Autorización</h2>
          <div className="fin-filter-tabs">
            <button className={`fin-filter-tab ${filter === 'todos' ? 'active' : ''}`} onClick={() => setFilter('todos')}>TODOS</button>
            <button className={`fin-filter-tab ${filter === 'pendientes' ? 'active' : ''}`} onClick={() => setFilter('pendientes')}>PENDIENTES (3)</button>
          </div>
        </div>

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
                      {BANK_INITIALS[row.bank]}
                    </div>
                    <div>
                      <p className="dash-table-name">{row.bank}</p>
                      <p className="dash-table-id">CLABE: {row.clabe}</p>
                    </div>
                  </div>
                </td>
                <td><p className="fin-amount">{row.amount}</p></td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="fin-btn-deny"><X size={11} /> DENEGAR</button>
                    <button className="fin-btn-approve"><Check size={11} /> ABONAR</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
