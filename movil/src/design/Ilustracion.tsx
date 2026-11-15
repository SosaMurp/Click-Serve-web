import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { FIGURAS, type FiguraNombre } from './figuras';

// Ilustraciones a color de cada oficio (en lugar de íconos negros de una línea): figuras con degradados y brillo
// sobre un círculo de color suave, para que cada servicio se reconozca de un vistazo. Dibujadas para la app.
type OficioNombre =
  | 'computo' | 'electricidad' | 'plomeria' | 'climatizacion' | 'linea_blanca'
  | 'cerrajeria' | 'pintura' | 'mecanica' | 'todo' | 'general';
export type IlustracionNombre = OficioNombre | FiguraNombre;

const FONDO: Record<OficioNombre, string> = {
  computo: '#DCEBFF',
  electricidad: '#FFF3C4',
  plomeria: '#D9F1FF',
  climatizacion: '#DDF6F1',
  linea_blanca: '#E8EBF5',
  cerrajeria: '#FFF0D6',
  pintura: '#FFE6D3',
  mecanica: '#FFE1E1',
  todo: '#EEF0F6',
  general: '#E8EBF5',
};

// Oficio del catálogo → ilustración.
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

export function Ilustracion({ nombre, size = 48, fondo = true }: { nombre: IlustracionNombre; size?: number; fondo?: boolean }) {
  // Ids de degradado únicos por instancia (en web los ids del SVG comparten documento).
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const g = (k: string) => `${id}${k}`;
  const url = (k: string) => `url(#${g(k)})`;
  return (
    // Decorativa: el nombre del oficio siempre va en texto al lado, así que el lector de pantalla la omite.
    <View aria-hidden style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {fondo ? <Circle cx={32} cy={32} r={32} fill={nombre in FIGURAS ? FIGURAS[nombre as FiguraNombre].fondo : FONDO[nombre as OficioNombre]} /> : null}
      {nombre in FIGURAS ? FIGURAS[nombre as FiguraNombre].dibujo({ g, url, fondo: FIGURAS[nombre as FiguraNombre].fondo }) : null}
      {nombre === 'computo' ? (
        <G>
          <Defs>
            <LinearGradient id={g('a')} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#2B3A67" /><Stop offset="1" stopColor="#0C1C40" /></LinearGradient>
            <LinearGradient id={g('b')} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#6BB8FF" /><Stop offset="1" stopColor="#1D6FE0" /></LinearGradient>
            <LinearGradient id={g('c')} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#F2F4F8" /><Stop offset="1" stopColor="#AEB6C4" /></LinearGradient>
          </Defs>
          <Rect x={13} y={15} width={38} height={26} rx={3.5} fill={url('a')} />
          <Rect x={16} y={18} width={32} height={20} rx={1.5} fill={url('b')} />
          <Path d="M16 18 H34 L22 38 H16 Z" fill="#FFFFFF" opacity={0.22} />
          <Rect x={21} y={24} width={14} height={2.5} rx={1.25} fill="#FFFFFF" opacity={0.9} />
          <Rect x={21} y={29} width={20} height={2.5} rx={1.25} fill="#FFFFFF" opacity={0.6} />
          <Path d="M9 42 H55 L52 48 H12 Z" fill={url('c')} />
          <Rect x={27} y={42} width={10} height={2} rx={1} fill="#8B93A1" />
        </G>
      ) : null}
      {nombre === 'electricidad' ? (
        <G>
          <Defs>
            <LinearGradient id={g('a')} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFE066" /><Stop offset="1" stopColor="#FF9500" /></LinearGradient>
          </Defs>
          <Path d="M37 7 L15 36 H30 L25 57 L49 25 H34 Z" fill={url('a')} stroke="#E07B00" strokeWidth={1.6} strokeLinejoin="round" />
          <Path d="M34 12 L20 32 H27 Z" fill="#FFFFFF" opacity={0.45} />
        </G>
      ) : null}
      {nombre === 'plomeria' ? (
        <G>
          <Defs>
            <LinearGradient id={g('a')} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#E9EDF3" /><Stop offset="1" stopColor="#9AA4B5" /></LinearGradient>
            <LinearGradient id={g('b')} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#7FD6FF" /><Stop offset="1" stopColor="#1E88E5" /></LinearGradient>
          </Defs>
          <Rect x={10} y={19} width={30} height={9} rx={4.5} fill={url('a')} />
          <Rect x={32} y={19} width={9} height={17} rx={3.5} fill={url('a')} />
          <Rect x={30.5} y={34} width={12} height={4} rx={2} fill="#7B8496" />
          <Rect x={18} y={11} width={12} height={5} rx={2.5} fill="#FF6B00" />
          <Rect x={22.5} y={14} width={3} height={6} fill="#B84A00" />
          <Path d="M36.5 41 C36.5 41 29 49.5 29 53.5 C29 57.6 32.4 61 36.5 61 C40.6 61 44 57.6 44 53.5 C44 49.5 36.5 41 36.5 41 Z" fill={url('b')} />
          <Ellipse cx={33.6} cy={53} rx={1.8} ry={3.2} fill="#FFFFFF" opacity={0.75} />
        </G>
      ) : null}
      {nombre === 'climatizacion' ? (
        <G>
          <Defs>
            <LinearGradient id={g('a')} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#FFFFFF" /><Stop offset="1" stopColor="#D5DCE7" /></LinearGradient>
          </Defs>
          <Rect x={9} y={13} width={46} height={20} rx={6} fill={url('a')} stroke="#C3CAD6" strokeWidth={1} />
          <Rect x={14} y={25} width={36} height={3} rx={1.5} fill="#8B93A1" />
          <Circle cx={48} cy={19} r={2} fill="#22C55E" />
          <Path d="M18 38 C14 42 22 44 18 49" stroke="#38BDF8" strokeWidth={3} strokeLinecap="round" fill="none" />
          <Path d="M32 38 C28 42 36 45 32 51" stroke="#0EA5E9" strokeWidth={3} strokeLinecap="round" fill="none" />
          <Path d="M46 38 C42 42 50 44 46 49" stroke="#38BDF8" strokeWidth={3} strokeLinecap="round" fill="none" />
        </G>
      ) : null}
      {nombre === 'linea_blanca' ? (
        <G>
          <Defs>
            <LinearGradient id={g('a')} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFFFFF" /><Stop offset="1" stopColor="#D5DCE7" /></LinearGradient>
            <LinearGradient id={g('b')} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#9AD4FF" /><Stop offset="1" stopColor="#2F80ED" /></LinearGradient>
          </Defs>
          <Rect x={15} y={8} width={34} height={48} rx={6} fill={url('a')} stroke="#C3CAD6" strokeWidth={1} />
          <Rect x={15} y={17} width={34} height={1.5} fill="#C3CAD6" />
          <Circle cx={21} cy={12.5} r={2} fill="#FF6B00" />
          <Rect x={30} y={11} width={14} height={3} rx={1.5} fill="#8B93A1" />
          <Circle cx={32} cy={36} r={12} fill="#E4E8EF" />
          <Circle cx={32} cy={36} r={9} fill={url('b')} />
          <Path d="M25 37 C28 33 31 41 35 36 C37 34 39 35 40 36 L40 40 C37 45 27 45 24 40 Z" fill="#FFFFFF" opacity={0.45} />
          <Circle cx={28} cy={32} r={1.6} fill="#FFFFFF" opacity={0.9} />
        </G>
      ) : null}
      {nombre === 'cerrajeria' ? (
        <G>
          <Defs>
            <LinearGradient id={g('a')} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFE38A" /><Stop offset="1" stopColor="#E0A21A" /></LinearGradient>
          </Defs>
          <G transform="rotate(-35 32 32)">
            <Circle cx={20} cy={32} r={11} fill={url('a')} stroke="#C98A0E" strokeWidth={1.2} />
            <Circle cx={18} cy={32} r={4} fill={FONDO.cerrajeria} />
            <Rect x={29} y={29} width={26} height={6} rx={2} fill={url('a')} stroke="#C98A0E" strokeWidth={1.2} />
            <Rect x={45} y={35} width={4} height={6} rx={1} fill="#E0A21A" />
            <Rect x={51} y={35} width={4} height={8} rx={1} fill="#E0A21A" />
            <Path d="M13 27 C15 24 19 23 22 24" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.7} />
          </G>
        </G>
      ) : null}
      {nombre === 'pintura' ? (
        <G>
          <Defs>
            <LinearGradient id={g('a')} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#FFA55C" /><Stop offset="1" stopColor="#FF6B00" /></LinearGradient>
          </Defs>
          <Rect x={10} y={11} width={36} height={14} rx={7} fill={url('a')} />
          <Rect x={14} y={14} width={22} height={3} rx={1.5} fill="#FFFFFF" opacity={0.45} />
          <Path d="M46 18 H51 V31 H33 V39" stroke="#0C1C40" strokeWidth={3} fill="none" strokeLinejoin="round" />
          <Rect x={29.5} y={38} width={7} height={18} rx={3.5} fill="#0C1C40" />
          <Path d="M16 25 V30 C16 32 19 32 19 30 V25 Z" fill="#FF6B00" />
          <Path d="M24 25 V34 C24 36.5 27.5 36.5 27.5 34 V25 Z" fill="#FF6B00" />
        </G>
      ) : null}
      {nombre === 'mecanica' ? (
        <G>
          <Defs>
            <LinearGradient id={g('a')} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#FF7A7A" /><Stop offset="1" stopColor="#D93025" /></LinearGradient>
          </Defs>
          <Path d="M8 38 C8 33 11 31 15 30 L21 21 C22.5 19 24.5 18 27 18 H39 C41.5 18 43.5 19 45 21 L50 30 C54 31 56 33 56 38 V42 C56 43.7 54.7 45 53 45 H11 C9.3 45 8 43.7 8 42 Z" fill={url('a')} />
          <Path d="M23 29 L26.5 23 C27 22.3 27.8 22 28.6 22 H31 V29 Z" fill="#CFE9FF" />
          <Path d="M34 22 H37.4 C38.2 22 39 22.3 39.5 23 L43 29 H34 Z" fill="#CFE9FF" />
          <Rect x={12} y={34} width={8} height={3} rx={1.5} fill="#FFE38A" />
          <Circle cx={19} cy={45} r={7} fill="#1F2937" />
          <Circle cx={19} cy={45} r={3} fill="#C3CAD6" />
          <Circle cx={45} cy={45} r={7} fill="#1F2937" />
          <Circle cx={45} cy={45} r={3} fill="#C3CAD6" />
          <Path d="M14 31 H24" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={0.5} />
        </G>
      ) : null}
      {nombre === 'todo' ? (
        <G>
          <Rect x={13} y={13} width={17} height={17} rx={5} fill="#FF6B00" />
          <Rect x={34} y={13} width={17} height={17} rx={5} fill="#2F80ED" />
          <Rect x={13} y={34} width={17} height={17} rx={5} fill="#FFC53D" />
          <Rect x={34} y={34} width={17} height={17} rx={5} fill="#0C1C40" />
        </G>
      ) : null}
      {nombre === 'general' ? (
        <G>
          <Defs>
            <LinearGradient id={g('a')} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#E9EDF3" /><Stop offset="1" stopColor="#8B93A1" /></LinearGradient>
          </Defs>
          <G transform="rotate(45 32 32)">
            <Rect x={29} y={16} width={6} height={36} rx={3} fill={url('a')} />
            <Path d="M24 12 C24 7 40 7 40 12 V18 H36 V12 H28 V18 H24 Z" fill={url('a')} />
          </G>
          <G transform="rotate(-45 32 32)">
            <Rect x={30} y={10} width={4} height={22} rx={1.5} fill="#AEB6C4" />
            <Rect x={27.5} y={32} width={9} height={20} rx={4.5} fill="#FF6B00" />
            <Rect x={29.5} y={35} width={2} height={13} rx={1} fill="#FFFFFF" opacity={0.5} />
          </G>
        </G>
      ) : null}
    </Svg>
    </View>
  );
}
