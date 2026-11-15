import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppBar, Banner, Chip, EmptyState, Screen, SkeletonList, space, Text, TextField } from '@/src/design';
import { errorMessage } from '@/src/api/client';
import { TecnicoCard } from '@/src/features/search/TecnicoCard';
import { busquedaApi, chatDirectoApi, type TecnicoBusqueda } from '@/src/api/endpoints';
import { useCategorias } from '@/src/features/orders/hooks';
import { toast } from '@/src/ui/toast';

const MIN_CHARS = 2;
const DEBOUNCE_MS = 350;

// Búsqueda de técnicos por nombre o servicio, con filtro por categoría. Desde aquí se abre el perfil
// o se escribe un mensaje directo (sin solicitud de por medio).
export default function BuscarTecnicos() {
  const router = useRouter();
  const categorias = useCategorias();
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [results, setResults] = useState<TecnicoBusqueda[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const lastRequest = useRef(0);

  // Espera a que la persona deje de escribir antes de consultar.
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const short = term.length === 1;
    if (short) return;
    if (!term && !categoria) {
      setResults(null);
      setError(null);
      return;
    }
    const request = ++lastRequest.current;
    setLoading(true);
    setError(null);
    busquedaApi.tecnicos(term, categoria)
      .then((r) => { if (request === lastRequest.current) setResults(r.tecnicos); })
      .catch((e) => { if (request === lastRequest.current) setError(errorMessage(e)); })
      .finally(() => { if (request === lastRequest.current) setLoading(false); });
  }, [term, categoria]);

  async function escribir(t: TecnicoBusqueda) {
    setBusy(t.id_usuario);
    try {
      const { conversacion } = await chatDirectoApi.abrir(t.id_usuario);
      router.push({ pathname: '/chat-directo/[id]', params: { id: String(conversacion.id_conversacion), nombre: `${t.nombre} ${t.apellido}` } });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const shortQuery = term.length === 1;

  return (
    <Screen header={<AppBar title="Buscar técnicos" fallbackHref="/inicio" />}>
      <TextField
        label="Buscar"
        hideLabel
        icon="search"
        placeholder="Nombre o servicio, ej. plomería"
        value={q}
        onChangeText={setQ}
        autoFocus
        returnKeyType="search"
        maxLength={60}
        autoCorrect={false}
        accessibilityLabel="Buscar técnicos por nombre o servicio"
      />

      <View style={styles.chips}>
        {categorias.map((c) => (
          <Chip key={c.codigo} label={c.nombre} selected={categoria === c.codigo} onPress={() => setCategoria(categoria === c.codigo ? null : c.codigo)} />
        ))}
      </View>

      {shortQuery ? <Text variant="bodySm" tone="muted" style={styles.hint}>Escribe al menos {MIN_CHARS} letras.</Text> : null}
      {error ? <Banner tone="error" title="No pudimos buscar" body={error} style={styles.gap} /> : null}
      {loading && !results ? <SkeletonList rows={3} /> : null}

      {!term && !categoria ? (
        <EmptyState icon="search" title="Busca a tu técnico" body="Escribe su nombre o el servicio que necesitas, o elige una categoría." />
      ) : null}

      {results && !results.length && !loading ? (
        <EmptyState icon="users" title="Sin resultados" body="Prueba con otro nombre o servicio. También puedes pedir un servicio y dejar que te asignemos al técnico más cercano." />
      ) : null}

      {results && results.length ? (
        <View style={loading ? styles.dim : undefined}>
          <Text variant="bodySm" tone="muted" style={styles.count}>{results.length === 1 ? '1 técnico encontrado' : `${results.length} técnicos encontrados`}</Text>
          {results.map((t) => (
            <TecnicoCard
              key={t.id_usuario}
              t={t}
              onPerfil={() => router.push({ pathname: '/tecnico/[id]', params: { id: String(t.id_usuario) } })}
              onMensaje={() => escribir(t)}
              busy={busy === t.id_usuario}
              disabled={busy !== null}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md, marginBottom: space.lg },
  hint: { marginBottom: space.md },
  gap: { marginTop: space.md },
  dim: { opacity: 0.6 },
  count: { marginBottom: space.md },
});
