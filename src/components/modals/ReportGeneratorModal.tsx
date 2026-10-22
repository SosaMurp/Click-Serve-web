import { useState } from 'react'
import { X, FileText, Download, Calendar, CheckSquare } from 'lucide-react'
import { Button } from '@components/ui'
import './modals.css'

interface ReportGeneratorModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ReportGeneratorModal({ isOpen, onClose }: ReportGeneratorModalProps) {
  const [timeframe, setTimeframe] = useState('7d')
  const [dimensions, setDimensions] = useState({
    servicios: true,
    finanzas: true,
    identidad: true,
  })
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'pdf'>('pdf')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleGenerate = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      const filename = `Reporte_ClickAndServe_${timeframe}_${new Date().toISOString().slice(0,10)}.${format}`
      
      // Simular descarga de archivo
      const dummyContent = `Reporte Click&Serve Nodo LZC\nAlcance: ${timeframe}\nFecha: ${new Date().toLocaleString()}`
      const blob = new Blob([dummyContent], { type: format === 'pdf' ? 'application/pdf' : 'text/csv' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()

      alert(`Reporte compilado y descargado exitosamente en formato .${format.toUpperCase()}`)
      onClose()
    }, 600)
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-container--sm fade-in">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">Configuración de Reportes (RF-95, RF-96)</h3>
            <p className="modal-subtitle">EXPORTACIÓN DE DATOS DEL NODO</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ gap: 16 }}>
          {/* Alcance Temporal (RF-95) */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>
              Alcance Temporal del Archivo (RF-95)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { id: 'today', label: 'Hoy' },
                { id: '7d', label: 'Últimos 7 Días' },
                { id: 'month', label: 'Este Mes' },
                { id: 'custom', label: 'Personalizado' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTimeframe(t.id)}
                  style={{
                    padding: '8px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    border: '1px solid', borderColor: timeframe === t.id ? 'var(--accent-dim)' : '#cbd5e1',
                    background: timeframe === t.id ? '#e0f2fe' : '#fff',
                    color: timeframe === t.id ? '#0369a1' : '#475569', cursor: 'pointer'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dimensiones de Datos (RF-95) */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>
              Dimensiones de Datos a Incluir (RF-95)
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, background: '#f8fafc', padding: 8, borderRadius: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={dimensions.servicios}
                  onChange={e => setDimensions({...dimensions, servicios: e.target.checked})}
                />
                Dimensiones de Servicios y Operaciones
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, background: '#f8fafc', padding: 8, borderRadius: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={dimensions.finanzas}
                  onChange={e => setDimensions({...dimensions, finanzas: e.target.checked})}
                />
                Dimensiones Financieras y Retiros
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, background: '#f8fafc', padding: 8, borderRadius: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={dimensions.identidad}
                  onChange={e => setDimensions({...dimensions, identidad: e.target.checked})}
                />
                Auditoría de Identidad y Verificación SEP
              </label>
            </div>
          </div>

          {/* Formato de Descarga (RF-96) */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>
              Formato de Entrega (RF-96)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {(['pdf', 'csv', 'xlsx'] as const).map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  style={{
                    padding: '8px', borderRadius: 6, fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                    border: '1px solid', borderColor: format === fmt ? 'var(--text-dark)' : '#cbd5e1',
                    background: format === fmt ? 'var(--text-dark)' : '#fff',
                    color: format === fmt ? '#fff' : '#475569', cursor: 'pointer'
                  }}
                >
                  .{fmt}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <Button variant="outline" onClick={onClose}>
            CANCELAR
          </Button>
          <Button variant="primary" loading={loading} onClick={handleGenerate}>
            <Download size={13} /> GENERAR Y DESCARGAR
          </Button>
        </div>
      </div>
    </div>
  )
}

