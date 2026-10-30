import { useState } from 'react'
import { X, Shield, FileText, CheckCircle2, Download, AlertTriangle, User, Award, Eye, Trash2 } from 'lucide-react'
import { Badge, Button } from '@components/ui'
import './modals.css'

interface TechProfileModalProps {
  isOpen: boolean
  onClose: () => void
  techData?: {
    id: string
    name: string
    email?: string
    phone?: string
    specialty: string
    status: string
    rating?: number | null
    jobs?: string | null
  }
}

export default function TechProfileModal({ isOpen, onClose, techData }: TechProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'perfil' | 'documentos' | 'habilidades' | 'acciones'>('perfil')
  const [disponible, setDisponible] = useState(true)
  const [categories, setCategories] = useState({
    hardware: true,
    redes: true,
    desarrollo: false,
    mantenimiento: true,
  })
  const [skills, setSkills] = useState(['Mantenimiento de Redes', 'Reparación de Laptops', 'Diagnóstico de Hardware'])
  const [newSkill, setNewSkill] = useState('')
  const [statusState, setStatusState] = useState(techData?.status || 'ACTIVO')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null)

  if (!isOpen) return null

  const techName = techData?.name || 'Roberto García'
  const techId = techData?.id || 'PTEC-0041'
  const techSpec = techData?.specialty || 'Soporte y Hardware'

  const handleAddSkill = () => {
    if (newSkill.trim()) {
      setSkills([...skills, newSkill.trim()])
      setNewSkill('')
    }
  }

  const handleExportExpediente = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      id: techId,
      nombre: techName,
      especialidad: techSpec,
      habilidades: skills,
      estatus: statusState,
      fecha_exportacion: new Date().toISOString()
    }, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", `Expediente_${techId}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  const handleDeleteAccount = () => {
    if (!confirmPassword) {
      alert('Debes ingresar tu contraseña para confirmar la baja definitiva de la cuenta.')
      return
    }
    alert(`La cuenta de ${techName} (${techId}) ha sido dada de baja definitivamente.`)
    setShowDeleteConfirm(false)
    onClose()
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-container--lg modal-container--fixed fade-in">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">Expediente Técnico Operativo</h3>
            <p className="modal-subtitle">{techId} • NODO LÁZARO CÁRDENAS</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="modal-tabs">
          <button
            className={`modal-tab-btn ${activeTab === 'perfil' ? 'modal-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('perfil')}
          >
            PERFIL E IDENTIDAD
          </button>
          <button
            className={`modal-tab-btn ${activeTab === 'documentos' ? 'modal-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('documentos')}
          >
            DOCUMENTOS Y CÉDULA
          </button>
          <button
            className={`modal-tab-btn ${activeTab === 'habilidades' ? 'modal-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('habilidades')}
          >
            PORTAFOLIO Y HABILIDADES
          </button>
          <button
            className={`modal-tab-btn ${activeTab === 'acciones' ? 'modal-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('acciones')}
          >
            ADMINISTRACIÓN Y BAJA
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {activeTab === 'perfil' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Header Info Card */}
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', background: '#F7F8F9', padding: 16, borderRadius: 8 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--text-dark)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800 }}>
                  {techName[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h4 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-dark)' }}>{techName}</h4>
                    <Badge variant={statusState === 'ACTIVO' ? 'success' : statusState === 'SUSPENDIDO' ? 'danger' : 'warning'}>
                      {statusState}
                    </Badge>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-mid)', margin: '4px 0 0' }}>{techSpec} • Lázaro Cárdenas</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 11, color: 'var(--text-mid)', margin: 0 }}>DISPONIBILIDAD EN TIEMPO REAL</p>
                  <label className="cfg-toggle" style={{ marginTop: 6 }}>
                    <input type="checkbox" checked={disponible} onChange={e => setDisponible(e.target.checked)} />
                    <span className="cfg-toggle-track" />
                  </label>
                </div>
              </div>

              {/* Categorías de Alerta (RF-23) */}
              <div>
                <h5 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-mid)', textTransform: 'uppercase', marginBottom: 10 }}>
                  Recepción de Alertas por Categoría
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F7F8F9', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
                    <span>Soporte y Hardware</span>
                    <input type="checkbox" checked={categories.hardware} onChange={e => setCategories({...categories, hardware: e.target.checked})} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F7F8F9', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
                    <span>Redes y Conectividad</span>
                    <input type="checkbox" checked={categories.redes} onChange={e => setCategories({...categories, redes: e.target.checked})} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F7F8F9', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
                    <span>Desarrollo Web</span>
                    <input type="checkbox" checked={categories.desarrollo} onChange={e => setCategories({...categories, desarrollo: e.target.checked})} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F7F8F9', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
                    <span>Mantenimiento Preventivo</span>
                    <input type="checkbox" checked={categories.mantenimiento} onChange={e => setCategories({...categories, mantenimiento: e.target.checked})} />
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'documentos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h5 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-mid)', textTransform: 'uppercase', margin: 0 }}>
                Expediente de Credenciales e Identidad
              </h5>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {[
                  { name: 'Cédula Profesional', code: 'CED-9941', status: 'VALIDADA SEP', variant: 'success' as const },
                  { name: 'Identificación INE', code: 'INE-2026', status: 'COMPLETADO', variant: 'success' as const },
                  { name: 'Antecedentes No Penales', code: 'ANP-8812', status: 'EN REVISIÓN', variant: 'warning' as const },
                ].map((doc, idx) => (
                  <div key={idx} style={{ border: '1px solid #E6E9EE', padding: 14, borderRadius: 8, background: '#F7F8F9' }}>
                    <FileText size={20} color="var(--text-mid)" />
                    <p style={{ fontSize: 13, fontWeight: 700, margin: '8px 0 2px', color: 'var(--text-dark)' }}>{doc.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-mid)', margin: '0 0 10px' }}>{doc.code}</p>
                    <Badge variant={doc.variant}>{doc.status}</Badge>
                    <button
                      onClick={() => setSelectedDoc(doc.name)}
                      style={{ marginTop: 12, width: '100%', padding: '6px', fontSize: 11, fontWeight: 600, background: '#fff', border: '1px solid #CDD3E0', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                    >
                      <Eye size={12} /> Inspeccionar
                    </button>
                  </div>
                ))}
              </div>

              {selectedDoc && (
                <div className="doc-preview-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <strong style={{ fontSize: 13 }}>Vista Previa de Documento: {selectedDoc}</strong>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }} onClick={() => setSelectedDoc(null)}>✕ Cerrar Visor</button>
                  </div>
                  <div style={{ width: '100%', height: 180, background: '#E6E9EE', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#667085', fontSize: 13 }}>
                    [ Muestra de PDF / Archivo digital de {selectedDoc} ]
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'habilidades' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h5 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-mid)', textTransform: 'uppercase', margin: 0 }}>
                Acreditaciones y Habilidades Técnicas
              </h5>

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Agregar nueva habilidad o certificación..."
                  value={newSkill}
                  onChange={e => setNewSkill(e.target.value)}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 6, border: '1px solid #CDD3E0', fontSize: 13 }}
                />
                <Button size="sm" onClick={handleAddSkill}>+ AGREGAR</Button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {skills.map((s, idx) => (
                  <span key={idx} style={{ padding: '6px 12px', background: '#E8EBF2', color: '#0C1C40', borderRadius: 20, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Award size={12} /> {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'acciones' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Exportar Expediente (RF-17) */}
              <div style={{ padding: 16, border: '1px solid #E6E9EE', borderRadius: 8, background: '#F7F8F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h5 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Descarga de Expediente Técnico</h5>
                  <p style={{ fontSize: 12, color: 'var(--text-mid)', margin: '4px 0 0' }}>Genera una copia en respaldo digital con las credenciales y métricas del operador.</p>
                </div>
                <Button variant="secondary" size="sm" onClick={handleExportExpediente}>
                  <Download size={13} /> EXPORTAR EXPEDIENTE
                </Button>
              </div>

              {/* Suspender / Restaurar facultades (RF-32, RF-33) */}
              <div style={{ padding: 16, border: '1px solid #E6E9EE', borderRadius: 8, background: '#F7F8F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h5 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Estatus Operativo del Técnico</h5>
                  <p style={{ fontSize: 12, color: 'var(--text-mid)', margin: '4px 0 0' }}>Interrumpe o restaura los permisos para recibir servicios en la zona LZC.</p>
                </div>
                {statusState === 'SUSPENDIDO' ? (
                  <Button variant="primary" size="sm" onClick={() => setStatusState('ACTIVO')}>
                    <CheckCircle2 size={13} /> RESTAURAR FACULTADES
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => setStatusState('SUSPENDIDO')}>
                    <AlertTriangle size={13} /> SUSPENDER TÉCNICO
                  </Button>
                )}
              </div>

              {/* Baja Definitiva de Cuenta (RF-16) */}
              <div style={{ padding: 16, border: '1px solid #F4C7C2', borderRadius: 8, background: '#FDE8E6' }}>
                <h5 style={{ fontSize: 14, fontWeight: 700, color: '#A41F15', margin: 0 }}>Baja Definitiva de Cuenta</h5>
                <p style={{ fontSize: 12, color: '#7f1d1d', margin: '4px 0 12px' }}>Eliminación o anonimización permanente del usuario. Exige validación obligatoria de clave de seguridad.</p>

                {showDeleteConfirm ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <input
                      type="password"
                      placeholder="Ingresa tu contraseña de Administrador"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #F4C7C2', fontSize: 13 }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button size="sm" style={{ background: '#D92D20', color: '#fff' }} onClick={handleDeleteAccount}>
                        CONFIRMAR ELIMINACIÓN PERMANENTE
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                        CANCELAR
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" style={{ background: '#D92D20', color: '#fff' }} onClick={() => setShowDeleteConfirm(true)}>
                    <Trash2 size={13} /> INICIAR PROTOCOLO DE BAJA
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>
            CERRAR VENTANA
          </Button>
        </div>
      </div>
    </div>
  )
}
