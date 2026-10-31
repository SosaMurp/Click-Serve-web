import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/axios'
import type {
  UsuarioRow,
  ExpedienteTecnicoRow,
  SolicitudRetiroRow,
  ConfiguracionPlataformaRow,
  UpdateSettingsPayload,
  RejectTechnicianPayload,
  TecnicoAppRow,
  RetiroAppRow,
  IncidenciaRow,
  UpdateIncidenciaPayload,
  ExpedienteApp,
  TicketRow,
  TicketDetalle,
  TicketMensaje,
} from '../types/api'

// Todo se lee del backend único (backend/): los mismos datos que generan clientes y técnicos en la app.

// ── USUARIOS Y EXPEDIENTES (RF-18, RF-37, RF-38) ──

export function useAdminUsers(filters?: { role?: string; status?: string; specialty?: string; search?: string }) {
  return useQuery({
    queryKey: ['admin-users', filters],
    queryFn: async () => {
      const { data } = await api.get<UsuarioRow[] | { usuarios: UsuarioRow[] }>('/admin/users', { params: filters })
      return Array.isArray(data) ? data : data.usuarios
    },
  })
}

// Técnicos registrados en la app, adaptados a la forma que ya usa la pantalla de Validaciones.
function toExpediente(t: TecnicoAppRow): ExpedienteTecnicoRow {
  return {
    id_expediente: t.id_usuario,
    id_usuario: t.id_usuario,
    especialidad: (t.especialidades ?? []).join(', '),
    estatus: t.identidad_verificada ? 'Aprobado' : t.estado_cuenta?.toUpperCase() === 'RECHAZADO' ? 'Rechazado' : 'Pendiente',
    fecha_solicitud: t.fecha_registro,
    nombre: t.nombre,
    apellido: t.apellido,
    correo: t.correo,
    telefono: t.telefono,
    estado_cuenta: t.estado_cuenta,
    verificado_sep: t.verificado_sep,
    documentos_pendientes: t.documentos_pendientes,
    metricas: { calificacion: t.calificacion, trabajos: t.trabajos, cancelados: t.cancelados },
  }
}

export function useVerifications(estado: 'pendientes' | 'aprobados' | 'rechazados' | 'suspendidos' | 'todos' = 'pendientes') {
  return useQuery({
    queryKey: ['admin-verifications', estado],
    queryFn: async () => {
      const { data } = await api.get<{ tecnicos: TecnicoAppRow[] }>('/admin/tecnicos', { params: { estado } })
      return data.tecnicos.map(toExpediente)
    },
  })
}

export function useApproveTechnician() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.patch(`/admin/usuarios/${id}/aprobar`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-verifications'] })
      qc.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })
}

export function useRejectTechnician() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: RejectTechnicianPayload }) => {
      const { data } = await api.patch(`/admin/usuarios/${id}/rechazar`, {
        motivo: payload.motivoRechazo,
        bloquear: payload.bloquearUsuario,
      })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-verifications'] })
      qc.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })
}

// ── FINANZAS Y TESORERÍA (RF-77, RF-78) ──

const ESTADO_RETIRO: Record<string, SolicitudRetiroRow['estado']> = {
  EN_PROCESO: 'Pendiente',
  COMPLETADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
}

// Retiros que los técnicos piden desde la app (tabla transacciones), en la forma que ya usa Finanzas.
function toSolicitudRetiro(r: RetiroAppRow): SolicitudRetiroRow {
  return {
    id_retiro: r.id_transaccion,
    id_usuario: r.id_usuario,
    monto: r.monto,
    clabe: r.clabe_destino ?? '',
    banco: r.banco_destino ?? '',
    estado: ESTADO_RETIRO[r.estado] ?? 'Pendiente',
    folio_trx: r.folio,
    fecha_solicitud: r.fecha,
    fecha_procesado: r.fecha_procesado,
    motivo_rechazo: r.motivo_rechazo,
    nombre: r.nombre,
    apellido: r.apellido,
    correo: r.correo,
    telefono: r.telefono,
  }
}

export function useWithdrawals(status?: SolicitudRetiroRow['estado']) {
  const estado = status ? Object.keys(ESTADO_RETIRO).find(k => ESTADO_RETIRO[k] === status) : undefined
  return useQuery({
    queryKey: ['admin-withdrawals', estado],
    queryFn: async () => {
      const { data } = await api.get<{ retiros: RetiroAppRow[] }>('/admin/retiros', { params: { estado } })
      return data.retiros.map(toSolicitudRetiro)
    },
  })
}

export function useApproveWithdrawal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<{ mensaje: string; folio: string }>(`/admin/retiros/${id}/aprobar`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-withdrawals'] })
    },
  })
}

export function useRejectWithdrawal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, motivo }: { id: number; motivo: string }) => {
      const { data } = await api.post<{ mensaje: string; folio: string }>(`/admin/retiros/${id}/rechazar`, { motivo })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-withdrawals'] })
    },
  })
}

// ── INCIDENCIAS REPORTADAS EN LA APP (RF-114, RF-118, RF-121) ──

export function useIncidencias(estado?: 'ABIERTA' | 'RESUELTA') {
  return useQuery({
    queryKey: ['admin-incidencias', estado],
    queryFn: async () => {
      const { data } = await api.get<{ incidencias: IncidenciaRow[] }>('/admin/incidencias', { params: { estado } })
      return data.incidencias
    },
    refetchInterval: 30_000,
  })
}

export function useUpdateIncidencia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: UpdateIncidenciaPayload }) => {
      const { data } = await api.patch<{ mensaje: string; incidencia: IncidenciaRow }>(`/admin/incidencias/${id}`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-incidencias'] })
    },
  })
}

// ── PARÁMETROS DEL SISTEMA (RF-97, RF-99) ──
// La app usa estos valores: comisión, retiro mínimo, radio de búsqueda, minutos para aceptar y mantenimiento.

export function usePlatformSettings() {
  return useQuery({
    queryKey: ['platform-settings'],
    queryFn: async () => {
      const { data } = await api.get<{ configuracion: ConfiguracionPlataformaRow }>('/admin/configuracion')
      return data.configuracion
    },
  })
}

export function useUpdatePlatformSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: UpdateSettingsPayload) => {
      const { data } = await api.put('/admin/configuracion', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-settings'] })
    },
  })
}

// ── EXPEDIENTE Y ACCIONES SOBRE UNA CUENTA (RF-16, RF-17, RF-20, RF-31, RF-32, RF-33) ──

export function useExpediente(id: number | null) {
  return useQuery({
    queryKey: ['admin-expediente', id],
    enabled: id != null,
    queryFn: async () => {
      const { data } = await api.get<{ expediente: ExpedienteApp }>(`/admin/usuarios/${id}/expediente`)
      return data.expediente
    },
  })
}

function useCuentaMutation<T>(fn: (vars: T) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-expediente'] })
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      qc.invalidateQueries({ queryKey: ['admin-verifications'] })
    },
  })
}

export const useSuspendUser = () => useCuentaMutation((id: number) => api.post(`/admin/users/${id}/suspend`))
export const useReactivateUser = () => useCuentaMutation((id: number) => api.post(`/admin/users/${id}/reactivate`))
export const useDeleteUser = () =>
  useCuentaMutation(({ id, password }: { id: number; password: string }) => api.delete(`/admin/users/${id}`, { data: { password } }))

/** Descarga el expediente completo que arma el servidor (RF-17) */
export async function descargarExpediente(id: number) {
  const { data } = await api.get(`/admin/users/${id}/export`)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Expediente_${id}_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// ── COADMINISTRADORES (RF-26) ──

export function useCreateCoAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { nombre: string; apellidos: string; email: string; telefono?: string; password: string }) => {
      const { data } = await api.post<{ mensaje: string }>('/admin/co-admins', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })
}

// ── TICKETS DE SOPORTE (RF-107, RF-115 a RF-120) ──

export function useTickets(estado: 'ACTIVOS' | 'CERRADO') {
  return useQuery({
    queryKey: ['admin-tickets', estado],
    queryFn: async () => {
      const { data } = await api.get<{ tickets: TicketRow[] }>('/admin/soporte/tickets', { params: { estado } })
      return data.tickets
    },
    refetchInterval: 20_000,
  })
}

export function useTicketMensajes(id: number | null) {
  return useQuery({
    queryKey: ['admin-ticket-mensajes', id],
    enabled: id != null,
    queryFn: async () => {
      const { data } = await api.get<{ ticket: TicketDetalle; mensajes: TicketMensaje[] }>(`/admin/soporte/tickets/${id}/mensajes`)
      return data
    },
    refetchInterval: 10_000,
  })
}

export function useResponderTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, mensaje }: { id: number; mensaje: string }) => api.post(`/admin/soporte/tickets/${id}/mensajes`, { mensaje }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ticket-mensajes'] })
      qc.invalidateQueries({ queryKey: ['admin-tickets'] })
    },
  })
}

export function useActualizarTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number; estado?: string; prioridad?: string }) => api.patch(`/admin/soporte/tickets/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ticket-mensajes'] })
      qc.invalidateQueries({ queryKey: ['admin-tickets'] })
    },
  })
}
