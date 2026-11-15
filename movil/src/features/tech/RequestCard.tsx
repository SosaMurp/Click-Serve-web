import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar, Button, color, Icon, IconName, radius, space, Surface, Text, Ilustracion, ilustracionDe } from '../../design';
import type { Solicitud } from '../../api/types';
import { formatDistance, formatMoney, formatRelative, formatShortDate, formatTime12 } from '../../lib/format';

type Props = {
  s: Solicitud;
  onAccept: () => void;
  onReject: () => void;
  onOpen: () => void;
  busy?: 'a' | 'd' | null;
  canAccept: boolean;
};


// Tarjeta de solicitud recibida (RF-58), pensada para adultos mayores y jóvenes: el oficio con su ícono en naranja,
// datos clave en tres columnas (distancia, fecha y hora), la falla en texto legible y dos botones grandes. Toda la tarjeta abre el detalle.
export function RequestCard({ s, onAccept, onReject, onOpen, busy, canAccept }: Props) {
  const cliente = `${s.cliente_nombre || 'Cliente'} ${s.cliente_apellido || ''}`.trim();
  const directa = !!s.propuesta_a_mi;
  const publicada = formatRelative(s.fecha_creacion);
  return (
    <Surface padded={false} style={StyleSheet.flatten([styles.card, directa && styles.cardDirecta])}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Ver la solicitud de ${cliente}, ${s.categoria_nombre}`} onPress={onOpen}>
        <View style={styles.head}>
          <View style={styles.catIcon}>
            <Ilustracion nombre={ilustracionDe(s.categoria_nombre)} size={52} tono="gris" />
          </View>
          <View style={styles.flex}>
            <Text variant="title" numberOfLines={1}>{s.categoria_nombre}</Text>
            {s.servicio_nombre ? <Text variant="bodySm" numberOfLines={1}>{s.servicio_nombre}</Text> : null}
            <Text variant="caption" tone="muted" tabular>Folio {s.folio}</Text>
          </View>
          <View style={[styles.tag, directa ? styles.tagDirecta : styles.tagCerca]}>
            <Icon name={directa ? 'star' : 'map-pin'} size={14} color={directa ? color.inkOnColor : color.brand} />
            <Text variant="overline" style={{ color: directa ? color.inkOnColor : color.brand }}>{directa ? 'Para ti' : 'Cerca'}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.who}>
            <Avatar nombre={s.cliente_nombre} apellido={s.cliente_apellido} size={44} />
            <View style={styles.flex}>
              <Text variant="subtitle" numberOfLines={1}>{cliente}</Text>
              {publicada ? <Text variant="bodySm" tone="muted">Pidió el servicio {publicada}</Text> : null}
            </View>
          </View>

          <View style={styles.tiles}>
            <Tile icon="navigation" label="Distancia" value={s.distancia_km != null ? formatDistance(s.distancia_km) : s.zona || '—'} destacado />
            <Tile icon="calendar" label="Fecha" value={s.fecha_preferida ? formatShortDate(s.fecha_preferida) : 'Abierta'} />
            <Tile icon="clock" label="Hora" value={s.hora_preferida ? formatTime12(s.hora_preferida) : 'Lo antes posible'} />
          </View>

          <View style={styles.desc}>
            <Text variant="overline" tone="muted">¿Qué necesita?</Text>
            <Text variant="bodyLg" numberOfLines={3}>{s.descripcion}</Text>
            {s.zona ? (
              <View style={styles.zona}>
                <Icon name="map" size={16} color={color.inkMuted} />
                <Text variant="bodySm" tone="muted" numberOfLines={1} style={styles.flex}>Zona: {s.zona}</Text>
              </View>
            ) : null}
          </View>

          {s.mi_precio ? (
            <View style={styles.precio} accessibilityLabel={`Tu precio base: ${s.mi_precio} pesos`}>
              <Icon name="lock" size={18} color={color.ink} />
              <View style={styles.flex}>
                <Text variant="label" style={styles.precioText}>Tu precio base</Text>
                <Text variant="caption" tone="soft">El cliente lo paga en custodia al aceptar</Text>
              </View>
              <Text variant="title" style={styles.precioText}>{formatMoney(s.mi_precio)}</Text>
            </View>
          ) : null}

          <View style={styles.more}>
            <Text variant="label" style={styles.moreText}>Ver detalle y fotos</Text>
            <Icon name="chevron-right" size={18} color={color.brand} />
          </View>
        </View>
      </Pressable>

      <View style={styles.actions}>
        <Button title="Rechazar" variant="outlined" icon="x" size="xl" onPress={onReject} loading={busy === 'd'} disabled={!!busy} style={styles.flex} full />
        <Button title="Aceptar" variant="accent" icon="check" size="xl" onPress={onAccept} loading={busy === 'a'} disabled={!!busy || !canAccept} style={styles.flex2} full />
      </View>
    </Surface>
  );
}

function Tile({ icon, label, value, destacado }: { icon: IconName; label: string; value: string; destacado?: boolean }) {
  return (
    <View style={[styles.tile, destacado && styles.tileOn]} accessibilityLabel={`${label}: ${value}`}>
      <Icon name={icon} size={20} color={destacado ? color.accentStrong : color.brand} />
      <Text variant="caption" tone="muted">{label}</Text>
      <Text variant="subtitle" numberOfLines={2} style={destacado ? styles.tileOnText : undefined}>{value}</Text>
    </View>
  );
}

// Recuadro de dato (lo usan otras pantallas del técnico).
export function InfoBox({ icon, label, value }: { icon?: IconName; label: string; value: string }) {
  return (
    <View style={styles.box} accessibilityLabel={`${label}: ${value}`}>
      {icon ? <Icon name={icon} size={18} color={color.inkSoft} /> : null}
      <View style={styles.flex}>
        <Text variant="overline" tone="muted" style={styles.boxLabel}>{label}</Text>
        <Text variant="subtitle" weight="700" numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex2: { flex: 1.4 },
  card: { marginBottom: space.lg, overflow: 'hidden' },
  cardDirecta: { borderColor: color.accent, borderWidth: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.lg },
  catIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  folio: { opacity: 0.8, marginTop: 2 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: space.sm, paddingVertical: 6 },
  tagDirecta: { backgroundColor: color.accent },
  tagCerca: { backgroundColor: color.brandSoft },
  body: { padding: space.lg, gap: space.md },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  tiles: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, gap: 2, paddingVertical: space.sm },
  tileOn: {},
  tileOnText: { color: color.ink },
  desc: { gap: space.xs },
  zona: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs },
  precio: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.md, borderTopWidth: 1, borderTopColor: color.line },
  precioText: { color: color.ink },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  moreText: { color: color.brand },
  actions: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.lg },
  box: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  boxLabel: { fontSize: 11 },
});
