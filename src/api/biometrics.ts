import api from './axios'

export interface BiometricVerification {
  id_verificacion: string
  desafio: string
  proveedor: string
  estado: 'solicitada' | 'procesando' | 'APROBADO' | 'RECHAZADO' | 'expirada'
  resultado?: Record<string, unknown> | null
  fecha_expiracion: string
}

export async function requestBiometricVerification(): Promise<BiometricVerification> {
  const { data } = await api.post<{ verificacion: BiometricVerification }>('/biometria/solicitar')
  return data.verificacion
}

export async function getBiometricVerification(id: string): Promise<BiometricVerification> {
  const { data } = await api.get<{ verificacion: BiometricVerification }>(`/biometria/${id}`)
  return data.verificacion
}

export async function compareBiometricImages(id: string, reference: Blob, live: Blob) {
  const form = new FormData()
  form.append('reference_image', reference, 'reference.jpg')
  form.append('live_image', live, 'live.jpg')
  const { data } = await api.post(`/biometria/${id}/compare`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data as { match: boolean; estado: 'APROBADO' | 'RECHAZADO'; distance: number; confidence: number }
}
