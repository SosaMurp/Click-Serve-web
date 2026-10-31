import { useState } from 'react'
import { X, MapPin, Calendar, Clock, Star, Plus, Eye, AlertTriangle, ShieldCheck, CheckSquare, UserCheck, RefreshCw, XCircle, BellRing } from 'lucide-react'
import { Badge, Button } from '@components/ui'
import UpdateServiceStatusModal from './UpdateServiceStatusModal'
import './modals.css'

interface ServiceDetailModalProps {
  isOpen: boolean
  onClose: () => void
  serviceId?: string | number
  clientName?: string
  clientPhone?: string
  clientEmail?: string
  techName?: string
  status?: string
  title?: string
  onStatusUpdated?: (newStatus: string) => void
}

export default function ServiceDetailModal({
  isOpen,
  onClose,
  serviceId = 'SRV-108',
  clientName = 'José López',
  clientPhone = '+52 753 102 9918',
  clientEmail = 'jose.lopez@example.com',
  techName = 'Roberto García',
  status = 'En Progreso',
  title = 'Soporte e Instalación de Redes',
  onStatusUpdated,
}: ServiceDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'detalles' | 'evidencias' | 'rating' | 'acciones'>('detalles')
  const [serviceStatus, setServiceStatus] = useState(status)
  const [isUpdateStatusOpen, setIsUpdateStatusOpen] = useState(false)
  const [arrived, setArrived] = useState(true)
  const [evidences, setEvidences] = useState([
    'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=400&q=80',
  ])
  const [activities, setActivities] = useState([
    { text: 'Inspección física de cableado UTP Cat6', done: true },
    { text: 'Reemplazo de conector RJ45 dañado', done: true },
    { text: 'Prueba de velocidad de ancha de banda', done: false },
  ])
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [clientRating, setClientRating] = useState(5)
  const [techRating, setTechRating] = useState(5)

  if (!isOpen) return null

  const handleAddEvidence = () => {
    const mockNewImage = 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=400&q=80'
    setEvidences([...evidences, mockNewImage])
    alert('Nueva evidencia fotográfica agregada al expediente del servicio.')
  }

  const toggleActivity = (index: number) => {
    const next = [...activities]
    next[index].done = !next[index].done
    setActivities(next)
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-container--lg modal-container--fixed fade-in">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">Detalle del Servicio #{serviceId}</h3>
            <p className="modal-subtitle">SEGUIMIENTO EN TIEMPO REAL</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="modal-tabs">
          <button className={`modal-tab-btn ${activeTab === 'detalles' ? 'modal-tab-btn--active' : ''}`} onClick={() => setActiveTab('detalles')}>
            RESUMEN Y LABORES
          </button>
          <button className={`modal-tab-btn ${activeTab === 'evidencias' ? 'modal-tab-btn--active' : ''}`} onClick={() => setActiveTab('evidencias')}>
            DOCUMENTACIÓN Y EVIDENCIAS ({evidences.length})
          </button>
          <button className={`modal-tab-btn ${activeTab === 'rating' ? 'modal-tab-btn--active' : ''}`} onClick={() => setActiveTab('rating')}>
            CALIFICACIÓN BIDIRECCIONAL
          </button>
          <button className={`modal-tab-btn ${activeTab === 'acciones' ? 'modal-tab-btn--active' : ''}`} onClick={() => setActiveTab('acciones')}>
            GESTIÓN Y CONTINGENCIAS
          </button>
        </div>

        <div className="modal-body">
          {activeTab === 'detalles' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Header Status Card */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F7F8F9', padding: 16, borderRadius: 8, border: '1px solid #E6E9EE', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Badge variant={serviceStatus.toUpperCase() === 'FINALIZADO' || serviceStatus.toUpperCase() === 'COMPLETADO' ? 'success' : serviceStatus.toUpperCase() === 'CANCELADO' ? 'danger' : 'warning'}>
                      {serviceStatus}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => setIsUpdateStatusOpen(true)}
                      style={{
                        background: '#E8EBF2',
                        border: '1px solid #CDD3E0',
                        color: '#0C1C40',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <BellRing size={12} /> CAMBIAR ESTADO
                    </button>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 700, margin: '6px 0 0', color: 'var(--text-dark)' }}>{title}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-mid)', margin: '2px 0 0' }}>Zona Centro, Lázaro Cárdenas, Michoacán</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-mid)', margin: 0 }}>CHECK-IN EN SITIO</p>
                  <span style={{ fontSize: 12, fontWeight: 700, color: arrived ? '#0B6235' : '#7A4F00', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <MapPin size={13} /> {arrived ? 'Técnico en Sitio' : 'En Traslado (ETA 10 min)'}
                  </span>
                </div>
              </div>

              {/* Participants */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ padding: 14, border: '1px solid #E6E9EE', borderRadius: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-mid)', textTransform: 'uppercase', margin: '0 0 6px' }}>CLIENTE SOLICITANTE</p>
                  <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-dark)' }}>{clientName}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-mid)', margin: '2px 0 0' }}>Tel: +52 753 102 9918</p>
                </div>
                <div style={{ padding: 14, border: '1px solid #E6E9EE', borderRadius: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-mid)', textTransform: 'uppercase', margin: '0 0 6px' }}>TÉCNICO ASIGNADO</p>
                  <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-dark)' }}>{techName}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-mid)', margin: '2px 0 0' }}>ID: PTEC-0041 • ★ 4.9</p>
                </div>
              </div>

              {/* Checklist de Actividades (RF-62) */}
              <div>
                <h5 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-mid)', textTransform: 'uppercase', marginBottom: 10 }}>
                  Gestión de Labores e Imprevistos
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {activities.map((act, idx) => (
                    <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: '#F7F8F9', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={act.done} onChange={() => toggleActivity(idx)} />
                      <span style={{ textDecoration: act.done ? 'line-through' : 'none', color: act.done ? '#667085' : '#0C1C40' }}>{act.text}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'evidencias' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h5 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-mid)', textTransform: 'uppercase', margin: 0 }}>
                  Galería de Fotos y Evidencias de Trabajo
                </h5>
                <Button size="sm" onClick={handleAddEvidence}>
                  <Plus size={13} /> AGREGAR FOTO
                </Button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
                {evidences.map((url, idx) => (
                  <div key={idx} style={{ position: 'relative', border: '1px solid #E6E9EE', borderRadius: 8, overflow: 'hidden', background: '#F7F8F9' }}>
                    <img src={url} alt={`Evidencia ${idx + 1}`} style={{ width: '100%', height: 130, objectFit: 'cover' }} />
                    <button
                      onClick={() => setSelectedImage(url)}
                      style={{ position: 'absolute', bottom: 8, right: 8, padding: '4px 8px', fontSize: 11, background: 'rgba(15,23,42,0.8)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Eye size={11} /> Inspeccionar
                    </button>
                  </div>
                ))}
              </div>

              {selectedImage && (
                <div className="doc-preview-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <strong style={{ fontSize: 13 }}>Lupa de Inspección de Evidencia</strong>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }} onClick={() => setSelectedImage(null)}>✕ Cerrar Lupa</button>
                  </div>
                  <img src={selectedImage} alt="Evidencia Ampliada" className="doc-img" />
                </div>
              )}
            </div>
          )}

          {activeTab === 'rating' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h5 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-mid)', textTransform: 'uppercase', margin: 0 }}>
                Sistema de Calificación Bidireccional
              </h5>

              <div style={{ padding: 16, border: '1px solid #E6E9EE', borderRadius: 8, background: '#F7F8F9' }}>
                <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>Evaluación del Cliente sobre el Técnico</p>
                <div style={{ display: 'flex', gap: 4, marginBottom: 8, color: '#F2A91E' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star key={star} size={18} fill={star <= clientRating ? '#F2A91E' : 'none'} onClick={() => setClientRating(star)} style={{ cursor: 'pointer' }} />
                  ))}
                </div>
                <p style={{ fontSize: 12, color: '#4B5563', fontStyle: 'italic', margin: 0 }}>"Excelente atención, puntualidad y diagnóstico certero."</p>
              </div>

              <div style={{ padding: 16, border: '1px solid #E6E9EE', borderRadius: 8, background: '#F7F8F9' }}>
                <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>Evaluación del Técnico sobre el Cliente</p>
                <div style={{ display: 'flex', gap: 4, marginBottom: 8, color: '#F2A91E' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star key={star} size={18} fill={star <= techRating ? '#F2A91E' : 'none'} onClick={() => setTechRating(star)} style={{ cursor: 'pointer' }} />
                  ))}
                </div>
                <p style={{ fontSize: 12, color: '#4B5563', fontStyle: 'italic', margin: 0 }}>"Trato respetuoso y facilidades de acceso al lugar."</p>
              </div>
            </div>
          )}

          {activeTab === 'acciones' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h5 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-mid)', textTransform: 'uppercase', margin: 0 }}>
                Acciones de Contingencia Operativa
              </h5>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Button variant="outline" size="sm" onClick={() => alert('Solicitud de Reasignación Prioritaria enviada al algoritmo.')}>
                  <RefreshCw size={13} /> Reasignación Prioritaria
                </Button>
                <Button variant="outline" size="sm" onClick={() => alert('Reporte registrado: El prestador no se presentó.')}>
                  <AlertTriangle size={13} /> Denegación por Inasistencia
                </Button>
                <Button variant="outline" size="sm" style={{ color: 'var(--danger)' }} onClick={() => { setServiceStatus('CANCELADO'); alert('Servicio revocatorio cancelado sin cargos adicionales.'); }}>
                  <XCircle size={13} /> Revocación Total sin Cargos
                </Button>
                <Button variant="outline" size="sm" onClick={() => alert('Labor en ruta abortada exitosamente.')}>
                  <XCircle size={13} /> Abortar Labor en Ruta
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>
            CERRAR DETALLES
          </Button>
          <Button variant="primary" onClick={() => setIsUpdateStatusOpen(true)}>
            <BellRing size={14} /> CAMBIAR ESTADO DEL SERVICIO
          </Button>
        </div>
      </div>

      {/* Modal reactivo de actualización de estado y notificaciones */}
      <UpdateServiceStatusModal
        isOpen={isUpdateStatusOpen}
        onClose={() => setIsUpdateStatusOpen(false)}
        serviceId={serviceId}
        serviceCode={typeof serviceId === 'string' ? serviceId : `SRV-${String(serviceId).padStart(3, '0')}`}
        serviceTitle={title}
        currentStatus={serviceStatus}
        clientName={clientName}
        clientPhone={clientPhone}
        clientEmail={clientEmail}
        onStatusUpdated={(newSt) => {
          setServiceStatus(newSt)
          if (onStatusUpdated) onStatusUpdated(newSt)
        }}
      />
    </div>
  )
}
