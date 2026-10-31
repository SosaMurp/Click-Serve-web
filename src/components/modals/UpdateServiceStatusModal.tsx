import React, { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  X,
  Bell,
  Mail,
  Smartphone,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  Send,
  Check,
  Info,
} from 'lucide-react'
import { useUpdateServiceStatus } from '../../hooks/useServicios'
import {
  updateServiceStatusSchema,
  type UpdateServiceStatusFormValues,
  type ServicioEstatus,
} from '../../types/servicios'
import { Button, Badge } from '../ui'
import './modals.css'

export interface UpdateServiceStatusModalProps {
  isOpen: boolean
  onClose: () => void
  serviceId: number | string
  serviceCode?: string
  currentStatus?: string
  clientName?: string
  clientPhone?: string
  clientEmail?: string
  serviceTitle?: string
  onStatusUpdated?: (newStatus: string) => void
}

const AVAILABLE_STATUSES: {
  value: ServicioEstatus
  label: string
  description: string
  icon: React.ReactNode
  color: string
  badgeVariant: 'warning' | 'success' | 'danger' | 'info' | 'neutral'
}[] = [
  {
    value: 'En Progreso',
    label: 'En Progreso',
    description: 'El técnico ha iniciado las labores físicas en sitio.',
    icon: <Clock size={16} />,
    color: '#0C1C40',
    badgeVariant: 'info',
  },
  {
    value: 'Finalizado',
    label: 'Finalizado',
    description: 'El servicio técnico ha sido concluido exitosamente.',
    icon: <CheckCircle2 size={16} />,
    color: '#0E7A42',
    badgeVariant: 'success',
  },
  {
    value: 'Cancelado',
    label: 'Cancelado',
    description: 'El servicio fue cancelado por el cliente, técnico o administración.',
    icon: <XCircle size={16} />,
    color: '#D92D20',
    badgeVariant: 'danger',
  },
  {
    value: 'En Camino',
    label: 'En Camino',
    description: 'El prestador se encuentra en tránsito hacia el domicilio.',
    icon: <AlertTriangle size={16} />,
    color: '#F2A91E',
    badgeVariant: 'warning',
  },
]

export default function UpdateServiceStatusModal({
  isOpen,
  onClose,
  serviceId,
  serviceCode,
  currentStatus = 'En Progreso',
  clientName = 'Cliente',
  clientPhone,
  clientEmail,
  serviceTitle,
  onStatusUpdated,
}: UpdateServiceStatusModalProps) {
  const [successNotice, setSuccessNotice] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<UpdateServiceStatusFormValues>({
    resolver: zodResolver(updateServiceStatusSchema),
    defaultValues: {
      estatus: currentStatus,
      notificarCliente: true,
      canalNotificacion: 'ambos',
      motivoCambio: '',
      mensajePersonalizado: '',
    },
  })

  const selectedStatus = watch('estatus')
  const notificarCliente = watch('notificarCliente')
  const canalNotificacion = watch('canalNotificacion')

  const updateStatusMutation = useUpdateServiceStatus({
    onSuccess: (data, variables) => {
      setSuccessNotice(
        `Estado actualizado correctamente a "${variables.payload.estatus}".${
          variables.payload.notificarCliente
            ? ' Se ha enviado la alerta al cliente.'
            : ''
        }`
      )
      if (onStatusUpdated) {
        onStatusUpdated(variables.payload.estatus)
      }
      setTimeout(() => {
        setSuccessNotice(null)
        onClose()
      }, 1500)
    },
    onError: (err) => {
      setApiError(
        err.message || 'Ocurrió un error al intentar actualizar el estado del servicio.'
      )
    },
  })

  if (!isOpen) return null

  const onSubmit = (formData: UpdateServiceStatusFormValues) => {
    setApiError(null)
    setSuccessNotice(null)

    updateStatusMutation.mutate({
      id: serviceId,
      payload: {
        estatus: formData.estatus,
        notificarCliente: formData.notificarCliente,
        canalNotificacion: formData.canalNotificacion,
        motivoCambio: formData.motivoCambio?.trim() || undefined,
        mensajePersonalizado: formData.mensajePersonalizado?.trim() || undefined,
      },
    })
  }

  const handleModalClose = () => {
    reset()
    setApiError(null)
    setSuccessNotice(null)
    onClose()
  }

  const displayCode = serviceCode || (typeof serviceId === 'number' ? `SRV-${String(serviceId).padStart(3, '0')}` : serviceId)

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-update-status-title">
      <div className="modal-container modal-container--sm fade-in" style={{ maxWidth: 540 }}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title" id="modal-update-status-title">
              Actualizar Estado del Servicio
            </h3>
            <p className="modal-subtitle">
              {displayCode} • {serviceTitle || 'Mantenimiento General'}
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={handleModalClose}
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulario manejado por React Hook Form */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal-body" style={{ gap: 16 }}>
            {/* Mensajes de feedback */}
            {successNotice && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: '#E3F4EA',
                  border: '1px solid #BFE3CD',
                  color: '#0B6235',
                  padding: '12px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <Check size={18} color="#0E7A42" />
                <span>{successNotice}</span>
              </div>
            )}

            {apiError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: '#FDE8E6',
                  border: '1px solid #F4C7C2',
                  color: '#A41F15',
                  padding: '12px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                <ShieldAlert size={18} color="#D92D20" />
                <span>{apiError}</span>
              </div>
            )}

            {/* Resumen del cliente destinatario */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#F7F8F9',
                border: '1px solid #E6E9EE',
                padding: '10px 14px',
                borderRadius: 8,
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--text-mid)', textTransform: 'uppercase' }}>
                  Cliente Titular
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: 'var(--text-dark)' }}>
                  {clientName}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--text-mid)', textTransform: 'uppercase' }}>
                  Estado Actual
                </p>
                <Badge variant={currentStatus === 'Finalizado' || currentStatus === 'Completado' ? 'success' : 'warning'}>
                  {currentStatus}
                </Badge>
              </div>
            </div>

            {/* Selector de Nuevo Estado con Controller */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--text-mid)',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                Seleccionar Nuevo Estado *
              </label>

              <Controller
                control={control}
                name="estatus"
                render={({ field }) => (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {AVAILABLE_STATUSES.map((st) => {
                      const isSelected = field.value === st.value
                      return (
                        <button
                          key={st.value}
                          type="button"
                          onClick={() => field.onChange(st.value)}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 8,
                            border: `2px solid ${isSelected ? st.color : '#E6E9EE'}`,
                            background: isSelected ? `${st.color}0f` : '#ffffff',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                fontWeight: 700,
                                fontSize: 13,
                                color: isSelected ? st.color : '#4B5563',
                              }}
                            >
                              {st.icon}
                              {st.label}
                            </span>
                            {isSelected && (
                              <span
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  backgroundColor: st.color,
                                }}
                              />
                            )}
                          </div>
                          <p
                            style={{
                              margin: 0,
                              fontSize: 11,
                              color: '#667085',
                              lineHeight: 1.3,
                            }}
                          >
                            {st.description}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                )}
              />
              {errors.estatus && (
                <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>
                  {errors.estatus.message}
                </p>
              )}
            </div>

            {/* Checkbox de Notificación al Cliente (Requisito clave) */}
            <div
              style={{
                background: notificarCliente ? '#E8EBF2' : '#F7F8F9',
                border: `1px solid ${notificarCliente ? '#CDD3E0' : '#E6E9EE'}`,
                borderRadius: 8,
                padding: '14px 16px',
                transition: 'all 0.2s ease',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  id="chk-notificar-cliente"
                  {...register('notificarCliente')}
                  style={{
                    width: 18,
                    height: 18,
                    marginTop: 2,
                    cursor: 'pointer',
                    accentColor: '#0C1C40',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 700,
                      color: notificarCliente ? '#0C1C40' : 'var(--text-dark)',
                    }}
                  >
                    <Bell size={15} />
                    Notificar al cliente por SMS/Correo
                  </span>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.4 }}>
                    Dispara automáticamente una plantilla transaccional vía Twilio SMS y Nodemailer al confirmarse la actualización.
                  </p>
                </div>
              </label>

              {/* Opciones adicionales cuando la bandera está activa */}
              {notificarCliente && (
                <div
                  style={{
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: '1px dashed #CDD3E0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#0C1C40', textTransform: 'uppercase' }}>
                      Canal de Envío
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['ambos', 'sms', 'email'] as const).map((canal) => (
                        <label
                          key={canal}
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '4px 8px',
                            borderRadius: 6,
                            background: canalNotificacion === canal ? '#0C1C40' : '#ffffff',
                            color: canalNotificacion === canal ? '#ffffff' : '#4B5563',
                            border: '1px solid #CDD3E0',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <input
                            type="radio"
                            value={canal}
                            {...register('canalNotificacion')}
                            style={{ display: 'none' }}
                          />
                          {canal === 'sms' && <Smartphone size={12} />}
                          {canal === 'email' && <Mail size={12} />}
                          {canal === 'ambos' && <Send size={12} />}
                          {canal === 'ambos' ? 'Ambos (SMS + Correo)' : canal.toUpperCase()}
                        </label>
                      ))}
                    </div>
                  </div>

                  {(clientPhone || clientEmail) && (
                    <div
                      style={{
                        fontSize: 11,
                        color: '#4B5563',
                        background: '#ffffff',
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid #E6E9EE',
                        display: 'flex',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      {clientPhone && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Smartphone size={12} color="#0C1C40" /> {clientPhone}
                        </span>
                      )}
                      {clientEmail && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Mail size={12} color="#0C1C40" /> {clientEmail}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Motivo o Bitácora Opcional */}
            <div>
              <label
                htmlFor="txt-motivo-cambio"
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--text-mid)',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Observaciones del Cambio (Bitácora Administrativa)
              </label>
              <textarea
                id="txt-motivo-cambio"
                rows={2}
                placeholder="Ej. Revisión técnica completada por reporte en zona centro..."
                {...register('motivoCambio')}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 13,
                  resize: 'none',
                }}
              />
              {errors.motivoCambio && (
                <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>
                  {errors.motivoCambio.message}
                </p>
              )}
            </div>
          </div>

          {/* Footer con botones de acción */}
          <div className="modal-footer">
            <Button
              type="button"
              variant="secondary"
              onClick={handleModalClose}
              disabled={updateStatusMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={updateStatusMutation.isPending}
              id="btn-confirm-update-status"
            >
              <Check size={14} /> Confirmar Actualización
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
