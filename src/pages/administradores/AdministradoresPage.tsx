import { useState } from 'react'
import { Search, UserPlus, ShieldCheck } from 'lucide-react'
import { Badge } from '@components/ui'
import PageHeader from '@components/ui/PageHeader'
import TechProfileModal from '@components/modals/TechProfileModal'
import CoAdminModal from '@components/modals/CoAdminModal'
import { useAdminUsers } from '../../hooks/useAdminQueries'

const fecha = (iso: string | null, conHora = false) =>
  iso
    ? new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', ...(conHora ? { hour: '2-digit', minute: '2-digit' } : {}) })
    : '—'

/**
 * Cuentas con acceso al panel. Va aparte de técnicos y clientes: son quienes administran la plataforma,
 * y solo desde aquí se da de alta a otro administrador.
 */
export default function AdministradoresPage() {
  const [search, setSearch] = useState('')
  const [nuevoOpen, setNuevoOpen] = useState(false)
  const [perfilId, setPerfilId] = useState<number | null>(null)
  const { data, isLoading, isError } = useAdminUsers({ role: '3' })

  const filas = (data ?? []).map(u => {
    const estado = (u.estado_cuenta || '').toUpperCase()
    const suspendido = estado === 'SUSPENDIDO' || estado === 'RECHAZADO'
    const pendiente = u.debe_cambiar_contrasena === true
    return {
      id: u.id_usuario,
      nombre: `${u.nombre} ${u.apellido}`.trim(),
      correo: u.correo,
      telefono: u.telefono,
      alta: u.fecha_registro ?? null,
      ultima: u.ultima_conexion ?? null,
      estado: suspendido ? 'Suspendido' : pendiente ? 'Pendiente de activar' : 'Activo',
      tono: (suspendido ? 'danger' : pendiente ? 'warning' : 'success') as 'danger' | 'warning' | 'success',
    }
  })
  const q = search.trim().toLowerCase()
  const visibles = q
    ? filas.filter(f => f.nombre.toLowerCase().includes(q) || (f.correo ?? '').toLowerCase().includes(q) || `adm-${f.id}`.includes(q))
    : filas

  return (
    <div className="tec-page fade-in">
      <PageHeader title="Administradores" sub="Personas con acceso a este panel">
        <button type="button" className="fin-approve-batch" onClick={() => setNuevoOpen(true)}>
          <UserPlus size={14} aria-hidden /> Nuevo coadministrador
        </button>
      </PageHeader>

      <p className="adm-note">
        <ShieldCheck size={16} aria-hidden />
        Un coadministrador recibe una contraseña temporal por correo y debe cambiarla en su primer acceso.
      </p>

      <div className="val-toolbar">
        <div className="val-search">
          <Search size={14} aria-hidden />
          <input type="search" aria-label="Buscar administradores" placeholder="Buscar por nombre o correo…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <p role="status" style={{ padding: '2rem', textAlign: 'center', margin: 0 }}>Cargando administradores…</p>
        ) : isError ? (
          <p role="alert" style={{ padding: '2rem', textAlign: 'center', margin: 0, color: 'var(--danger-ink)' }}>
            No se pudieron cargar los administradores. Revisa tu conexión y vuelve a abrir la sección.
          </p>
        ) : (
          <div className="table-scroll"><table className="dash-table tec-table">
            <thead>
              <tr>
                <th>Administrador</th>
                <th>Alta</th>
                <th>Estado</th>
                <th>Última conexión</th>
                <th><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 && (
                <tr><td colSpan={5} className="table-empty">{q ? 'Ningún administrador coincide con la búsqueda.' : 'No hay administradores registrados.'}</td></tr>
              )}
              {visibles.map(f => (
                <tr key={f.id}>
                  <td>
                    <div className="val-tech-cell">
                      <div className="tec-avatar tec-avatar--admin">{f.nombre[0]}</div>
                      <div>
                        <p className="dash-table-name">{f.nombre}</p>
                        <p className="dash-table-id">{f.correo}{f.telefono && <> · {f.telefono}</>}</p>
                      </div>
                    </div>
                  </td>
                  <td><span className="dash-table-id">{fecha(f.alta)}</span></td>
                  <td><Badge variant={f.tono}>{f.estado}</Badge></td>
                  <td><span className="dash-table-id">{f.ultima ? fecha(f.ultima, true) : 'Nunca'}</span></td>
                  <td><button type="button" className="tec-action-btn" onClick={() => setPerfilId(f.id)}>Ver perfil</button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        <div className="tec-pagination">
          <p className="tec-page-info">{visibles.length} de {filas.length} administradores</p>
        </div>
      </div>

      <TechProfileModal isOpen={perfilId != null} onClose={() => setPerfilId(null)} userId={perfilId} />
      <CoAdminModal isOpen={nuevoOpen} onClose={() => setNuevoOpen(false)} />
    </div>
  )
}
