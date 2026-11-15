import React, { useEffect, useRef } from 'react';
import { AppState, Keyboard, Platform, View } from 'react-native';
import { useSession } from './session';

// RNF-04: la sesión se cierra tras 3 minutos sin usar la app (sin tocar la pantalla ni escribir).
// El servidor aplica la misma regla; aquí se cierra a tiempo para que los datos no queden a la vista,
// y mientras la persona sí la usa se avisa al servidor una vez por minuto (con /api/me, que además
// renueva los enlaces de las fotos, que vencen a los 5 minutos).
const LIMITE_MS = 3 * 60 * 1000;
const AVISO_MS = 60 * 1000;
const MENSAJE = 'Cerramos tu sesión por 3 minutos sin actividad. Inicia sesión de nuevo.';

let ultimoToque = Date.now();
let ultimoAviso = 0;
let mantener = 0;

export function marcarActividad() {
  ultimoToque = Date.now();
}

// Mientras `activo` sea verdadero la sesión no se cierra por inactividad: el técnico que va en camino
// compartiendo su ubicación o el cliente que espera la respuesta de un técnico.
export function useMantenerSesion(activo: boolean) {
  useEffect(() => {
    if (!activo) return undefined;
    mantener += 1;
    return () => {
      mantener -= 1;
      marcarActividad();
    };
  }, [activo]);
}

export function InactividadHost({ children }: { children: React.ReactNode }) {
  const { status, signOut, refresh } = useSession();
  const cerrando = useRef(false);

  useEffect(() => {
    if (status !== 'signedIn') return undefined;
    cerrando.current = false;
    marcarActividad();

    const revisar = () => {
      const ahora = Date.now();
      if (mantener > 0) ultimoToque = ahora;
      if (ahora - ultimoToque > LIMITE_MS) {
        if (cerrando.current) return;
        cerrando.current = true;
        // Sin avisar al servidor: allá la sesión ya cuenta como inactiva y se rechaza sola.
        signOut({ remote: false, message: MENSAJE });
        return;
      }
      if (ultimoToque > ultimoAviso && ahora - ultimoAviso >= AVISO_MS) {
        ultimoAviso = ahora;
        refresh();
      }
    };

    const timer = setInterval(revisar, 10000);
    // Al volver de segundo plano (los relojes se pausan ahí) se revisa de inmediato.
    const app = AppState.addEventListener('change', (estado) => { if (estado === 'active') revisar(); });
    const teclado = Keyboard.addListener('keyboardDidShow', marcarActividad);
    let quitarWeb: (() => void) | undefined;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const h = () => marcarActividad();
      window.addEventListener('pointerdown', h, true);
      window.addEventListener('keydown', h, true);
      window.addEventListener('wheel', h, { capture: true, passive: true });
      quitarWeb = () => {
        window.removeEventListener('pointerdown', h, true);
        window.removeEventListener('keydown', h, true);
        window.removeEventListener('wheel', h, true);
      };
    }
    return () => {
      clearInterval(timer);
      app.remove();
      teclado.remove();
      quitarWeb?.();
    };
  }, [status, signOut, refresh]);

  // Cualquier toque o deslizamiento en la pantalla cuenta como actividad (sin quitarle el toque a nadie).
  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={() => { marcarActividad(); return false; }}
      onMoveShouldSetResponderCapture={() => { marcarActividad(); return false; }}
    >
      {children}
    </View>
  );
}
