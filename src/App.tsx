import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute, GuestRoute } from '@components/layout/ProtectedRoute'
import LoginPage        from '@pages/auth/LoginPage'
import RegisterPage     from '@pages/auth/RegisterPage'
import RequestSentPage  from '@pages/auth/RequestSentPage'
import TwoFactorPage    from '@pages/auth/TwoFactorPage'
import DashboardLayout  from '@components/layout/DashboardLayout'
import DashboardPage    from '@pages/dashboard/DashboardPage'
import ValidacionesPage from '@pages/validaciones/ValidacionesPage'
import TecnicosPage     from '@pages/tecnicos/TecnicosPage'
import MapaPage         from '@pages/mapa/MapaPage'
import FinanzasPage     from '@pages/finanzas/FinanzasPage'
import ConfiguracionPage from '@pages/configuracion/ConfiguracionPage'
import PerfilPage       from '@pages/perfil/PerfilPage'
import SoportePage      from '@pages/soporte/SoportePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* ── Rutas públicas (solo si NO está autenticado) ── */}
        <Route element={<GuestRoute />}>
          <Route path="/login"         element={<LoginPage />} />
          <Route path="/register"      element={<RegisterPage />} />
          <Route path="/register/sent" element={<RequestSentPage />} />
          <Route path="/verify-2fa"    element={<TwoFactorPage />} />
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
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
