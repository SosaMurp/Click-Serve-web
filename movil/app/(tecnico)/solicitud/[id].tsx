import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { goBack } from '@/src/lib/nav';
import { AppBar, Banner, Button, color, Icon, radius, Screen, SectionHeader, Skeleton, space, Surface, Text, Ilustracion, ilustracionDe } from '@/src/design';
import { errorMessage } from '@/src/api/client';
import { solicitudesApi } from '@/src/api/endpoints';
import { formatDateTime, formatDistance, formatShortDate, formatTime12 } from '@/src/lib/format';
import { hapticSuccess } from '@/src/lib/media';
import { useSession } from '@/src/state/session';
import { MapView } from '@/src/features/map/MapView';
import { Gallery } from '@/src/features/orders/Gallery';
import { useSolicitud } from '@/src/features/orders/hooks';
import { dialog } from '@/src/ui/dialog';
import { toast } from '@/src/ui/toast';

// RF-58/59: detalle de una solicitud nueva antes de aceptarla (zona aproximada, sin datos de contacto).
export default function SolicitudNueva() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useSession();
  const { data: s, loading, error } = useSolicitud(id);
  const [busy, setBusy] = useState<string | null>(null);

  // Si ya es mía (la acepté) o la tomó otro, esta pantalla no aplica.
  useEffect(() => {
    if (s?.es_tecnico_asignado) router.replace({ pathname: '/trabajo/[id]', params: { id: String(s.id_solicitud) } });
  }, [s, router]);

  async function accept() {
    setBusy('a');
    try {
      await solicitudesApi.aceptar(id);
      hapticSuccess();
      toast.success('Solicitud aceptada. Avisa cuando vayas en camino.');
      router.replace({ pathname: '/trabajo/[id]', params: { id } });
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(null);
    }
  }

  async function discard() {
    const ok = await dialog.confirm({ title: '¿Descartar esta solicitud?', message: 'Ya no te aparecerá en la lista.', confirmText: 'Descartar' });
    if (!ok) return;
    setBusy('d');
    try {
      await solicitudesApi.descartar(id);
      goBack(router);
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(null);
    }
  }

  const disponible = s?.estado === 'PENDIENTE';
  return (
    <Screen
      header={<AppBar title="Solicitud nueva" subtitle={s?.folio} fallbackHref="/trabajos" />}
      footer={s && disponible ? (
        <View style={styles.footer}>
          <Button title="Descartar" variant="outlined" onPress={discard} loading={busy === 'd'} disabled={!!busy} style={styles.flex} />
          <Button variant="accent" title="Aceptar trabajo" icon="check" onPress={accept} loading={busy === 'a'} disabled={!!busy || !user?.aprobado} size="lg" style={styles.flex2} />
        </View>
      ) : undefined}
    >
      {loading ? <Skeleton height={260} /> : null}
      {error && !s ? <Banner tone="error" title="Esta solicitud ya no está disponible" body={error} /> : null}
      {s ? (
        <>
          {!disponible ? <Banner tone="info" title="Ya no está disponible" body="Otro técnico la aceptó o el cliente la canceló." style={styles.gap} /> : null}
          {s.propuesta_a_mi || s.tecnico_propuesto === user?.id_usuario ? <Banner tone="success" title="El cliente te eligió a ti" body="Tienes 10 minutos para aceptarla antes de que se ofrezca a otros técnicos." style={styles.gap} /> : null}

          <Surface>
            <View style={styles.head}>
              <Ilustracion nombre={ilustracionDe(s.categoria_nombre)} size={56} />
              <View style={styles.flex}>
                <Text variant="headline">{s.categoria_nombre}</Text>
                {s.servicio_nombre ? <Text variant="body" tone="soft">{s.servicio_nombre}</Text> : null}
              </View>
            </View>
            <Text variant="body" style={styles.desc}>{s.descripcion}</Text>
          </Surface>

          <View style={styles.facts}>
            {[
              { icon: 'navigation' as const, label: 'Distancia', value: formatDistance(s.distancia_km) },
              { icon: 'calendar' as const, label: 'Cuándo', value: s.fecha_preferida ? `${formatShortDate(s.fecha_preferida)}${s.hora_preferida ? ` · ${formatTime12(s.hora_preferida)}` : ''}` : 'Lo antes posible' },
              { icon: 'user' as const, label: 'Cliente', value: `${s.cliente_nombre || 'Cliente'} ${s.cliente_apellido || ''}`.trim() },
            ].filter((f) => f.value).map((f, i) => <Fact key={f.label} {...f} linea={i > 0} />)}
          </View>

          {s.latitud_aprox != null && s.longitud_aprox != null ? (
            <>
              <SectionHeader title="Zona aproximada" />
              <View style={styles.map}>
                <MapView center={{ lat: Number(s.latitud_aprox), lng: Number(s.longitud_aprox) }} zoom={14} height={180} markers={[{ id: 'zona', lat: Number(s.latitud_aprox), lng: Number(s.longitud_aprox), kind: 'solicitud', label: s.zona || 'Zona' }]} />
              </View>
              <Text variant="caption" tone="muted" style={styles.note}>La dirección exacta aparece cuando el cliente paga el precio base.</Text>
            </>
          ) : s.zona ? <Text variant="body" tone="soft" style={styles.gap}>Zona: {s.zona}</Text> : null}

          {s.imagenes?.length ? (
            <>
              <SectionHeader title="Fotos del cliente" />
              <Gallery items={s.imagenes.map((im, i) => ({ url: im.url, label: `Foto ${i + 1}` }))} size={96} />
            </>
          ) : null}
          <Text variant="caption" tone="muted" style={styles.note}>Publicada {formatDateTime(s.fecha_creacion).replace(/^Hoy/, 'hoy').replace(/^Mañana/, 'mañana')}</Text>
        </>
      ) : null}
    </Screen>
  );
}

function Fact({ icon, label, value, linea }: { icon: 'navigation' | 'calendar' | 'user'; label: string; value: string; linea?: boolean }) {
  return (
    <View style={[styles.fact, linea && styles.factLinea]}>
      <Icon name={icon} size={18} color={color.brandInk} />
      <Text variant="caption" tone="muted">{label}</Text>
      <Text variant="label" numberOfLines={2} align="center">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex2: { flex: 2 },
  gap: { marginBottom: space.md },
  footer: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  catIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  desc: { marginTop: space.md },
  facts: { flexDirection: 'row', marginTop: space.md, backgroundColor: color.surface, borderRadius: radius.xl, paddingVertical: space.md },
  fact: { flex: 1, paddingHorizontal: space.sm, alignItems: 'center', gap: 4 },
  factLinea: { borderLeftWidth: 1, borderLeftColor: color.line },
  map: { borderRadius: radius.md, overflow: 'hidden' },
  note: { marginTop: space.sm },
});
