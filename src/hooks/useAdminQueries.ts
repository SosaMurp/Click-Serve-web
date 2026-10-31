import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { appApi } from '../api/axios'
import type {
  UsuarioRow,
  ExpedienteTecnicoRow,
  SolicitudRetiroRow,
  DisputaRow,
  ConfiguracionPlataformaRow,
  UpdateSettingsPayload,
  RejectTechnicianPayload,
  TecnicoAppRow,
  RetiroAppRow,
  IncidenciaRow,
  UpdateIncidenciaPayload,
} from '../types/api'

// Técnicos, retiros, incidencias y configuración se leen del backend de la app móvil (appApi):
// son los mismos datos que generan clientes y técnicos. El directorio de usuarios sigue en el backend del panel (api).

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
      const { data } = await appApi.get<{ tecnicos: TecnicoAppRow[] }>('/admin/tecnicos', { params: { estado } })
      return data.tecnicos.map(toExpediente)
    },
  })
}

export function useApproveTechnician() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await appApi.patch(`/admin/usuarios/${id}/aprobar`)
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
      const { data } = await appApi.patch(`/admin/usuarios/${id}/rechazar`, {
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
      const { data } = await appApi.get<{ retiros: RetiroAppRow[] }>('/admin/retiros', { params: { estado } })
      return data.retiros.map(toSolicitudRetiro)
    },
  })
}

export function useApproveWithdrawal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await appApi.post<{ mensaje: string; folio: string }>(`/admin/retiros/${id}/aprobar`)
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
      const { data } = await appApi.post<{ mensaje: string; folio: string }>(`/admin/retiros/${id}/rechazar`, { motivo })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-withdrawals'] })
    },
  })
}

export function useDisputes(status?: string) {
  return useQuery({
    queryKey: ['admin-disputes', status],
    queryFn: async () => {
      const { data } = await api.get<DisputaRow[] | { disputas: DisputaRow[] }>('/admin/disputes', {
        params: { status },
      })
      return Array.isArray(data) ? data : data.disputas
    },
  })
}

// ── INCIDENCIAS REPORTADAS EN LA APP (RF-114, RF-118, RF-121) ──

export function useIncidencias(estado?: 'ABIERTA' | 'RESUELTA') {
  return useQuery({
    queryKey: ['admin-incidencias', estado],
    queryFn: async () => {
      const { data } = await appApi.get<{ incidencias: IncidenciaRow[] }>('/admin/incidencias', { params: { estado } })
      return data.incidencias
    },
    refetchInterval: 30_000,
  })
}

export function useUpdateIncidencia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: UpdateIncidenciaPayload }) => {
      const { data } = await appApi.patch<{ mensaje: string; incidencia: IncidenciaRow }>(`/admin/incidencias/${id}`, payload)
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
      const { data } = await appApi.get<{ configuracion: ConfiguracionPlataformaRow }>('/admin/configuracion')
      return data.configuracion
    },
  })
}

export function useUpdatePlatformSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: UpdateSettingsPayload) => {
      const { data } = await appApi.put('/admin/configuracion', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-settings'] })
    },
  })
}
