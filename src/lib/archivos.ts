import { env } from '../config/env'

// Las URL firmadas del backend llegan como /api/archivos/...; si el panel habla con otro host, se le antepone.
const API_ORIGIN = env.VITE_API_BASE_URL.replace(/\/api\/?$/, '')

export const fileUrl = (path: string) => (/^https?:\/\//.test(path) ? path : `${API_ORIGIN}${path}`)
