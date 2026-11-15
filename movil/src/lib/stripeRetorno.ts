// Lectura del regreso desde el formulario de Stripe: /tarjetas?tarjeta=ok|cancelada&session_id=cs_...
// Función pura (sin expo-linking) para poder probarla con node --test.

export type RetornoStripe = { estado: 'ok' | 'cancelada' | 'ninguno'; sessionId: string | null };

type Params = Record<string, string | string[] | undefined | null>;

function primero(v: string | string[] | undefined | null): string {
  return String((Array.isArray(v) ? v[0] : v) ?? '').trim();
}

function queryDe(url: string): Params {
  const sinHash = url.split('#')[0];
  const i = sinHash.indexOf('?');
  const out: Params = {};
  if (i < 0) return out;
  for (const par of sinHash.slice(i + 1).split('&')) {
    if (!par) continue;
    const [k, v = ''] = par.split('=');
    try {
      out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    } catch {
      // Parámetro mal codificado: se ignora.
    }
  }
  return out;
}

// Acepta la URL completa (teléfono, openAuthSessionAsync) o los parámetros ya leídos (web, useLocalSearchParams).
export function leerRetornoStripe(entrada: string | Params | null | undefined): RetornoStripe {
  const params = typeof entrada === 'string' ? queryDe(entrada) : entrada || {};
  const tarjeta = primero(params.tarjeta);
  const sid = primero(params.session_id);
  // Solo se confía en un id de Checkout Session de Stripe; cualquier otra cosa no se manda al servidor.
  const sessionId = /^cs_[A-Za-z0-9_]{1,250}$/.test(sid) ? sid : null;
  if (tarjeta === 'cancelada') return { estado: 'cancelada', sessionId: null };
  if (tarjeta === 'ok') return { estado: 'ok', sessionId };
  return { estado: 'ninguno', sessionId: null };
}
