import { Link } from 'react-router-dom'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import AuthLayout from '@components/layout/AuthLayout'
import './auth.css'

/**
 * Las cuentas de operador ya no se crean desde un formulario público:
 * el backend rechaza el registro con id_rol = 3. Un administrador existente
 * da de alta a los nuevos operadores (POST /api/admin/co-admins).
 */
export default function RegisterPage() {
  return (
    <AuthLayout
      leftTitle={<>Solicitud de<br /><em>Credenciales</em></>}
      leftDescription="El acceso al panel central está estrictamente regulado. Las cuentas de operador las crea un administrador del sistema."
      nodeLabel="CONTROL DE ACCESO"
    >
      <Link to="/login" className="auth-back">
        <ArrowLeft size={13} /> VOLVER AL LOGIN
      </Link>

      <div className="auth-form-header">
        <h2 className="auth-form-title">Alta de Operador</h2>
        <p className="auth-form-subtitle">NODO OPERATIVO LÁZARO CÁRDENAS</p>
      </div>

      <div className="auth-info-box">
        <AlertCircle size={14} />
        <div>
          <p className="auth-info-title">ALTA POR UN ADMINISTRADOR</p>
          <p className="auth-info-body">
            Por seguridad, no es posible registrarse por cuenta propia. Pide a un administrador del panel que cree tu cuenta;
            recibirás tus credenciales y podrás iniciar sesión con tu correo y el código de verificación.
          </p>
        </div>
      </div>
    </AuthLayout>
  )
}
