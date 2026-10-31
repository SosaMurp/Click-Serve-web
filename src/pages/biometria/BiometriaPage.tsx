import { useEffect, useRef, useState } from 'react'
import { Fingerprint, RefreshCw } from 'lucide-react'
import { Badge, Button } from '@components/ui'
import { compareBiometricImages, getBiometricVerification, requestBiometricVerification } from '@api/biometrics'

export default function BiometriaPage() {
  const [verification, setVerification] = useState<Awaited<ReturnType<typeof requestBiometricVerification>> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reference, setReference] = useState<Blob | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => () => streamRef.current?.getTracks().forEach(track => track.stop()), [])

  const requestVerification = async () => {
    setLoading(true)
    setError('')
    try {
      setVerification(await requestBiometricVerification())
    } catch {
      setError('No se pudo iniciar la verificación biométrica.')
    } finally {
      setLoading(false)
    }
  }

  const refreshStatus = async () => {
    if (!verification) return
    setLoading(true)
    try {
      setVerification(await getBiometricVerification(verification.id_verificacion))
    } catch {
      setError('No se pudo consultar el estado de la verificación.')
    } finally {
      setLoading(false)
    }
  }

  const startCamera = async () => {
    setError('')
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      if (videoRef.current) videoRef.current.srcObject = streamRef.current
      setCameraActive(true)
    } catch {
      setError('No se pudo acceder a la cámara. Revisa los permisos del navegador.')
    }
  }

  const captureLiveAndCompare = async () => {
    if (!verification || !reference || !videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0)
    const live = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (!live) return

    setLoading(true)
    try {
      await compareBiometricImages(verification.id_verificacion, reference, live)
      await refreshStatus()
      streamRef.current?.getTracks().forEach(track => track.stop())
      setCameraActive(false)
    } catch {
      setError('No se pudo comparar la captura facial.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dash-page fade-in">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Verificación biométrica</h1>
          <p className="dash-page-sub">Compara el rostro de una persona con su foto de referencia</p>
        </div>
      </div>

      <div className="dash-card" style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!verification ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="cfg-icon cfg-icon--navy"><Fingerprint size={16} aria-hidden="true" /></span>
              <p style={{ fontSize: 13.5, color: 'var(--text-mid)' }}>
                Solicita un desafío de verificación; después sube la foto de referencia y toma una captura con la cámara.
              </p>
            </div>
            <div><Button onClick={requestVerification} loading={loading}>INICIAR VERIFICACIÓN</Button></div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Badge variant="info">{verification.estado}</Badge>
              <span className="dash-table-id">Proveedor: {verification.proveedor}</span>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="bio-ref">Rostro de referencia</label>
              <input id="bio-ref" className="field-input" type="file" accept="image/*"
                onChange={event => setReference(event.target.files?.[0] || null)} />
            </div>
            <video ref={videoRef} autoPlay playsInline muted
              style={{ width: '100%', borderRadius: 12, background: 'var(--bg-sunk)', display: cameraActive ? 'block' : 'none' }} />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {!cameraActive && <Button onClick={startCamera}>ACTIVAR CÁMARA</Button>}
              {cameraActive && (
                <Button onClick={captureLiveAndCompare} loading={loading} disabled={!reference}>
                  <Fingerprint size={14} /> CAPTURAR Y COMPARAR
                </Button>
              )}
              <Button variant="outline" onClick={refreshStatus} loading={loading}>
                <RefreshCw size={14} /> ACTUALIZAR ESTADO
              </Button>
            </div>
          </>
        )}
        {error && <p role="alert" style={{ fontSize: 13, color: 'var(--danger-ink)' }}>{error}</p>}
      </div>
    </div>
  )
}
