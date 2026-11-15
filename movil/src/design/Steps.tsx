import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Icon } from './Icon';
import { Text } from './Text';
import { color, space } from './tokens';
import { PulseRing, useFill } from './motion';

export type Step = { key: string; label: string; detail?: string };

// Avance de una orden: línea continua para lo hecho, punteada para lo pendiente.
// El estado no depende solo del color: cada punto lleva forma (palomita, anillo, hueco) y texto.
export function Steps({ steps, current, stopped }: { steps: Step[]; current: number; stopped?: boolean }) {
  return (
    <View accessibilityRole="list">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const last = i === steps.length - 1;
        return (
          <View key={s.key} style={styles.row} accessibilityRole="text" accessibilityLabel={`${s.label}: ${done ? 'completado' : active ? (stopped ? 'detenido' : 'en curso') : 'pendiente'}`}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  done && styles.dotDone,
                  active && (stopped ? styles.dotStopped : styles.dotActive),
                ]}
              >
                {done ? <Icon name="check" size={14} color={color.inkOnColor} /> : null}
                {active && stopped ? <Icon name="pause" size={12} color={color.inkOnColor} /> : null}
              </View>
              {!last ? (
                done ? <View style={styles.lineDone} /> : (
                  <View style={styles.dashed}>
                    {[0, 1, 2, 3].map((d) => <View key={d} style={styles.dash} />)}
                  </View>
                )
              ) : null}
            </View>
            <View style={[styles.texts, !last && styles.textsGap]}>
              <Text variant={active ? 'subtitle' : 'bodySm'} tone={active ? 'default' : done ? 'soft' : 'muted'}>{s.label}</Text>
              {s.detail ? <Text variant="caption" tone="muted">{s.detail}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// Línea de tiempo corta y horizontal: solo el paso anterior, el actual y el siguiente, con "Paso X de N".
// Al inicio muestra el actual y el siguiente; con todo terminado, los dos últimos como hechos.
// `oscuro`: para ir dentro de un bloque azul (tramos y puntos naranjas, textos blancos, contador en píldora).
export function StepsWindow({ steps, current, stopped, oscuro }: { steps: Step[]; current: number; stopped?: boolean; oscuro?: boolean }) {
  const total = steps.length;
  const terminado = current >= total;
  const actual = Math.min(current, total - 1);
  const desde = terminado ? Math.max(0, total - 2) : Math.max(0, actual - 1);
  const hasta = terminado ? total - 1 : Math.min(total - 1, actual + 1);
  const visibles = steps.slice(desde, hasta + 1).map((s, k) => ({ s, i: desde + k }));
  const estadoDe = (i: number) => (terminado || i < current ? 'hecho' : i === current ? 'actual' : 'pendiente');

  return (
    <View accessibilityRole="progressbar" accessibilityLabel={terminado ? 'Servicio completado' : `Paso ${actual + 1} de ${total}: ${steps[actual].label}${stopped ? ', detenido' : ''}`}>
      <View style={styles.hTrack}>
        {visibles.map(({ s, i }, k) => {
          const e = estadoDe(i);
          return (
            <React.Fragment key={s.key}>
              {k > 0 ? (estadoDe(i) === 'pendiente' ? <View style={[styles.hLine, styles.hLineOff, oscuro && styles.hLineOffDark]} /> : <TramoLleno orden={k} oscuro={oscuro} />) : null}
              <View style={[styles.dot, oscuro && styles.dotDark, e === 'hecho' && (oscuro ? styles.dotDoneDark : styles.dotDone), e === 'actual' && (stopped ? styles.dotStopped : oscuro ? styles.dotActiveDark : styles.dotActive)]}>
                {e === 'actual' && !stopped ? <PulseRing size={10} /> : null}
                {e === 'hecho' ? <Icon name="check" size={14} color={oscuro ? color.ink : color.inkOnColor} /> : null}
                {e === 'actual' && stopped ? <Icon name="pause" size={12} color={color.inkOnColor} /> : null}
              </View>
            </React.Fragment>
          );
        })}
      </View>
      <View style={styles.hLabels}>
        {visibles.map(({ s, i }, k) => {
          const e = estadoDe(i);
          const align = visibles.length === 1 ? 'center' : k === 0 ? 'left' : k === visibles.length - 1 ? 'right' : 'center';
          return (
            <View key={s.key} style={styles.hLabel}>
              <Text variant="caption" tone={oscuro ? undefined : 'muted'} weight={oscuro && e === 'actual' ? '700' : undefined} align={align} style={oscuro ? (e === 'actual' ? styles.ahoraDark : styles.softDark) : undefined}>{e === 'hecho' ? 'Listo' : e === 'actual' ? (stopped ? 'Detenido' : 'Ahora') : 'Sigue'}</Text>
              <Text variant={e === 'actual' ? 'subtitle' : 'bodySm'} tone={oscuro ? (e === 'actual' ? 'onColor' : undefined) : e === 'actual' ? 'default' : 'soft'} align={align} numberOfLines={3} style={oscuro && e !== 'actual' ? styles.softDark : undefined}>{s.label}</Text>
            </View>
          );
        })}
      </View>
      {oscuro ? (
        <View style={styles.countDark}>
          <Text variant="label" weight="700" tone="onColor">{terminado ? `Completado · ${total} de ${total} pasos` : `Paso ${actual + 1} de ${total}`}</Text>
        </View>
      ) : (
        <Text variant="caption" tone="muted" style={styles.hCount}>{terminado ? `Completado · ${total} de ${total} pasos` : `Paso ${actual + 1} de ${total}`}</Text>
      )}
    </View>
  );
}

function TramoLleno({ orden, oscuro }: { orden: number; oscuro?: boolean }) {
  const v = useFill(1, 300 + orden * 300);
  return (
    <View style={styles.hLineBox}>
      <Animated.View style={[styles.hLineOn, oscuro && styles.hLineOnDark, styles.hLineFill, { width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
    </View>
  );
}

const DOT = 22;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  rail: { alignItems: 'center', width: DOT },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 2, borderColor: color.lineStrong, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: color.brand, borderColor: color.brand },
  dotActive: { borderColor: color.accent, borderWidth: 6 },
  dotStopped: { backgroundColor: color.danger, borderColor: color.danger },
  lineDone: { width: 2, flex: 1, minHeight: 18, backgroundColor: color.brand },
  dashed: { flex: 1, minHeight: 18, justifyContent: 'space-evenly', paddingVertical: 2 },
  dash: { width: 2, height: 4, backgroundColor: color.lineStrong },
  texts: { flex: 1, paddingTop: 1 },
  textsGap: { paddingBottom: space.lg },
  hTrack: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xs },
  hLine: { flex: 1, height: 3, marginHorizontal: space.xs, borderRadius: 2 },
  hLineOn: { backgroundColor: color.brand },
  hLineBox: { flex: 1, height: 3, marginHorizontal: space.xs, justifyContent: 'center' },
  hLineFill: { height: 3, borderRadius: 2 },
  hLineOff: { height: 0, borderTopWidth: 2, borderStyle: 'dashed', borderColor: color.lineStrong },
  hLabels: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  hLabel: { flex: 1, gap: 2 },
  hCount: { marginTop: space.md },
  dotDark: { backgroundColor: color.navy, borderColor: '#5B6785' },
  dotDoneDark: { backgroundColor: color.accent, borderColor: color.accent },
  dotActiveDark: { backgroundColor: color.surface, borderColor: color.accent, borderWidth: 6 },
  hLineOnDark: { backgroundColor: color.accent },
  hLineOffDark: { borderColor: '#5B6785' },
  softDark: { color: '#C9D0E0' },
  ahoraDark: { color: color.accent },
  countDark: { alignSelf: 'flex-start', marginTop: space.md, paddingHorizontal: space.md, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
});
