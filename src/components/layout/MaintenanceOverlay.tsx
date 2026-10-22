import { AlertTriangle, Lock } from 'lucide-react'
import { Button } from '@components/ui'

interface MaintenanceOverlayProps {
  isActive: boolean
  onDeactivate: () => void
}

export default function MaintenanceOverlay({ isActive, onDeactivate }: MaintenanceOverlayProps) {
  if (!isActive) return null

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 24, textAlign: 'center', color: '#fff'
      }}
    >
      <div
        style={{
          width: 64, height: 64, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444',
          marginBottom: 20
        }}
      >
        <AlertTriangle size={36} />
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 10px', color: '#fff' }}>
        SISTEMA EN MODO MANTENIMIENTO GLOBAL (RF-99)
      </h1>

      <p style={{ fontSize: 14, color: '#94a3b8', maxWidth: 520, lineHeight: 1.6, margin: '0 0 28px' }}>
        El administrador ha activado el protocolo de contingencia. El acceso para técnicos y clientes ha sido suspendido temporalmente. Las operaciones en segundo plano permanecen pausadas.
      </p>

      <Button
        size="lg"
        style={{ background: '#ef4444', color: '#fff', border: 'none' }}
        onClick={onDeactivate}
      >
        <Lock size={16} /> DESACTIVAR MODO MANTENIMIENTO (ADMIN)
      </Button>
    </div>
  )
}

