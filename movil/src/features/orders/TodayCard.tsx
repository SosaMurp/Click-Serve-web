import React from 'react';
import type { Solicitud } from '../../api/types';
import { ServiceCard } from './ServiceCard';

// "Tu servicio" en el inicio del cliente: la misma tarjeta que en Mis servicios, para que se reconozca igual.
export function TodayCard({ s, onOpen }: { s: Solicitud; onOpen: () => void }) {
  return <ServiceCard s={s} onOpen={onOpen} overline="Tu servicio" />;
}
