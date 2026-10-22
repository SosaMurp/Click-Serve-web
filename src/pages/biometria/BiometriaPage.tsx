import { useEffect, useRef, useState } from 'react'
import { Fingerprint, RefreshCw } from 'lucide-react'
import { Button } from '@components/ui'
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
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '48px 24px' }}>
      <Fingerprint size={36} aria-hidden="true" />
      <h1>Verificación biométrica</h1>
      <p>Solicita un desafío para que el adaptador OpenCV procese la captura facial de forma segura.</p>
      {!verification ? (
        <Button onClick={requestVerification} loading={loading}>INICIAR VERIFICACIÓN</Button>
      ) : (
        <>
          <label>
            Rostro de referencia
            <input type="file" accept="image/*" onChange={event => setReference(event.target.files?.[0] || null)} />
          </label>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', marginTop: 16 }} />
          <p>Estado: <strong>{verification.estado}</strong></p>
          <p>Proveedor: {verification.proveedor}</p>
          {!cameraActive && <Button onClick={startCamera}>ACTIVAR CÁMARA</Button>}
          {cameraActive && <Button onClick={captureLiveAndCompare} loading={loading} disabled={!reference}>
            <Fingerprint size={14} /> CAPTURAR Y COMPARAR
          </Button>}
          <Button variant="outline" onClick={refreshStatus} loading={loading}>
            <RefreshCw size={14} /> ACTUALIZAR ESTADO
          </Button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
