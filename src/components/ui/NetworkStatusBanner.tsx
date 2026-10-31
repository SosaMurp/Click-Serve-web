import { WifiOff, AlertTriangle } from 'lucide-react'
import { useNetworkStatus } from '../../hooks/useNetworkStatus'

export function NetworkStatusBanner() {
  const { isOnline, isWeak } = useNetworkStatus()

  if (isOnline && !isWeak) return null

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        zIndex: 999999,
        background: !isOnline ? '#D92D20' : '#7A4F00',
        color: '#ffffff',
        padding: '8px 16px',
        fontSize: '12px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        animation: 'slideDown 0.3s ease-out'
      }}
    >
      {!isOnline ? (
        <>
          <WifiOff size={15} />
          <span>SIN CONEXIÓN A INTERNET — FUNCIONALIDAD LIMITADA</span>
        </>
      ) : (
        <>
          <AlertTriangle size={15} />
          <span>SEÑAL DE RED DÉBIL DETECTADA — LAS OPERACIONES PUEDEN DEMORAR</span>
        </>
      )}
    </div>
  )
}

