import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import AuthLayout from '@components/layout/AuthLayout'
import { Button, Input } from '@components/ui'
import { registerAdmin } from '@api/auth'
import './auth.css'

const DEPARTMENTS = ['', 'Redes y Telecomunicaciones', 'Soporte y Hardware', 'Desarrollo Web', 'Seguridad Informática', 'Administración', 'RRHH']

export default function RegisterPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    nombre: '', apellidos: '', telefono: '', fechaNacimiento: '',
    dept: '', userEmail: '', password: '', confirmPass: ''
  })

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPass) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    setLoading(true)
    try {
      await registerAdmin({
        nombre: form.nombre,
        apellidos: form.apellidos,
        telefono: form.telefono,
        email: form.userEmail,
        fechaNacimiento: form.fechaNacimiento,
        password: form.password,
        perfil: 3, // id_rol 3 = Administrador en la BD
      })

      // Guardar el email para usarlo en la pantalla de verificación
      sessionStorage.setItem('pending_email', form.userEmail)
      navigate('/register/sent')

    } catch (err: unknown) {
      setLoading(false)
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      if (msg?.includes('Existente') || msg?.includes('23505')) {
        setError('Este correo ya está registrado en el sistema.')
      } else {
        setError(msg || 'Error al enviar la solicitud. Intenta de nuevo.')
      }
    }
  }

  return (
    <AuthLayout
      leftTitle={<>Solicitud de<br /><em>Credenciales</em></>}
      leftDescription="El acceso al panel central está estrictamente regulado. Completa el formulario y espera la validación de tu gerente regional o del departamento de IT."
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
          <p className="auth-info-title">PROCESO DE VALIDACIÓN</p>
          <p className="auth-info-body">
            Tu solicitud será revisada por el administrador del sistema. Recibirás un código de 4 dígitos en tu correo para activar tu cuenta.
          </p>
        </div>
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <Input label="Nombres" placeholder="Ej. Ana Martínez Soto" value={form.nombre} onChange={set('nombre')} required />

        <div className="auth-row">
          <Input label="Apellidos" placeholder="Martínez Soto" value={form.apellidos} onChange={set('apellidos')} required />
          <Input label="Teléfono" placeholder="+52 333..." type="tel" value={form.telefono} onChange={set('telefono')} required />
        </div>

        <div className="auth-row">
          <Input label="Fecha de Nacimiento" type="date" value={form.fechaNacimiento} onChange={set('fechaNacimiento')} required />
          <div className="field">
            <label className="field-label">Departamento</label>
            <select className="field-input" value={form.dept} onChange={set('dept')} required>
              <option value="">Seleccionar...</option>
              {DEPARTMENTS.filter(Boolean).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {/* Email */}
        <Input 
          label="Correo" 
          type="email" 
          placeholder="usuario@ejemplo.com" 
          value={form.userEmail} 
          onChange={set('userEmail')} 
          required 
        />

        <div className="auth-row">
          <Input label="Contraseña" type="password" placeholder="Min. 8 caracteres" value={form.password} onChange={set('password')} required />
          <Input label="Confirmar Contraseña" type="password" placeholder="Repite la clave" value={form.confirmPass} onChange={set('confirmPass')} required />
        </div>

        {error && (
          <div className="auth-error-box">
            <span>⚠</span> {error}
          </div>
        )}

        <Button type="submit" fullWidth loading={loading} size="lg">
          ENVIAR SOLICITUD ▲
        </Button>
      </form>
    </AuthLayout>
  )
}
