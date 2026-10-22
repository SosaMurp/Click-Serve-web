import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/axios'
import type {
  UsuarioRow,
  ExpedienteTecnicoRow,
  SolicitudRetiroRow,
  DisputaRow,
  ConfiguracionPlataformaRow,
  UpdateSettingsPayload,
  RejectTechnicianPayload,
} from '../types/api'

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

export function useVerifications(status?: string) {
  return useQuery({
    queryKey: ['admin-verifications', status],
    queryFn: async () => {
      const { data } = await api.get<ExpedienteTecnicoRow[] | { expedientes: ExpedienteTecnicoRow[] }>('/admin/verifications', {
        params: { status },
      })
      return Array.isArray(data) ? data : data.expedientes
    },
  })
}

export function useApproveTechnician() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/admin/verifications/${id}/approve`)
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
      const { data } = await api.post(`/admin/verifications/${id}/reject`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-verifications'] })
    },
  })
}

// ── FINANZAS Y TESORERÍA (RF-66 A RF-83) ──

export function useWithdrawals(status?: string) {
  return useQuery({
    queryKey: ['admin-withdrawals', status],
    queryFn: async () => {
      const { data } = await api.get<SolicitudRetiroRow[] | { retiros: SolicitudRetiroRow[] }>('/admin/withdrawals', {
        params: { status },
      })
      return Array.isArray(data) ? data : data.retiros
    },
  })
}

export function useApproveWithdrawal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/admin/withdrawals/${id}/approve`)
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

// ── PARÁMETROS DEL SISTEMA (RF-84 A RF-99) ──

export function usePlatformSettings() {
  return useQuery({
    queryKey: ['platform-settings'],
    queryFn: async () => {
      const { data } = await api.get<ConfiguracionPlataformaRow[] | ConfiguracionPlataformaRow | { configuracion: ConfiguracionPlataformaRow }>('/settings')
      return (Array.isArray(data) ? data[0] : ('configuracion' in data ? data.configuracion : data)) as ConfiguracionPlataformaRow
    },
  })
}

export function useUpdatePlatformSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: UpdateSettingsPayload) => {
      const { data } = await api.put('/settings', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-settings'] })
    },
  })
}
