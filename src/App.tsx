import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { setNavigate } from './lib/navigation'
import { ProtectedRoute, GuestRoute } from '@components/layout/ProtectedRoute'
import { Toaster } from '@components/ui/Toaster'
import { DialogA11y } from '@components/ui/DialogA11y'
import LoginPage from '@pages/auth/LoginPage'
import TwoFactorPage from '@pages/auth/TwoFactorPage'
import RecoverPasswordPage from '@pages/auth/RecoverPasswordPage'
import CambiarContrasenaPage from '@pages/auth/CambiarContrasenaPage'
import RegisterPage from '@pages/auth/RegisterPage'
import RequestSentPage from '@pages/auth/RequestSentPage'
import DashboardLayout from '@components/layout/DashboardLayout'

// Cada sección del panel se descarga al abrirla: Leaflet (mapa) y Recharts (tablero) no se bajan
// en el login ni en las pantallas que no los usan.
const DashboardPage = lazy(() => import('@pages/dashboard/DashboardPage'))
const ValidacionesPage = lazy(() => import('@pages/validaciones/ValidacionesPage'))
const TecnicosPage = lazy(() => import('@pages/tecnicos/TecnicosPage'))
const ServiciosPage = lazy(() => import('@pages/servicios/ServiciosPage'))
const MapaPage = lazy(() => import('@pages/mapa/MapaPage'))
const FinanzasPage = lazy(() => import('@pages/finanzas/FinanzasPage'))
const ConfiguracionPage = lazy(() => import('@pages/configuracion/ConfiguracionPage'))
const PerfilPage = lazy(() => import('@pages/perfil/PerfilPage'))
const SoportePage = lazy(() => import('@pages/soporte/SoportePage'))

/** Registra useNavigate en el helper imperativo para que Axios pueda redirigir */
function NavigationRegistrar() {
  const navigate = useNavigate()
  useEffect(() => { setNavigate(navigate) }, [navigate])
  return null
}

const Cargando = () => (
  <div role="status" aria-live="polite" style={{ padding: 32, fontSize: 13, color: 'var(--text-mid)' }}>Cargando…</div>
)

export default function App() {
  return (
    <BrowserRouter>
      <NavigationRegistrar />
      <DialogA11y />
      <Toaster />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* ── Rutas públicas (solo si NO está autenticado) ── */}
        <Route element={<GuestRoute />}>
          <Route path="/login"         element={<LoginPage />} />
          <Route path="/register"      element={<RegisterPage />} />
          <Route path="/register/sent" element={<RequestSentPage />} />
          <Route path="/verify-2fa"    element={<TwoFactorPage />} />
          <Route path="/recover"       element={<RecoverPasswordPage />} />
        </Route>

        {/* ── Rutas protegidas (requieren JWT válido) ── */}
        <Route element={<ProtectedRoute />}>
          <Route path="cambiar-contrasena" element={<CambiarContrasenaPage />} />
          <Route element={<DashboardLayout />}>
            <Route path="dashboard"      element={<Suspense fallback={<Cargando />}><DashboardPage /></Suspense>} />
            <Route path="validaciones"   element={<Suspense fallback={<Cargando />}><ValidacionesPage /></Suspense>} />
            <Route path="tecnicos"       element={<Suspense fallback={<Cargando />}><TecnicosPage /></Suspense>} />
            <Route path="servicios"     element={<Suspense fallback={<Cargando />}><ServiciosPage /></Suspense>} />
            <Route path="soporte"        element={<Suspense fallback={<Cargando />}><SoportePage /></Suspense>} />
            <Route path="mapa"           element={<Suspense fallback={<Cargando />}><MapaPage /></Suspense>} />
            <Route path="finanzas"       element={<Suspense fallback={<Cargando />}><FinanzasPage /></Suspense>} />
            <Route path="configuracion"  element={<Suspense fallback={<Cargando />}><ConfiguracionPage /></Suspense>} />
            <Route path="perfil"         element={<Suspense fallback={<Cargando />}><PerfilPage /></Suspense>} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
