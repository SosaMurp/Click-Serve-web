import React from 'react';
import { ProfileScreen } from '@/src/features/account/ProfileScreen';

// Perfil del cliente: mismo diseño que el del técnico; solo cambian sus secciones propias.
export default function Cuenta() {
  return (
    <ProfileScreen
      sections={[
        {
          title: 'Tu cuenta',
          items: [
            { icon: 'map-pin', title: 'Mis direcciones', subtitle: 'Casa, trabajo y otros domicilios', href: '/direcciones', tone: 'brand' },
            { icon: 'credit-card', title: 'Mis tarjetas', subtitle: 'Para pagar tus servicios', href: '/tarjetas', tone: 'accent' },
          ],
        },
      ]}
    />
  );
}
