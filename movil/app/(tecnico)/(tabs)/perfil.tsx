import React from 'react';
import { useSession } from '@/src/state/session';
import { ProfileScreen } from '@/src/features/account/ProfileScreen';
import { useResumenTecnico } from '@/src/features/tech/hooks';

export default function PerfilTecnico() {
  const { user } = useSession();
  const { data } = useResumenTecnico();
  return (
    <ProfileScreen
      metrics={[
        { value: data?.calificacion || '—', label: 'Calificación' },
        { value: data?.resenas ?? '—', label: 'Reseñas' },
        { value: data?.servicios_total ?? '—', label: 'Servicios' },
      ]}
      sections={[
        {
          title: 'Tu trabajo',
          items: [
            { icon: 'eye', title: 'Ver mi perfil público', subtitle: 'Así te ven los clientes', href: `/tecnico/${user?.id_usuario}`, tone: 'brand' },
            { icon: 'edit-3', title: 'Perfil profesional', subtitle: 'Presentación y cédula profesional', href: '/perfil-profesional', tone: 'brand' },
            { icon: 'sliders', title: 'Especialidades', subtitle: 'Categorías en las que recibes solicitudes', href: '/especialidades', tone: 'accent' },
            { icon: 'tag', title: 'Mis precios', subtitle: 'Precio base de cada servicio que ofreces', href: '/precios', tone: 'accent' },
            { icon: 'image', title: 'Portafolio', subtitle: 'Fotos de trabajos anteriores', href: '/portafolio', tone: 'accent' },
            { icon: 'shield', title: 'Verificación y documentos', subtitle: 'Identidad, certificaciones y biometría', href: '/verificacion', tone: user?.identidad_verificada ? 'success' : 'warning' },
            { icon: 'briefcase', title: 'Cuenta bancaria', subtitle: 'CLABE para tus retiros', href: '/cuenta-bancaria', tone: 'neutral' },
          ],
        },
      ]}
    />
  );
}
