import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppBar, Banner, Button, color, EmptyState, radius, Screen, SectionHeader, SkeletonList, space, Surface, Text, Ilustracion, ilustracionDe } from '@/src/design';
import { errorMessage } from '@/src/api/client';
import { tecnicoApi } from '@/src/api/endpoints';
import type { PrecioServicio } from '@/src/api/types';
import { useLoader } from '@/src/lib/useLoader';
import { formatDate, formatMoney } from '@/src/lib/format';
import { dialog } from '@/src/ui/dialog';
import { toast } from '@/src/ui/toast';


// Precio base por servicio del catálogo: es lo que el cliente paga en custodia al aceptarte. Se elige dentro del
// rango que fija Click & Serve y se puede cambiar una vez por semana por servicio. La visita de diagnóstico es fija.
export default function MisPrecios() {
  const router = useRouter();
  const { data, loading, error, setData, reload } = useLoader(() => tecnicoApi.precios().then((r) => r.servicios), []);
  const [busy, setBusy] = useState<number | null>(null);
  const lista = data || [];
  const categorias = [...new Set(lista.map((s) => s.categoria_nombre))];

  async function cambiar(s: PrecioServicio) {
    const valor = await dialog.prompt({
      title: s.nombre,
      message: `Tu precio base para este servicio. Debe estar entre ${formatMoney(s.precio_min)} y ${formatMoney(s.precio_max)} (IVA incluido). Ahora: ${formatMoney(s.precio)}. Solo podrás volver a cambiarlo en 7 días.`,
      placeholder: `Ej. ${s.precio_sugerido.split('.')[0]}`,
      keyboardType: 'number-pad',
      confirmText: 'Guardar',
    });
    if (valor === null || !valor.trim()) return;
    setBusy(s.id_servicio);
    try {
      const r = await tecnicoApi.fijarPrecio(s.id_servicio, valor.trim().replace(',', '.'));
      setData(r.servicios);
      toast.success(r.mensaje);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen header={<AppBar title="Mis precios" />} refreshing={false} onRefresh={reload}>
      <Banner
        tone="info"
        title="Tu precio base por servicio"
        body="Es lo que el cliente paga en custodia al aceptarte, así tu cobro queda asegurado antes de salir. Si en el domicilio hace falta más, cotizas un adicional en la app. Cada precio se puede cambiar una vez por semana."
      />
      {loading && !data ? <View style={styles.gap}><SkeletonList rows={4} /></View> : null}
      {error && !data ? <Banner tone="error" title="No pudimos cargar tus precios" body={error} style={styles.gap} /> : null}
      {!loading && data && !lista.length ? (
        <EmptyState icon="tag" title="Sin servicios" body="Agrega tus especialidades para ver y fijar tus precios." action={<Button title="Mis especialidades" onPress={() => router.push('/especialidades')} />} />
      ) : null}

      {categorias.map((cat) => {
        const servicios = lista.filter((s) => s.categoria_nombre === cat);
        return (
          <View key={cat}>
            <SectionHeader title={cat} />
            <Surface padded={false}>
              {servicios.map((s, i) => {
                const bloqueado = !!s.cambiar_desde && new Date(s.cambiar_desde) > new Date();
                return (
                  <View key={s.id_servicio} style={[styles.row, i > 0 && styles.divider]}>
                    <Ilustracion nombre={s.es_diagnostico ? 'general' : ilustracionDe(cat)} size={40} tono="gris" />
                    <View style={styles.flex}>
                      <Text variant="subtitle">{s.nombre}</Text>
                      <Text variant="caption" tone="muted">
                        {s.es_diagnostico ? 'Precio fijo para todos los técnicos' : `Rango ${formatMoney(s.precio_min)} – ${formatMoney(s.precio_max)}`}
                      </Text>
                      {bloqueado ? <Text variant="caption" tone="muted">Podrás cambiarlo el {formatDate(s.cambiar_desde)}</Text> : null}
                    </View>
                    <View style={styles.right}>
                      <Text variant="title" style={styles.precio}>{formatMoney(s.precio)}</Text>
                      {!s.es_diagnostico ? <Text variant="caption" tone="muted">{s.precio_propio ? 'Tu precio' : 'Sugerido'}</Text> : null}
                      {!s.es_diagnostico ? (
                        <Button title="Cambiar" variant="tonal" onPress={() => cambiar(s)} loading={busy === s.id_servicio} disabled={busy !== null || bloqueado} />
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </Surface>
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  gap: { marginTop: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  divider: { borderTopWidth: 1, borderTopColor: color.line },
  icon: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: color.brandSoft, alignItems: 'center', justifyContent: 'center' },
  right: { alignItems: 'flex-end', gap: 4 },
  precio: { color: color.accentInk },
});
