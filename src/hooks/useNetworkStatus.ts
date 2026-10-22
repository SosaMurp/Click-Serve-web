import { useState, useEffect } from 'react'

export interface NetworkStatus {
  isOnline: boolean
  isWeak: boolean
  effectiveType?: string
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isWeak: false,
  })

  useEffect(() => {
    const updateStatus = () => {
      const isOnline = navigator.onLine
      // @ts-expect-error networkInformation API
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
      const isWeak = connection ? ['slow-2g', '2g'].includes(connection.effectiveType) : false

      setStatus({
        isOnline,
        isWeak,
        effectiveType: connection?.effectiveType,
      })
    }

    window.addEventListener('online', updateStatus)
    window.addEventListener('offline', updateStatus)

    // @ts-expect-error connection change listener
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    if (connection) {
      connection.addEventListener('change', updateStatus)
    }

    updateStatus()

    return () => {
      window.removeEventListener('online', updateStatus)
      window.removeEventListener('offline', updateStatus)
      if (connection) {
        connection.removeEventListener('change', updateStatus)
      }
    }
  }, [])

  return status
}

