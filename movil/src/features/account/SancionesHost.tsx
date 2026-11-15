import React, { useCallback } from 'react';
import { Banner } from '../../design';
import { useRealtime } from '../../state/realtime';
import { useSession } from '../../state/session';
import { dialog } from '../../ui/dialog';
import { formatDateTime } from '../../lib/format';

// Escala progresiva de sanciones: avisa con el mensaje oficial de cada nivel cuando el servidor aplica una sanción.
// Llega por WebSocket (cuenta.sancion) y también en la respuesta del chat o de la cancelación; cada sanción se
// muestra una sola vez aunque llegue por los dos caminos. El nivel 1 lo muestra el propio chat como banner.

export type Sancion = { nivel: number; titulo: string; mensaje: string; hasta?: string | null };

let ultima: string | null = null;

export function avisarSancion(s: Sancion | null | undefined) {
  if (!s || s.nivel < 2) return;
  const clave = `${s.nivel}|${s.hasta ?? ''}`;
  if (clave === ultima) return;
  ultima = clave;
  const hasta = s.hasta && s.nivel < 4 ? `\n\nPodrás volver a pedir y aceptar trabajos el ${formatDateTime(s.hasta)}.` : '';
  dialog.alert(s.titulo, `${s.mensaje}${hasta}`);
}

export function SancionesHost() {
  const { refresh } = useSession();
  useRealtime('cuenta.sancion', useCallback((s: Sancion) => {
    avisarSancion(s);
    // Nivel 2 y 3 cambian lo que puede hacer la cuenta; el 4 cierra la sesión desde el servidor.
    if (s.nivel >= 2 && s.nivel < 4) refresh();
  }, [refresh]));
  return null;
}

// Aviso fijo mientras la cuenta está suspendida (nivel 2 o 3): no puede pedir ni aceptar trabajos nuevos.
export function SuspensionBanner({ style }: { style?: object }) {
  const { user } = useSession();
  const hasta = user?.suspendido_hasta;
  if (!hasta || new Date(hasta) <= new Date()) return null;
  return (
    <Banner
      tone="error"
      title="Cuenta suspendida temporalmente"
      body={`Por incumplir las políticas de contratación dentro de la app no puedes pedir ni aceptar trabajos nuevos hasta el ${formatDateTime(hasta)}. Tus servicios en curso siguen activos.`}
      style={style}
    />
  );
}
