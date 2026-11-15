import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Animated } from 'react-native';
import { Breathe, color, PulseRing, radius, space, Text, useFill, Ilustracion, ilustracionDe } from '../../design';
import type { Solicitud } from '../../api/types';
import { clientStatusText, isActive, stepIndex } from '../../lib/estado';

// Texto secundario sobre el azul marino (contraste > 9:1).
export const ON_NAVY_SOFT = '#C9D0E0';

// Los cuatro momentos que el cliente reconoce, sobre los pasos de lib/estado (2 = pagar, 3 = en camino,
// 4-5 = en el domicilio, 6 = confirmar, 8 = finalizada).
const PUNTOS = [
  { label: 'Pagado', desde: 2, hasta: 3 },
  { label: 'En camino', desde: 3, hasta: 4 },
  { label: 'En tu casa', desde: 4, hasta: 6 },
  { label: 'Terminado', desde: 6, hasta: 8 },
];

// Contenido del bloque azul del servicio en curso: oficio, estado en una frase, minutos para llegar
// y una línea de cuatro puntos. Lo usan el inicio (dentro de su encabezado) y el seguimiento.
// El estado no depende solo del color: cada punto cambia de forma y el texto actual va en negritas.
// `sinAvance`: la pantalla ya muestra la línea de tiempo completa (no se repite el avance).
export function StatusHeroBody({ s, sinAvance }: { s: Solicitud; sinAvance?: boolean }) {
  const status = clientStatusText(s);
  const pagado = s.custodia?.estado === 'RETENIDO';
  const paso = stepIndex(s.estado, s.estado_previo, pagado);
  const eta = s.estado === 'EN_CAMINO' ? s.tecnico_ubicacion?.eta_min : null;
  const conAvance = !sinAvance && isActive(s.estado) && s.estado !== 'SUSPENDIDA' && s.estado !== 'PENDIENTE';

  return (
    <View style={styles.gap}>
      <View style={styles.oficio}>
        <View style={styles.catIcon}>
          <Ilustracion nombre={ilustracionDe(s.categoria_nombre)} size={46} fondo={false} />
        </View>
        <View style={styles.flex}>
          <Text variant="subtitle" weight="700" tone="onColor" numberOfLines={1}>
            {s.categoria_nombre}{s.servicio_nombre ? ` · ${s.servicio_nombre}` : ''}
          </Text>
          <Text variant="bodySm" style={styles.soft} tabular>Folio {s.folio}</Text>
        </View>
      </View>

      <View style={styles.titleRow}>
        <View style={styles.flex}>
          <Text variant="headline" tone="onColor" accessibilityRole="header">{status.titulo}</Text>
          <Text variant="body" style={styles.soft}>{status.detalle}</Text>
        </View>
        {eta ? (
          <Breathe style={styles.eta}>
            <View accessibilityLabel={`Llega en unos ${eta} minutos`}>
              <Text variant="label" weight="800" style={styles.etaText}>{eta} min</Text>
            </View>
          </Breathe>
        ) : null}
      </View>

      {conAvance ? (
        <View accessibilityRole="progressbar" accessibilityLabel={`Avance: ${PUNTOS.find((p) => paso >= p.desde && paso < p.hasta)?.label || status.titulo}`}>
          <View style={styles.track}>
            {PUNTOS.map((p, i) => {
              const hecho = paso >= p.hasta;
              const actual = paso >= p.desde && paso < p.hasta;
              return (
                <React.Fragment key={p.label}>
                  {i > 0 ? (paso >= p.desde ? <LineaQueSeLlena orden={i} /> : <View style={[styles.line, styles.lineOff]} />) : null}
                  <View style={[styles.dot, hecho && styles.dotOn, actual && styles.dotNow, !hecho && !actual && styles.dotOff]}>
                    {actual ? <PulseRing size={10} /> : null}
                  </View>
                </React.Fragment>
              );
            })}
          </View>
          <View style={styles.labels}>
            {PUNTOS.map((p, i) => {
              const actual = paso >= p.desde && paso < p.hasta;
              return (
                <Text
                  key={p.label}
                  variant="caption"
                  weight={actual ? '700' : '500'}
                  style={[styles.label, actual ? styles.labelNow : styles.soft, { textAlign: i === 0 ? 'left' : i === PUNTOS.length - 1 ? 'right' : 'center' }]}
                >
                  {p.label}
                </Text>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

// Bloque azul independiente (pantalla de seguimiento).
export function StatusHero({ s, sinAvance, children }: { s: Solicitud; sinAvance?: boolean; children?: React.ReactNode }) {
  return (
    <View style={styles.hero}>
      <StatusHeroBody s={s} sinAvance={sinAvance} />
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

// Tramo hecho de la línea: se llena de izquierda a derecha, uno tras otro.
function LineaQueSeLlena({ orden }: { orden: number }) {
  const v = useFill(1, 250 + orden * 280);
  return (
    <View style={styles.line}>
      <Animated.View style={[styles.lineOn, { height: 3, width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
    </View>
  );
}

const DOT = 14;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: space.lg },
  hero: { backgroundColor: color.navy, borderRadius: radius.xl, padding: space.lg, gap: space.lg },
  actions: { gap: space.sm },
  soft: { color: ON_NAVY_SOFT },
  oficio: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  catIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  eta: { backgroundColor: color.accent, borderRadius: radius.full, paddingHorizontal: space.md, paddingVertical: 6 },
  etaText: { color: color.ink },
  track: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm },
  line: { flex: 1, height: 3, justifyContent: 'center' },
  lineOn: { backgroundColor: color.accent },
  lineOff: { height: 0, borderTopWidth: 2, borderStyle: 'dashed', borderColor: '#5B6785' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  dotOn: { backgroundColor: color.accent },
  dotNow: { width: 18, height: 18, borderRadius: 9, backgroundColor: color.accent, borderWidth: 4, borderColor: 'rgba(255,107,0,0.35)' },
  dotOff: { borderWidth: 2, borderColor: '#5B6785' },
  labels: { flexDirection: 'row', marginTop: space.sm },
  label: { flex: 1 },
  labelNow: { color: color.inkOnColor },
});
