import { useState } from 'react'
import { X, FileText, Download, Calendar, CheckSquare } from 'lucide-react'
import { Button } from '@components/ui'
import api from '../../api/axios'
import { abrirImprimible, tablaHtml } from '../../utils/printable'
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
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [error, setError] = useState('')

  if (!isOpen) return null

  // RF-95/96: el servidor arma el archivo con los datos reales (CSV por partes, Excel con una hoja por
  // dimensión). El PDF se genera con la impresión del navegador a partir de los mismos datos.
  const handleGenerate = async () => {
    setError('')
    const dims = Object.entries(dimensions).filter(([, v]) => v).map(([k]) => k)
    if (dims.length === 0) return setError('Elige al menos una dimensión.')
    if (timeframe === 'custom' && (!desde || !hasta)) return setError('Elige las fechas de inicio y fin.')
    const params = { alcance: timeframe, dimensiones: dims.join(','), desde: desde || undefined, hasta: hasta || undefined }
    setLoading(true)
    try {
      if (format === 'pdf') {
        const { data } = await api.get<{ alcance: string; generado: string; hojas: { hoja: string; columnas: string[]; filas: unknown[][] }[] }>(
          '/admin/reportes', { params: { ...params, formato: 'json' } })
        abrirImprimible('Reporte de operación', `${data.alcance} · generado ${new Date(data.generado).toLocaleString('es-MX')}`,
          data.hojas.map(h => `<h2>${h.hoja} (${h.filas.length})</h2>${tablaHtml(h.columnas, h.filas)}`).join(''))
      } else {
        const res = await api.get<Blob>('/admin/reportes', { params: { ...params, formato: format }, responseType: 'blob', timeout: 60000 })
        const nombre = /filename="([^"]+)"/.exec(String(res.headers['content-disposition'] ?? ''))?.[1] ?? `Reporte_ClickServe.${format}`
        const url = URL.createObjectURL(res.data)
        const link = document.createElement('a')
        link.href = url
        link.download = nombre
        link.click()
        URL.revokeObjectURL(url)
      }
      onClose()
    } catch {
      setError('No se pudo generar el reporte. Revisa el rango de fechas e intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-container--sm fade-in">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">Configuración de Reportes</h3>
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
              Alcance Temporal del Archivo
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
                    border: '1px solid', borderColor: timeframe === t.id ? 'var(--accent-dim)' : '#CDD3E0',
                    background: timeframe === t.id ? '#E8EBF2' : '#fff',
                    color: timeframe === t.id ? '#0C1C40' : '#4B5563', cursor: 'pointer'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {timeframe === 'custom' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label className="field-label">Desde<input type="date" className="field-input" value={desde} onChange={e => setDesde(e.target.value)} /></label>
              <label className="field-label">Hasta<input type="date" className="field-input" value={hasta} onChange={e => setHasta(e.target.value)} /></label>
            </div>
          )}

          {/* Dimensiones de Datos (RF-95) */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-mid)', display: 'block', marginBottom: 6 }}>
              Dimensiones de Datos a Incluir
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, background: '#F7F8F9', padding: 8, borderRadius: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={dimensions.servicios}
                  onChange={e => setDimensions({...dimensions, servicios: e.target.checked})}
                />
                Dimensiones de Servicios y Operaciones
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, background: '#F7F8F9', padding: 8, borderRadius: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={dimensions.finanzas}
                  onChange={e => setDimensions({...dimensions, finanzas: e.target.checked})}
                />
                Dimensiones Financieras y Retiros
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, background: '#F7F8F9', padding: 8, borderRadius: 6, cursor: 'pointer' }}>
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
              Formato de Entrega
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {(['pdf', 'csv', 'xlsx'] as const).map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  style={{
                    padding: '8px', borderRadius: 6, fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                    border: '1px solid', borderColor: format === fmt ? 'var(--text-dark)' : '#CDD3E0',
                    background: format === fmt ? 'var(--text-dark)' : '#fff',
                    color: format === fmt ? '#fff' : '#4B5563', cursor: 'pointer'
                  }}
                >
                  .{fmt}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          {error && <p style={{ margin: 0, fontSize: 12, color: 'var(--danger-ink)', flex: 1 }}>{error}</p>}
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

