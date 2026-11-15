import React from 'react';
import { View } from 'react-native';
import { Icon, IconName } from './Icon';
import { color } from './tokens';

// Ícono de oficio con el estilo limpio de la muestra: ícono de línea azul marino dentro de un círculo.
// `tono`: círculo blanco sobre el fondo gris (por defecto) o gris claro dentro de una tarjeta blanca.
// `fondo={false}`: solo el ícono (por ejemplo dentro del cuadro blanco del bloque azul).
export type IlustracionNombre =
  | 'computo' | 'electricidad' | 'plomeria' | 'climatizacion' | 'linea_blanca'
  | 'cerrajeria' | 'pintura' | 'mecanica' | 'todo' | 'general';

const ICONO: Record<IlustracionNombre, IconName> = {
  computo: 'monitor',
  electricidad: 'zap',
  plomeria: 'droplet',
  climatizacion: 'wind',
  linea_blanca: 'box',
  cerrajeria: 'key',
  pintura: 'edit-3',
  mecanica: 'truck',
  todo: 'grid',
  general: 'tool',
};

// Oficio del catálogo → ícono.
export function ilustracionDe(nombre?: string | null): IlustracionNombre {
  const n = String(nombre || '').toLowerCase();
  if (n.includes('electr')) return 'electricidad';
  if (n.includes('plom') || n.includes('agua')) return 'plomeria';
  if (n.includes('comput') || n.includes('tecnolog') || n.includes('red')) return 'computo';
  if (n.includes('cerraj')) return 'cerrajeria';
  if (n.includes('pint') || n.includes('imperme')) return 'pintura';
  if (n.includes('aire') || n.includes('refrig') || n.includes('clima')) return 'climatizacion';
  if (n.includes('blanca') || n.includes('lavadora') || n.includes('electrodom')) return 'linea_blanca';
  if (n.includes('mecán') || n.includes('mecan') || n.includes('auto')) return 'mecanica';
  return 'general';
}

export function Ilustracion({ nombre, size = 48, fondo = true, tono = 'blanco' }: { nombre: IlustracionNombre; size?: number; fondo?: boolean; tono?: 'blanco' | 'gris' }) {
  const icon = <Icon name={ICONO[nombre]} size={Math.round(size * 0.42)} color={color.ink} />;
  if (!fondo) return <View aria-hidden style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>;
  return (
    <View
      aria-hidden
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tono === 'gris' ? color.ground : color.surface, alignItems: 'center', justifyContent: 'center' }}
    >
      {icon}
    </View>
  );
}
