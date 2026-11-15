import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { pagosApi } from '../../api/endpoints';
import { leerRetornoStripe } from '../../lib/stripeRetorno';

export type ResultadoStripe = 'ok' | 'cancelada' | 'redirigiendo';

// Stripe: la tarjeta se captura en el formulario seguro de Stripe (Checkout en modo "setup"), nunca en la app.
// Web: se navega a Stripe y al terminar regresa a /tarjetas con ?tarjeta=ok&session_id=...
// Teléfono: se abre en el navegador del sistema y regresa a la app por el enlace click-serve:// (o exp:// en Expo Go).
export async function agregarTarjetaStripe(): Promise<ResultadoStripe> {
  const retorno = Platform.OS === 'web' && typeof window !== 'undefined'
    ? `${window.location.origin}/tarjetas`
    : Linking.createURL('tarjetas');
  const { url } = await pagosApi.sesionStripe(retorno);

  if (Platform.OS === 'web') {
    window.location.assign(url);
    return 'redirigiendo';
  }

  const r = await WebBrowser.openAuthSessionAsync(url, retorno);
  if (r.type !== 'success' || !r.url) return 'cancelada';
  const { estado, sessionId } = leerRetornoStripe(r.url);
  if (estado !== 'ok' || !sessionId) return 'cancelada';
  // Confirmación idempotente por si el servidor aún no guardaba la tarjeta (el webhook también lo hace).
  await pagosApi.confirmarStripe(sessionId);
  return 'ok';
}
