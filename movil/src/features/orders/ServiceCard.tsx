import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar, Button, color, Icon, IconName, Money, radius, space, Text, Ilustracion, ilustracionDe } from '../../design';
import type { Solicitud } from '../../api/types';
import { fileUrl } from '../../api/client';
import { clientStatusText, estadoInfo, isActive, stepIndex, STEPS } from '../../lib/estado';
import { formatShortDate } from '../../lib/format';

// Tarjeta de un servicio del cliente (Mis servicios e Inicio), pensada para adultos mayores y jóvenes:
// el oficio con su ícono, el estado en una frase, una barra de avance por pasos,
// el técnico, el precio y un solo botón grande. Si al cliente le toca hacer algo, la tarjeta se marca en naranja.
export function ServiceCard({ s, onOpen, overline }: { s: Solicitud; onOpen: () => void; overline?: string }) {
  const t = clientStatusText(s);
  const info = estadoInfo(s.estado, 'cliente');
  const activo = isActive(s.estado);
  const pagado = s.custodia?.estado === 'RETENIDO';
  const paso = Math.min(stepIndex(s.estado, s.estado_previo, pagado), STEPS.length - 1);
  const urgente = !!t.accion;
  const precio = s.monto_total || s.cotizacion?.monto_total || s.monto_cotizacion;
  const tec = s.tecnico;

  return (
    <View style={[styles.card, urgente && styles.cardUrgente, !activo && styles.cardCerrada]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${s.categoria_nombre}: ${t.titulo}. Ver detalle`} onPress={onOpen}>
        <View style={[styles.head, !activo && styles.headCerrada]}>
          <View style={[styles.catIcon, !activo && styles.catIconCerrada]}>
            <Ilustracion nombre={ilustracionDe(s.categoria_nombre)} size={52} tono="gris" />
          </View>
          <View style={styles.flex}>
            {overline ? <Text variant="overline" tone="muted">{overline}</Text> : null}
            <Text variant="title" numberOfLines={2}>{s.servicio_nombre || s.categoria_nombre}</Text>
            <Text variant="bodySm" tone="muted" numberOfLines={1}>{s.servicio_nombre ? `${s.categoria_nombre} · ` : ''}{formatShortDate(s.fecha_creacion)}</Text>
          </View>
          {!urgente ? <Icon name="chevron-right" size={22} color={color.inkMuted} /> : null}
        </View>

        <View style={styles.body}>
          <View style={styles.estado}>
            <View style={[styles.estadoIcon, urgente ? styles.estadoIconUrgente : s.estado === 'FINALIZADA' ? styles.estadoIconOk : null]}>
              <Icon name={info.icon as IconName} size={22} color={urgente ? color.accentInk : s.estado === 'FINALIZADA' ? color.successInk : color.brand} />
            </View>
            <View style={styles.flex}>
              {urgente ? <Text variant="overline" style={styles.teToca}>Te toca a ti</Text> : null}
              <Text variant="subtitle">{t.titulo}</Text>
            </View>
          </View>

          {activo && s.estado !== 'SUSPENDIDA' ? (
            <View style={styles.progreso} accessibilityLabel={`Paso ${paso + 1} de ${STEPS.length}: ${STEPS[paso].label}`}>
              <View style={styles.barra}>
                {STEPS.map((st, i) => (
                  <View key={st.key} style={[styles.seg, i < paso && styles.segHecho, i === paso && styles.segActual]} />
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.datos}>
            <View style={[styles.dato, styles.flex]}>
              {tec ? (
                <>
                  <Avatar uri={fileUrl(tec.foto_url)} nombre={tec.nombre} apellido={tec.apellido} size={40} />
                  <View style={styles.flex}>
                    <Text variant="caption" tone="muted">Tu técnico</Text>
                    <Text variant="subtitle" numberOfLines={1}>{tec.nombre} {tec.apellido}</Text>
                    {tec.calificacion ? (
                      <View style={styles.rating}>
                        <Icon name="star" size={14} color={color.accent} />
                        <Text variant="caption" tone="soft">{Number(tec.calificacion).toFixed(1)}</Text>
                      </View>
                    ) : null}
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.sinTec}><Icon name={activo ? 'search' : 'user'} size={20} color={color.brand} /></View>
                  <View style={styles.flex}>
                    <Text variant="caption" tone="muted">Tu técnico</Text>
                    <Text variant="subtitle">{activo ? 'Buscando cerca de ti' : 'Sin asignar'}</Text>
                  </View>
                </>
              )}
            </View>
            {precio ? (
              <View style={styles.precio}>
                <Text variant="caption" tone="muted">{s.estado === 'FINALIZADA' ? 'Pagaste' : pagado ? 'En custodia' : 'Precio'}</Text>
                <Money value={precio} size="md" />
              </View>
            ) : null}
          </View>

          {s.estado === 'FINALIZADA' && s.garantia_hasta ? (
            <View style={styles.garantia}>
              <Icon name="shield" size={16} color={color.successInk} />
              <Text variant="bodySm" style={styles.garantiaText}>Garantía hasta el {formatShortDate(s.garantia_hasta)}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      {urgente ? (
        <View style={styles.actions}>
          <Button title={t.accion || 'Ver detalle'} variant="accent" icon="arrow-right" onPress={onOpen} full size="xl" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: radius.xl, backgroundColor: color.surface, overflow: 'hidden', marginBottom: space.lg },
  cardUrgente: { borderColor: color.accent, borderWidth: 2 },
  cardCerrada: { opacity: 0.95 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.lg },
  headCerrada: {},
  catIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  catIconCerrada: { opacity: 0.6 },
  dim: { opacity: 0.8 },
  body: { padding: space.lg, gap: space.md },
  estado: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  estadoIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.brandSoft, alignItems: 'center', justifyContent: 'center' },
  estadoIconUrgente: { backgroundColor: color.accentSoft },
  estadoIconOk: { backgroundColor: color.successSoft },
  teToca: { color: color.accentInk },
  progreso: { gap: space.xs },
  barra: { flexDirection: 'row', gap: 4 },
  seg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: color.line },
  segHecho: { backgroundColor: color.brand },
  segActual: { backgroundColor: color.accent },
  datos: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: color.line },
  dato: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sinTec: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.brandSoft, alignItems: 'center', justifyContent: 'center' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  precio: { alignItems: 'flex-end' },
  garantia: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  garantiaText: { color: color.successInk },
  actions: { paddingHorizontal: space.lg, paddingBottom: space.lg },
});
