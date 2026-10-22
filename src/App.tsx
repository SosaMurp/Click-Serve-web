import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { setNavigate } from './lib/navigation'
import { ProtectedRoute, GuestRoute } from '@components/layout/ProtectedRoute'
import LoginPage        from '@pages/auth/LoginPage'
import RegisterPage     from '@pages/auth/RegisterPage'
import RequestSentPage  from '@pages/auth/RequestSentPage'
import TwoFactorPage    from '@pages/auth/TwoFactorPage'
import RecoverPasswordPage from '@pages/auth/RecoverPasswordPage'
import DashboardLayout  from '@components/layout/DashboardLayout'
import DashboardPage    from '@pages/dashboard/DashboardPage'
import ValidacionesPage from '@pages/validaciones/ValidacionesPage'
import TecnicosPage     from '@pages/tecnicos/TecnicosPage'
import MapaPage         from '@pages/mapa/MapaPage'
import FinanzasPage     from '@pages/finanzas/FinanzasPage'
import ConfiguracionPage from '@pages/configuracion/ConfiguracionPage'
import PerfilPage       from '@pages/perfil/PerfilPage'
import SoportePage      from '@pages/soporte/SoportePage'
import BiometriaPage    from '@pages/biometria/BiometriaPage'


/** Registra useNavigate en el helper imperativo para que Axios pueda redirigir */
function NavigationRegistrar() {
  const navigate = useNavigate()
  useEffect(() => { setNavigate(navigate) }, [navigate])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <NavigationRegistrar />
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
          <Route element={<DashboardLayout />}>
            <Route path="dashboard"      element={<DashboardPage />} />
            <Route path="validaciones"   element={<ValidacionesPage />} />
            <Route path="tecnicos"       element={<TecnicosPage />} />
            <Route path="soporte"        element={<SoportePage />} />
            <Route path="mapa"           element={<MapaPage />} />
            <Route path="finanzas"       element={<FinanzasPage />} />
            <Route path="configuracion"  element={<ConfiguracionPage />} />
            <Route path="perfil"         element={<PerfilPage />} />
            <Route path="biometria"      element={<BiometriaPage />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
