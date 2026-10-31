import { useState } from 'react'
import { X, FileText, Download, AlertTriangle, Eye, Trash2, ShieldOff, ShieldCheck, ExternalLink, Send } from 'lucide-react'
import { Badge, Button } from '@components/ui'
import { env } from '../../config/env'
import {
  useExpediente, useSuspendUser, useReactivateUser, useDeleteUser, descargarExpediente,
} from '../../hooks/useAdminQueries'
import MensajeModal from './MensajeModal'
import './modals.css'

// Expediente real de la cuenta (RF-20, RF-31, RF-36) y acciones del administrador (RF-16, RF-17, RF-32, RF-33).
interface TechProfileModalProps {
  isOpen: boolean
  onClose: () => void
  /** id_usuario de la cuenta a revisar */
  userId: number | null
}

const DOC_LABEL: Record<string, string> = {
  INE_FRENTE: 'INE (frente)',
  INE_REVERSO: 'INE (reverso)',
  ROSTRO: 'Foto de rostro',
  CEDULA: 'Cédula profesional',
  CERTIFICACION: 'Certificación',
  COMPROBANTE_DOMICILIO: 'Comprobante de domicilio',
  ANTECEDENTES: 'Carta de antecedentes',
}
const DOC_VARIANT = { APROBADO: 'success', RECHAZADO: 'danger', EN_REVISION: 'warning' } as const

// Las URL firmadas vienen como /api/archivos/...; si el panel habla con otro host, se le antepone.
const API_ORIGIN = env.VITE_API_BASE_URL.replace(/\/api\/?$/, '')
const fileUrl = (path: string) => (path.startsWith('http') ? path : `${API_ORIGIN}${path}`)
const fecha = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
const errorDe = (err: unknown) => (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'No se pudo completar la acción.'

export default function TechProfileModal({ isOpen, onClose, userId }: TechProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'perfil' | 'documentos' | 'acciones'>('perfil')
  const [preview, setPreview] = useState<{ nombre: string; url: string } | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [escribiendo, setEscribiendo] = useState(false)
  const [password, setPassword] = useState('')
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const { data: exp, isLoading, isError, refetch } = useExpediente(isOpen ? userId : null)
  const suspend = useSuspendUser()
  const reactivate = useReactivateUser()
  const remove = useDeleteUser()

  if (!isOpen) return null

  const nombre = exp ? `${exp.nombre} ${exp.apellido}` : 'Cargando…'
  const estado = (exp?.estado_cuenta || '').toUpperCase()
  const suspendido = estado === 'SUSPENDIDO'
  const esTecnico = exp?.id_rol === 2

  const accion = async (fn: () => Promise<unknown>, ok: string) => {
    setMensaje(null)
    try {
      await fn()
      setMensaje({ tipo: 'ok', texto: ok })
    } catch (err) {
      setMensaje({ tipo: 'error', texto: errorDe(err) })
    }
  }

  const eliminar = async () => {
    if (!userId) return
    setMensaje(null)
    try {
      await remove.mutateAsync({ id: userId, password })
      onClose()
    } catch (err) {
      setMensaje({ tipo: 'error', texto: errorDe(err) })
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-container--lg modal-container--fixed fade-in">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">{esTecnico ? 'Expediente del técnico' : 'Expediente de la cuenta'}</h3>
            <p className="modal-subtitle">ID-{userId} · {nombre}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-tabs">
          {([['perfil', 'PERFIL E IDENTIDAD'], ['documentos', 'DOCUMENTOS'], ['acciones', 'ADMINISTRACIÓN Y BAJA']] as const).map(([k, label]) => (
            <button key={k} className={`modal-tab-btn ${activeTab === k ? 'modal-tab-btn--active' : ''}`} onClick={() => setActiveTab(k)}>
              {label}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {isLoading && <p style={{ color: 'var(--text-mid)' }}>Cargando expediente…</p>}
          {isError && (
            <p style={{ color: 'var(--danger)' }}>
              No se pudo cargar el expediente. <button className="sop-view-btn" onClick={() => refetch()}>REINTENTAR</button>
            </p>
          )}

          {exp && activeTab === 'perfil' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', background: 'var(--bg-sunk)', padding: 16, borderRadius: 12 }}>
                {exp.foto_url ? (
                  <img src={fileUrl(exp.foto_url)} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--navy)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800 }}>
                    {exp.nombre[0]}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h4 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{nombre}</h4>
                    <Badge variant={suspendido ? 'danger' : exp.identidad_verificada ? 'success' : 'warning'}>
                      {suspendido ? 'SUSPENDIDO' : exp.identidad_verificada ? 'VERIFICADO' : estado || 'PENDIENTE'}
                    </Badge>
                    {exp.verificado_sep && <Badge variant="info">CÉDULA SEP</Badge>}
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-mid)' }}>
                    {exp.correo} · {exp.telefono || 'Sin teléfono'} · Registro: {fecha(exp.fecha_registro)}
                  </p>
                </div>
              </div>

              {esTecnico && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {[
                    ['Calificación', exp.calificacion ? `${exp.calificacion} ★` : 'Sin reseñas'],
                    ['Trabajos finalizados', String(exp.trabajos)],
                    ['Cancelados', String(exp.cancelados)],
                  ].map(([l, v]) => (
                    <div key={l} style={{ border: '1px solid var(--border-light)', borderRadius: 12, padding: 14 }}>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-mid)' }}>{l}</p>
                      <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700 }}>{v}</p>
                    </div>
                  ))}
                </div>
              )}

              {esTecnico && (
                <div>
                  <p className="field-label" style={{ marginBottom: 8 }}>Especialidades</p>
                  {exp.especialidades.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--text-mid)', margin: 0 }}>Todavía no registra especialidades.</p>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {exp.especialidades.map(e => (
                        <Badge key={e.id_especialidad} variant={e.activa ? 'success' : 'neutral'}>
                          {e.nombre}{e.activa ? '' : ' (alertas apagadas)'}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {exp.bio && <p style={{ fontSize: 14, margin: 0, whiteSpace: 'pre-wrap' }}>{exp.bio}</p>}
              {exp.motivo_rechazo && (
                <p style={{ fontSize: 13, margin: 0, color: 'var(--danger-ink)' }}>
                  Último rechazo ({fecha(exp.fecha_revision)}): {exp.motivo_rechazo}
                </p>
              )}
            </div>
          )}

          {exp && activeTab === 'documentos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {exp.documentos.length === 0 && <p style={{ color: 'var(--text-mid)', margin: 0 }}>La cuenta no ha subido documentos.</p>}
              {exp.documentos.map(d => (
                <div key={d.id_documento} style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--border-light)', borderRadius: 12, padding: 12 }}>
                  <FileText size={18} color="var(--navy)" />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{DOC_LABEL[d.tipo] ?? d.tipo}{d.numero ? ` · ${d.numero}` : ''}</p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-mid)' }}>{d.descripcion || 'Sin descripción'} · {fecha(d.fecha_creacion)}</p>
                  </div>
                  <Badge variant={DOC_VARIANT[d.estado] ?? 'neutral'}>{d.estado.replace('_', ' ')}</Badge>
                  {d.url && (
                    <Button size="sm" variant="outline" onClick={() => setPreview({ nombre: DOC_LABEL[d.tipo] ?? d.tipo, url: fileUrl(d.url!) })}>
                      <Eye size={13} /> VER
                    </Button>
                  )}
                </div>
              ))}
              {preview && (
                <div style={{ border: '1px solid var(--border-light)', borderRadius: 12, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <strong style={{ fontSize: 13 }}>{preview.nombre}</strong>
                    <span style={{ display: 'flex', gap: 8 }}>
                      <a href={preview.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent-ink)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ExternalLink size={12} /> Abrir aparte
                      </a>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }} onClick={() => setPreview(null)}>✕ Cerrar</button>
                    </span>
                  </div>
                  {/* El enlace firmado dura 5 minutos (RNF-26); si vence, se vuelve a pedir el expediente */}
                  <img src={preview.url} alt={preview.nombre} style={{ maxWidth: '100%', maxHeight: 360, display: 'block', margin: '0 auto', borderRadius: 8 }}
                    onError={() => { setPreview(null); refetch() }} />
                </div>
              )}
            </div>
          )}

          {exp && activeTab === 'acciones' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {mensaje && (
                <p style={{ margin: 0, fontSize: 13, color: mensaje.tipo === 'ok' ? 'var(--success)' : 'var(--danger-ink)' }}>{mensaje.texto}</p>
              )}

              <div style={{ border: '1px solid var(--border-light)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <h5 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Descargar expediente</h5>
                  <p style={{ fontSize: 12, color: 'var(--text-mid)', margin: '2px 0 0' }}>Datos, documentos, especialidades, servicios y calificaciones (sin contraseña).</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => userId && accion(() => descargarExpediente(userId), 'Expediente descargado.')}>
                  <Download size={13} /> DESCARGAR
                </Button>
              </div>

              <div style={{ border: '1px solid var(--border-light)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <h5 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Enviar mensaje</h5>
                  <p style={{ fontSize: 12, color: 'var(--text-mid)', margin: '2px 0 0' }}>Un aviso personalizado por notificación de la app o por correo.</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setEscribiendo(true)}>
                  <Send size={13} /> ESCRIBIR
                </Button>
              </div>

              <div style={{ border: '1px solid var(--border-light)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <h5 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{suspendido ? 'Cuenta suspendida' : 'Suspender cuenta'}</h5>
                  <p style={{ fontSize: 12, color: 'var(--text-mid)', margin: '2px 0 0' }}>
                    {suspendido
                      ? 'No puede iniciar sesión en la app. Al reactivarla recupera su estatus anterior.'
                      : 'Cierra todas sus sesiones al momento y le impide volver a entrar a la app.'}
                  </p>
                </div>
                {suspendido ? (
                  <Button variant="primary" size="sm" loading={reactivate.isPending}
                    onClick={() => userId && accion(() => reactivate.mutateAsync(userId), 'Cuenta reactivada.')}>
                    <ShieldCheck size={13} /> REACTIVAR
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" loading={suspend.isPending} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                    onClick={() => userId && accion(() => suspend.mutateAsync(userId), 'Cuenta suspendida y sesiones cerradas.')}>
                    <ShieldOff size={13} /> SUSPENDER
                  </Button>
                )}
              </div>

              <div style={{ border: '1px solid var(--danger-soft)', background: 'var(--danger-soft)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AlertTriangle size={18} color="var(--danger)" />
                  <div style={{ flex: 1 }}>
                    <h5 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--danger-ink)' }}>Baja definitiva</h5>
                    <p style={{ fontSize: 12, color: 'var(--danger-ink)', margin: '2px 0 0' }}>
                      Anonimiza sus datos personales y conserva los registros financieros sin identidad. No se puede deshacer.
                    </p>
                  </div>
                  {!showDeleteConfirm && (
                    <Button size="sm" style={{ background: 'var(--danger)', color: '#fff' }} onClick={() => setShowDeleteConfirm(true)}>
                      <Trash2 size={13} /> DAR DE BAJA
                    </Button>
                  )}
                </div>
                {showDeleteConfirm && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                    <input type="password" className="field-input" placeholder="Tu contraseña de administrador"
                      value={password} onChange={e => setPassword(e.target.value)} style={{ flex: 1 }} />
                    <Button size="sm" style={{ background: 'var(--danger)', color: '#fff' }} loading={remove.isPending} disabled={!password} onClick={eliminar}>
                      CONFIRMAR BAJA
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowDeleteConfirm(false); setPassword('') }}>CANCELAR</Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {escribiendo && userId != null && <MensajeModal userId={userId} nombre={nombre} onClose={() => setEscribiendo(false)} />}
    </div>
  )
}
