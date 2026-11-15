import React from 'react';
import { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { IconName } from './Icon';

// Figuras a color para menús, listas y pantallas vacías (mismo estilo que las de los oficios):
// degradados, un brillo y un círculo de color suave detrás. Dibujadas para la app en un lienzo de 64 × 64.
export type FiguraNombre =
  | 'ubicacion' | 'casa' | 'tarjeta' | 'escudo' | 'candado' | 'campana' | 'persona' | 'personas'
  | 'chat' | 'ayuda' | 'soporte' | 'documento' | 'ojo' | 'banco' | 'etiqueta' | 'fotos'
  | 'calendario' | 'medalla' | 'descarga' | 'lupa' | 'alerta' | 'lapiz' | 'caja' | 'luna' | 'listo' | 'libro';

type Pinta = { g: (k: string) => string; url: (k: string) => string; fondo: string };

const grad = (id: string, a: string, b: string, diagonal = true) => (
  <LinearGradient id={id} x1="0" y1="0" x2={diagonal ? '1' : '0'} y2="1"><Stop offset="0" stopColor={a} /><Stop offset="1" stopColor={b} /></LinearGradient>
);

export const FIGURAS: Record<FiguraNombre, { fondo: string; dibujo: (p: Pinta) => React.ReactNode }> = {
  ubicacion: {
    fondo: '#FFE6D3',
    dibujo: ({ g, url }) => (
      <G>
        <Defs>{grad(g('a'), '#FF9A4D', '#E85500')}</Defs>
        <Ellipse cx={32} cy={54} rx={10} ry={3} fill="#0C1C40" opacity={0.15} />
        <Path d="M32 8 C22 8 15 15.5 15 25 C15 37 32 53 32 53 C32 53 49 37 49 25 C49 15.5 42 8 32 8 Z" fill={url('a')} />
        <Circle cx={32} cy={25} r={7} fill="#FFFFFF" />
        <Path d="M22 17 C24 13 28 11.5 31 11.5" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" fill="none" opacity={0.55} />
      </G>
    ),
  },
  casa: {
    fondo: '#FFF0D6',
    dibujo: ({ g, url }) => (
      <G>
        <Defs>{grad(g('a'), '#FFA55C', '#E85500')}{grad(g('b'), '#FFFFFF', '#E3E7EE', false)}</Defs>
        <Rect x={17} y={29} width={30} height={23} rx={3} fill={url('b')} />
        <Path d="M10 31 L32 12 L54 31 Z" fill={url('a')} strokeLinejoin="round" />
        <Rect x={28} y={38} width={8} height={14} rx={2} fill="#0C1C40" />
        <Rect x={20} y={35} width={6} height={6} rx={1.5} fill="#7FC4FF" />
        <Rect x={38} y={35} width={6} height={6} rx={1.5} fill="#7FC4FF" />
      </G>
    ),
  },
  tarjeta: {
    fondo: '#DCEBFF',
    dibujo: ({ g, url }) => (
      <G>
        <Defs>{grad(g('a'), '#2B3A67', '#0C1C40')}{grad(g('b'), '#FFE38A', '#E0A21A')}</Defs>
        <G transform="rotate(-10 32 32)">
          <Rect x={9} y={17} width={46} height={30} rx={5} fill={url('a')} />
          <Rect x={9} y={23} width={46} height={6} fill="#FF6B00" />
          <Rect x={15} y={33} width={10} height={8} rx={2} fill={url('b')} />
          <Rect x={30} y={36} width={18} height={3} rx={1.5} fill="#FFFFFF" opacity={0.6} />
        </G>
      </G>
    ),
  },
  escudo: {
    fondo: '#DDF6E8',
    dibujo: ({ g, url }) => (
      <G>
        <Defs>{grad(g('a'), '#34D399', '#0E7A42')}</Defs>
        <Path d="M32 8 L50 15 V30 C50 42 42 50 32 55 C22 50 14 42 14 30 V15 Z" fill={url('a')} />
        <Path d="M32 11 V52 C24 47 17 41 17 30 V17 Z" fill="#FFFFFF" opacity={0.15} />
        <Path d="M23 31 L29.5 37.5 L41.5 25" stroke="#FFFFFF" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </G>
    ),
  },
  candado: {
    fondo: '#FFF3C4',
    dibujo: ({ g, url }) => (
      <G>
        <Defs>{grad(g('a'), '#FFD25C', '#E89A00')}{grad(g('b'), '#E9EDF3', '#8B93A1')}</Defs>
        <Path d="M22 29 V22 C22 16 26.5 12 32 12 C37.5 12 42 16 42 22 V29" stroke={url('b')} strokeWidth={5} fill="none" strokeLinecap="round" />
        <Rect x={15} y={27} width={34} height={26} rx={6} fill={url('a')} />
        <Circle cx={32} cy={38} r={3.5} fill="#0C1C40" />
        <Rect x={30.5} y={39} width={3} height={7} rx={1.5} fill="#0C1C40" />
        <Rect x={19} y={31} width={4} height={18} rx={2} fill="#FFFFFF" opacity={0.35} />
      </G>
    ),
  },
  campana: {
    fondo: '#FFF3C4',
    dibujo: ({ g, url }) => (
      <G>
        <Defs>{grad(g('a'), '#FFE066', '#F59E0B')}</Defs>
        <Path d="M32 10 C23 10 18 17 18 26 V36 L13 43 H51 L46 36 V26 C46 17 41 10 32 10 Z" fill={url('a')} />
        <Circle cx={32} cy={48} r={5} fill="#FF6B00" />
        <Rect x={29.5} y={6} width={5} height={6} rx={2.5} fill="#F59E0B" />
        <Path d="M23 30 V25 C23 20 26 16 30 15" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" fill="none" opacity={0.6} />
        <Circle cx={47} cy={14} r={5} fill="#D92D20" />
      </G>
    ),
  },
  persona: {
    fondo: '#DCEBFF',
    dibujo: ({ g, url }) => (
      <G>
        <Defs>{grad(g('a'), '#6BB8FF', '#1D6FE0')}{grad(g('b'), '#FFD9B8', '#F2B48A')}</Defs>
        <Path d="M14 54 C14 43 22 36 32 36 C42 36 50 43 50 54 Z" fill={url('a')} />
        <Circle cx={32} cy={23} r={10} fill={url('b')} />
        <Path d="M22 21 C22 14 27 11 32 11 C38 11 42 15 42 20 C38 18 30 18 22 21 Z" fill="#0C1C40" />
      </G>
    ),
  },
  personas: {
    fondo: '#E8EBF5',
    dibujo: ({ g, url }) => (
      <G>
        <Defs>{grad(g('a'), '#FFA55C', '#E85500')}{grad(g('b'), '#6BB8FF', '#1D6FE0')}</Defs>
        <Circle cx={23} cy={24} r={8} fill="#F2B48A" />
        <Path d="M9 50 C9 40 15 35 23 35 C31 35 37 40 37 50 Z" fill={url('a')} />
        <Circle cx={41} cy={22} r={9} fill="#FFD9B8" />
        <Path d="M26 54 C26 42 33 35 41 35 C49 35 56 42 56 54 Z" fill={url('b')} />
      </G>
    ),
  },
  chat: {
    fondo: '#DCEBFF',
    dibujo: ({ g, url }) => (
      <G>
        <Defs>{grad(g('a'), '#6BB8FF', '#1D6FE0')}{grad(g('b'), '#FFA55C', '#E85500')}</Defs>
        <Path d="M10 16 C10 12.7 12.7 10 16 10 H40 C43.3 10 46 12.7 46 16 V30 C46 33.3 43.3 36 40 36 H22 L13 43 V36 C11.3 35.2 10 33.4 10 31 Z" fill={url('a')} />
        <Circle cx={20} cy={23} r={2.5} fill="#FFFFFF" />
        <Circle cx={28} cy={23} r={2.5} fill="#FFFFFF" />
        <Circle cx={36} cy={23} r={2.5} fill="#FFFFFF" />
        <Path d="M30 34 C30 31.8 31.8 30 34 30 H50 C52.2 30 54 31.8 54 34 V44 C54 46 52.8 47.5 51 48 V54 L44 48 H34 C31.8 48 30 46.2 30 44 Z" fill={url('b')} />
      </G>
    ),
  },
  ayuda: {
    fondo: '#E8EBF5',
    dibujo: ({ g, url }) => (
      <G>
        <Defs>{grad(g('a'), '#6BB8FF', '#1D6FE0')}</Defs>
        <Circle cx={32} cy={31} r={21} fill={url('a')} />
        <Path d="M25 25 C25 20.5 28.5 18 32.5 18 C36.5 18 39.5 20.5 39.5 24.5 C39.5 30 33 30 33 36" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" fill="none" />
        <Circle cx={33} cy={44} r={3} fill="#FFFFFF" />
        <Path d="M17 26 C18 20 22 15 28 13" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" fill="none" opacity={0.4} />
      </G>
    ),
  },
  soporte: {
    fondo: '#FFE6D3',
    dibujo: ({ g, url }) => (
      <G>
        <Defs>{grad(g('a'), '#FFA55C', '#E85500')}</Defs>
        <Path d="M14 34 V30 C14 20 22 12 32 12 C42 12 50 20 50 30 V34" stroke="#0C1C40" strokeWidth={4.5} fill="none" strokeLinecap="round" />
        <Rect x={10} y={30} width={11} height={17} rx={5} fill={url('a')} />
        <Rect x={43} y={30} width={11} height={17} rx={5} fill={url('a')} />
        <Path d="M48 47 C48 52 43 54 36 54" stroke="#0C1C40" strokeWidth={3} fill="none" strokeLinecap="round" />
        <Rect x={30} y={51} width={8} height={6} rx={3} fill="#0C1C40" />
      </G>
    ),
  },
  documento: {
    fondo: '#E8EBF5',
    dibujo: ({ g, url }) => (
      <G>
        <Defs>{grad(g('a'), '#FFFFFF', '#E3E7EE')}</Defs>
        <Path d="M16 8 H38 L48 18 V54 C48 55.7 46.7 57 45 57 H16 C14.3 57 13 55.7 13 54 V11 C13 9.3 14.3 8 16 8 Z" fill={url('a')} stroke="#C3CAD6" strokeWidth={1} />
        <Path d="M38 8 V16 C38 17.1 38.9 18 40 18 H48 Z" fill="#C3CAD6" />
        <Rect x={19} y={24} width={22} height={3} rx={1.5} fill="#2F80ED" />
        <Rect x={19} y={31} width={24} height={3} rx={1.5} fill="#AEB6C4" />
        <Rect x={19} y={38} width={18} height={3} rx={1.5} fill="#AEB6C4" />
        <Circle cx={40} cy={47} r={6} fill="#FF6B00" />
        <Path d="M37.5 47 L39.5 49 L43 45" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </G>
    ),
  },
  ojo: {
    fondo: '#DCEBFF',
    dibujo: ({ g, url }) => (
      <G>
        <Defs>{grad(g('a'), '#6BB8FF', '#1D6FE0')}</Defs>
        <Path d="M8 32 C14 21 22 16 32 16 C42 16 50 21 56 32 C50 43 42 48 32 48 C22 48 14 43 8 32 Z" fill="#FFFFFF" stroke="#C3CAD6" strokeWidth={1} />
        <Circle cx={32} cy={32} r={11} fill={url('a')} />
        <Circle cx={32} cy={32} r={5} fill="#0C1C40" />
        <Circle cx={35.5} cy={28.5} r={2.2} fill="#FFFFFF" />
      </G>
    ),
  },
  banco: {
    fondo: '#E8EBF5',
    dibujo: ({ g, url }) => (
      <G>
        <Defs>{grad(g('a'), '#FFFFFF', '#D5DCE7', false)}</Defs>
        <Path d="M8 24 L32 10 L56 24 Z" fill="#0C1C40" />
        <Rect x={10} y={24} width={44} height={4} fill="#1B2B52" />
        <Rect x={14} y={29} width={6} height={18} rx={1} fill={url('a')} />
        <Rect x={24} y={29} width={6} height={18} rx={1} fill={url('a')} />
        <Rect x={34} y={29} width={6} height={18} rx={1} fill={url('a')} />
        <Rect x={44} y={29} width={6} height={18} rx={1} fill={url('a')} />
        <Rect x={8} y={47} width={48} height={6} rx={2} fill="#0C1C40" />
        <Circle cx={32} cy={18} r={3} fill="#FFC53D" />
      </G>
    ),
  },
  etiqueta: {
    fondo: '#FFE6D3',
    dibujo: ({ g, url }) => (
      <G>
        <Defs>{grad(g('a'), '#FFA55C', '#E85500')}</Defs>
        <Path d="M34 9 H51 C53 9 55 11 55 13 V30 C55 31 54.6 32 53.8 32.8 L32.8 53.8 C31.2 55.4 28.7 55.4 27.1 53.8 L10.2 36.9 C8.6 35.3 8.6 32.8 10.2 31.2 L31.2 10.2 C32 9.4 33 9 34 9 Z" fill={url('a')} />
        <Circle cx={45} cy={19} r={4} fill="#FFFFFF" />
        <Path d="M27 28 L36 37 M24 34 L30 40" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.8} />
      </G>
    ),
  },
  fotos: {
    fondo: '#DDF6F1',
    dibujo: () => (
      <G>
        <Rect x={10} y={13} width={44} height={36} rx={5} fill="#FFFFFF" stroke="#C3CAD6" strokeWidth={1} />
        <Rect x={14} y={17} width={36} height={28} rx={3} fill="#9AD4FF" />
        <Path d="M14 45 L26 31 L34 39 L40 33 L50 45 Z" fill="#22C55E" />
        <Path d="M26 45 L34 37 L42 45 Z" fill="#16A34A" />
        <Circle cx={42} cy={24} r={4} fill="#FFC53D" />
      </G>
    ),
  },
  calendario: {
    fondo: '#FFE1E1',
    dibujo: () => (
      <G>
        <Rect x={11} y={14} width={42} height={40} rx={6} fill="#FFFFFF" stroke="#C3CAD6" strokeWidth={1} />
        <Path d="M11 20 C11 16.7 13.7 14 17 14 H47 C50.3 14 53 16.7 53 20 V25 H11 Z" fill="#E5484D" />
        <Rect x={20} y={9} width={4} height={10} rx={2} fill="#0C1C40" />
        <Rect x={40} y={9} width={4} height={10} rx={2} fill="#0C1C40" />
        <Rect x={17} y={30} width={7} height={6} rx={1.5} fill="#E3E7EE" />
        <Rect x={28.5} y={30} width={7} height={6} rx={1.5} fill="#E3E7EE" />
        <Rect x={40} y={30} width={7} height={6} rx={1.5} fill="#FF6B00" />
        <Rect x={17} y={40} width={7} height={6} rx={1.5} fill="#E3E7EE" />
        <Rect x={28.5} y={40} width={7} height={6} rx={1.5} fill="#E3E7EE" />
      </G>
    ),
  },
  medalla: {
    fondo: '#FFF3C4',
    dibujo: ({ g, url }) => (
      <G>
        <Defs>{grad(g('a'), '#FFE38A', '#E0A21A')}</Defs>
        <Path d="M22 8 H30 L34 24 H26 Z" fill="#2F80ED" />
        <Path d="M42 8 H34 L30 24 H38 Z" fill="#E5484D" />
        <Circle cx={32} cy={38} r={15} fill={url('a')} stroke="#C98A0E" strokeWidth={1.2} />
        <Path d="M32 29 L34.6 34.6 L40.6 35.2 L36 39.2 L37.4 45 L32 42 L26.6 45 L28 39.2 L23.4 35.2 L29.4 34.6 Z" fill="#FFFFFF" opacity={0.9} />
      </G>
    ),
  },
  descarga: {
    fondo: '#DCEBFF',
    dibujo: ({ g, url }) => (
      <G>
        <Defs>{grad(g('a'), '#9AD4FF', '#2F80ED')}</Defs>
        <Path d="M19 44 C12 44 8 39.5 8 34 C8 28.5 12.5 24.5 18 25 C19.5 18 25.5 13 33 13 C41 13 47 19 47.5 26.5 C52.5 27 56 31 56 35.5 C56 40.5 52 44 47 44 Z" fill={url('a')} />
        <Path d="M32 27 V46 M25 40 L32 47 L39 40" stroke="#FFFFFF" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </G>
    ),
  },
  lupa: {
    fondo: '#E8EBF5',
    dibujo: () => (
      <G>
        <Rect x={36} y={38} width={8} height={20} rx={4} fill="#0C1C40" transform="rotate(-45 40 48)" />
        <Circle cx={27} cy={27} r={16} fill="#BFE3FF" stroke="#0C1C40" strokeWidth={5} />
        <Path d="M19 23 C20 19 23 16.5 27 16" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" fill="none" />
      </G>
    ),
  },
  alerta: {
    fondo: '#FFF3C4',
    dibujo: ({ g, url }) => (
      <G>
        <Defs>{grad(g('a'), '#FFE066', '#F59E0B')}</Defs>
        <Path d="M28.5 11 C30 8.4 34 8.4 35.5 11 L55 46 C56.5 48.7 54.6 52 51.5 52 H12.5 C9.4 52 7.5 48.7 9 46 Z" fill={url('a')} />
        <Rect x={29.5} y={22} width={5} height={16} rx={2.5} fill="#0C1C40" />
        <Circle cx={32} cy={44} r={3} fill="#0C1C40" />
      </G>
    ),
  },
  lapiz: {
    fondo: '#FFF0D6',
    dibujo: () => (
      <G transform="rotate(45 32 32)">
        <Rect x={26} y={8} width={12} height={8} rx={2} fill="#F28CA6" />
        <Rect x={26} y={15} width={12} height={4} fill="#AEB6C4" />
        <Rect x={26} y={19} width={12} height={26} fill="#FFC53D" />
        <Rect x={26} y={19} width={4} height={26} fill="#FFE08A" />
        <Path d="M26 45 L32 56 L38 45 Z" fill="#F2D2A9" />
        <Path d="M30.2 52.7 L32 56 L33.8 52.7 Z" fill="#0C1C40" />
      </G>
    ),
  },
  caja: {
    fondo: '#FFE1E1',
    dibujo: ({ g, url }) => (
      <G>
        <Defs>{grad(g('a'), '#FF7A7A', '#D93025')}</Defs>
        <Path d="M24 22 V17 C24 15 25.5 13.5 27.5 13.5 H36.5 C38.5 13.5 40 15 40 17 V22" stroke="#0C1C40" strokeWidth={3.5} fill="none" />
        <Rect x={9} y={21} width={46} height={32} rx={5} fill={url('a')} />
        <Rect x={9} y={32} width={46} height={4} fill="#B4231A" />
        <Rect x={28} y={30} width={8} height={8} rx={2} fill="#FFC53D" />
      </G>
    ),
  },
  luna: {
    fondo: '#E3E7F0',
    dibujo: ({ g, url }) => (
      <G>
        <Defs>{grad(g('a'), '#FFE38A', '#F59E0B')}</Defs>
        <Path d="M38 12 C28 13 20 21.5 20 32 C20 43 29 52 40 52 C45 52 49.5 50 52.5 47 C50.5 47.6 48.4 48 46 48 C35 48 26 39 26 28 C26 21.5 29 15.8 33.8 12.3 C35.2 12.1 36.6 12 38 12 Z" fill={url('a')} />
        <Path d="M47 15 L48.2 18 L51 19 L48.2 20 L47 23 L45.8 20 L43 19 L45.8 18 Z" fill="#0C1C40" />
        <Circle cx={51} cy={30} r={1.8} fill="#0C1C40" />
      </G>
    ),
  },
  listo: {
    fondo: '#DDF6E8',
    dibujo: ({ g, url }) => (
      <G>
        <Defs>{grad(g('a'), '#34D399', '#0E7A42')}</Defs>
        <Circle cx={32} cy={32} r={21} fill={url('a')} />
        <Path d="M22 32.5 L29 39.5 L43 25" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Path d="M17 26 C18.5 20 23 15.5 29 14" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" fill="none" opacity={0.4} />
      </G>
    ),
  },
  libro: {
    fondo: '#DCEBFF',
    dibujo: () => (
      <G>
        <Path d="M32 17 C26 12 17 12 9 14 V50 C17 48 26 48 32 53 Z" fill="#2F80ED" />
        <Path d="M32 17 C38 12 47 12 55 14 V50 C47 48 38 48 32 53 Z" fill="#6BB8FF" />
        <Path d="M14 22 C19 21 24 21.5 28 23.5 M14 29 C19 28 24 28.5 28 30.5 M36 23.5 C40 21.5 45 21 50 22 M36 30.5 C40 28.5 45 28 50 29" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={0.75} />
      </G>
    ),
  },
};

// Ícono de línea → figura a color. Los íconos de acción (flechas, x, editar, salir, etc.) no tienen figura.
const POR_ICONO: Partial<Record<IconName, FiguraNombre>> = {
  'map-pin': 'ubicacion', map: 'ubicacion', navigation: 'ubicacion', home: 'casa',
  'credit-card': 'tarjeta', shield: 'escudo', lock: 'candado', key: 'candado', bell: 'campana',
  user: 'persona', users: 'personas', 'message-circle': 'chat', 'message-square': 'chat', mail: 'chat', phone: 'chat',
  'help-circle': 'ayuda', 'life-buoy': 'soporte', 'file-text': 'documento', clipboard: 'documento', list: 'documento', archive: 'documento',
  eye: 'ojo', briefcase: 'banco', tag: 'etiqueta', image: 'fotos', camera: 'fotos', calendar: 'calendario', award: 'medalla',
  download: 'descarga', search: 'lupa', 'alert-triangle': 'alerta', 'edit-3': 'lapiz', 'edit-2': 'lapiz',
  sliders: 'caja', tool: 'caja', moon: 'luna', 'check-circle': 'listo', 'book-open': 'libro', radio: 'campana',
};

export function figuraDeIcono(icon?: IconName | null): FiguraNombre | null {
  return icon ? POR_ICONO[icon] ?? null : null;
}
