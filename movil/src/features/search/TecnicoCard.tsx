import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar, Button, color, Icon, IconName, radius, space, Text } from '../../design';
import { fileUrl } from '../../api/client';
import type { TecnicoBusqueda } from '../../api/endpoints';
import { iconoCategoria } from '../../lib/categorias';
import { formatMoney } from '../../lib/format';

// Tarjeta de un técnico en el buscador del cliente, pensada para adultos mayores y jóvenes: foto grande con
// el punto de disponibilidad, sellos de confianza, tres datos grandes (calificación, trabajos, estado),
// sus oficios con ícono, una línea de su presentación y dos botones grandes.
export function TecnicoCard({ t, onPerfil, onMensaje, busy, disabled }: {
  t: TecnicoBusqueda;
  onPerfil: () => void;
  onMensaje: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const nombre = `${t.nombre} ${t.apellido}`.trim();
  const calif = t.calificacion ? Number(t.calificacion).toFixed(1) : null;
  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Ver el perfil de ${nombre}`} onPress={onPerfil}>
        <View style={styles.top}>
          <View style={styles.avatarWrap}>
            <Avatar uri={fileUrl(t.foto_url)} nombre={t.nombre} apellido={t.apellido} size={76} ring />
            <View style={[styles.dot, { backgroundColor: t.disponible ? color.success : color.lineStrong }]} accessibilityLabel={t.disponible ? 'Disponible' : 'Desconectado'} />
          </View>
          <View style={styles.flex}>
            <Text variant="title" numberOfLines={2}>{nombre}</Text>
            <View style={styles.sellos}>
              <Sello icon="shield" label="Identidad verificada" tone="brand" />
              {t.verificado_sep ? <Sello icon="award" label="Cédula SEP" tone="accent" /> : null}
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.stats}>
            <Stat icon="star" iconColor={color.accent} value={calif || 'Nuevo'} label={calif ? `${t.resenas ?? 0} ${t.resenas === 1 ? 'reseña' : 'reseñas'}` : 'Sin reseñas'} />
            <Stat icon="check-circle" iconColor={color.brand} value={String(t.trabajos ?? 0)} label={t.trabajos === 1 ? 'trabajo hecho' : 'trabajos hechos'} />
          </View>

          <View style={styles.oficios}>
            {(t.especialidades.length ? t.especialidades : [{ codigo: 'general', nombre: 'Servicios generales' }]).slice(0, 3).map((e) => (
              <View key={e.codigo} style={styles.oficio}>
                <Icon name={iconoCategoria(e.nombre)} size={14} color={color.brand} />
                <Text variant="bodySm" weight="600" style={styles.oficioText} numberOfLines={1}>{e.nombre}{e.precio ? ` · desde ${formatMoney(e.precio, { entero: true })}` : ''}</Text>
              </View>
            ))}
            {t.especialidades.length > 3 ? <Text variant="bodySm" tone="muted" style={styles.masOficios}>+{t.especialidades.length - 3} más</Text> : null}
          </View>

          {t.bio ? <Text variant="body" tone="soft" numberOfLines={2} style={styles.bio}>“{t.bio}”</Text> : null}
        </View>
      </Pressable>

      <View style={styles.actions}>
        <Button title="Ver perfil" variant="outlined" icon="user" size="xl" onPress={onPerfil} style={styles.flex} full />
        <Button title="Mensaje" variant="accent" icon="message-circle" size="xl" onPress={onMensaje} loading={busy} disabled={disabled} style={styles.flex} full />
      </View>
    </View>
  );
}

function Sello({ icon, label, tone }: { icon: IconName; label: string; tone: 'brand' | 'accent' }) {
  const fg = tone === 'brand' ? color.brand : color.accentInk;
  return (
    <View style={[styles.sello, { backgroundColor: tone === 'brand' ? color.brandSoft : color.accentSoft }]}>
      <Icon name={icon} size={13} color={fg} />
      <Text variant="caption" style={{ color: fg }}>{label}</Text>
    </View>
  );
}

function Stat({ icon, iconColor, value, label, tint }: { icon: IconName; iconColor: string; value: string; label: string; tint?: string }) {
  return (
    <View style={[styles.stat, tint ? { backgroundColor: tint } : null]} accessibilityLabel={`${value}, ${label}`}>
      <View style={styles.statHead}>
        <Icon name={icon} size={18} color={iconColor} />
        <Text variant="subtitle" numberOfLines={1}>{value}</Text>
      </View>
      <Text variant="caption" tone="muted" numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: radius.xl, backgroundColor: color.surface, overflow: 'hidden', marginBottom: space.lg },
  band: { height: 44, backgroundColor: color.brand },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.lg },
  avatarWrap: { borderRadius: radius.full },
  dot: { position: 'absolute', right: 4, bottom: 4, width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: color.surface },
  sellos: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
  sello: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: space.sm, paddingVertical: 3 },
  body: { padding: space.lg, gap: space.md },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, gap: 2 },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  oficios: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, alignItems: 'center' },
  oficio: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.full, borderWidth: 1, borderColor: color.brandMid, paddingHorizontal: space.sm, paddingVertical: 5, maxWidth: '100%' },
  oficioText: { color: color.brand },
  masOficios: { marginLeft: 2 },
  bio: { fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.lg },
});
