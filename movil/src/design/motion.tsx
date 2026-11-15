import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Platform, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Text } from './Text';
import { color, space } from './tokens';

// Animaciones de la app (nivel "llamativo"): entradas en cascada con rebote, botones que se hunden,
// puntos que laten, montos que cuentan y celebración al pagar. Todas respetan "reducir movimiento"
// del sistema: si está activo, todo aparece en su lugar sin moverse.

// En web el controlador nativo no existe; ahí se anima en JS.
export const NATIVE = Platform.OS !== 'web';

let reduceCache = false;
AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { reduceCache = v; }).catch(() => {});

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(reduceCache);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { reduceCache = v; if (alive) setReduce(v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => { reduceCache = v; setReduce(v); });
    return () => { alive = false; sub?.remove?.(); };
  }, []);
  return reduce;
}

const MAX_STAGGER = 6;

// Entrada de pantalla: solo un desvanecido corto, sin deslizar ni crecer (el deslizamiento resultaba excesivo).
// `index` escalona apenas 35 ms cada bloque. Los encabezados (`from="down"`) ya no se animan: quedan fijos.
export function Entrance({ index = 0, from = 'up', children, style }: { index?: number; from?: 'up' | 'down'; children: React.ReactNode; style?: ViewStyle | ViewStyle[] }) {
  const reduce = useReduceMotion();
  const fija = from === 'down';
  const v = useRef(new Animated.Value(reduceCache || fija ? 1 : 0)).current;
  useEffect(() => {
    if (reduceCache || fija) { v.setValue(1); return; }
    Animated.timing(v, {
      toValue: 1,
      delay: Math.min(index, MAX_STAGGER) * 35,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: NATIVE,
    }).start();
  }, [v, index, fija]);
  if (reduce || fija) return <View style={style}>{children}</View>;
  return <Animated.View style={[style, { opacity: v }]}>{children}</Animated.View>;
}

// Escala con resorte para cualquier cosa que se toque: se hunde al presionar y rebota al soltar.
export function usePressScale(to = 0.96) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => { if (!reduceCache) Animated.spring(scale, { toValue: to, friction: 6, tension: 220, useNativeDriver: NATIVE }).start(); };
  const onPressOut = () => { if (!reduceCache) Animated.spring(scale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: NATIVE }).start(); };
  return { scale, onPressIn, onPressOut };
}

// Anillo que late alrededor de un punto (paso actual, "en camino").
export function PulseRing({ size, ringColor = color.accent }: { size: number; ringColor?: string }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return undefined;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }));
    loop.start();
    return () => loop.stop();
  }, [v, reduce]);
  if (reduce) return null;
  const ring = size + 12;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: ring,
        height: ring,
        borderRadius: ring / 2,
        left: (size - ring) / 2,
        top: (size - ring) / 2,
        borderWidth: 2,
        borderColor: ringColor,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.8] }) }],
      }}
    />
  );
}

// "Respira": crece y vuelve, en bucle (etiquetas de minutos, insignias).
export function Breathe({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
      Animated.timing(v, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v, reduce]);
  return <Animated.View style={[style, { transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }]}>{children}</Animated.View>;
}

// Barra que se llena hasta `progress` (0..1) al aparecer.
export function useFill(progress: number, delay = 350) {
  const v = useRef(new Animated.Value(reduceCache ? progress : 0)).current;
  useEffect(() => {
    if (reduceCache) { v.setValue(progress); return; }
    Animated.timing(v, { toValue: progress, delay, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [v, progress, delay]);
  return v;
}

// Cuenta de 0 al número en ~0.9 s (montos). Trabaja en centavos enteros: nunca muestra un centavo de más.
export function useCountUp(target: number, enabled = true): number {
  const [shown, setShown] = useState(enabled && !reduceCache ? 0 : target);
  useEffect(() => {
    if (!enabled || reduceCache || !Number.isFinite(target)) { setShown(target); return undefined; }
    let raf = 0;
    const start = Date.now();
    const from = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / 900);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(p < 1 ? Math.round((from + (target - from) * e)) : target);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled]);
  return shown;
}

// ───── Confeti ─────
const CONFETI_COLORES = [color.accent, color.navy, '#FFB27A', '#0E7A42', '#C9D0E0'];

function Piece({ i, width, height }: { i: number; width: number; height: number }) {
  const v = useRef(new Animated.Value(0)).current;
  const x = useRef(Math.random() * width).current;
  const drift = useRef((Math.random() - 0.5) * 120).current;
  const dur = useRef(1500 + Math.random() * 1300).current;
  const delay = useRef(Math.random() * 500).current;
  const spin = useRef(Math.random() > 0.5 ? 1 : -1).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: dur, delay, easing: Easing.in(Easing.quad), useNativeDriver: NATIVE }).start();
  }, [v, dur, delay]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: -16,
        width: 8,
        height: 14,
        borderRadius: 2,
        backgroundColor: CONFETI_COLORES[i % CONFETI_COLORES.length],
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, height + 40] }) },
          { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, drift] }) },
          { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${spin * 540}deg`] }) },
        ],
      }}
    />
  );
}

export function Confetti({ count = 46 }: { count?: number }) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const reduce = useReduceMotion();
  if (reduce) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {box ? Array.from({ length: count }, (_, i) => <Piece key={i} i={i} width={box.w} height={box.h} />) : null}
    </View>
  );
}

// ───── Celebración (pago o servicio confirmado) ─────
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

// Pantalla breve: palomita que se dibuja, rebote, título, monto que cuenta y confeti. Se cierra sola.
export function Celebration({ visible, title, detail, amountCents, onDone, duration = 2600 }: {
  visible: boolean;
  title: string;
  detail?: string;
  amountCents?: number | null;
  onDone: () => void;
  duration?: number;
}) {
  const circle = useRef(new Animated.Value(0)).current;
  const check = useRef(new Animated.Value(0)).current;
  const bump = useRef(new Animated.Value(1)).current;
  const texts = useRef(new Animated.Value(0)).current;
  const shown = useCountUp(amountCents ?? 0, visible && !!amountCents);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!visible) return undefined;
    circle.setValue(0); check.setValue(0); bump.setValue(1); texts.setValue(0);
    if (!reduceCache) {
      Animated.sequence([
        Animated.timing(circle, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(check, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.spring(bump, { toValue: 1.15, friction: 3, tension: 200, useNativeDriver: NATIVE }),
        Animated.spring(bump, { toValue: 1, friction: 4, useNativeDriver: NATIVE }),
      ]).start();
      Animated.spring(texts, { toValue: 1, delay: 700, friction: 7, tension: 70, useNativeDriver: NATIVE }).start();
    } else {
      circle.setValue(1); check.setValue(1); texts.setValue(1);
    }
    const t = setTimeout(() => doneRef.current(), duration);
    return () => clearTimeout(t);
  }, [visible, circle, check, bump, texts, duration]);

  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => doneRef.current()}>
      <View style={styles.celebration} accessibilityViewIsModal accessibilityLiveRegion="assertive" accessibilityLabel={`${title}. ${detail || ''}`}>
        <Confetti />
        <Animated.View style={{ transform: [{ scale: bump }] }}>
          {NATIVE ? (
            <Svg width={120} height={120} viewBox="0 0 110 110">
              <AnimatedCircle cx={55} cy={55} r={50} fill="none" stroke={color.success} strokeWidth={6} strokeDasharray="320" strokeDashoffset={circle.interpolate({ inputRange: [0, 1], outputRange: [320, 0] })} />
              <AnimatedPath d="M33 57 l15 15 l30 -32" fill="none" stroke={color.success} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="80" strokeDashoffset={check.interpolate({ inputRange: [0, 1], outputRange: [80, 0] })} />
            </Svg>
          ) : (
            // Web: la palomita aparece creciendo (los trazos animados de SVG no corren bien en el navegador).
            <Animated.View style={{ opacity: circle, transform: [{ scale: circle.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }}>
              <Svg width={120} height={120} viewBox="0 0 110 110">
                <Circle cx={55} cy={55} r={50} fill="none" stroke={color.success} strokeWidth={6} />
                <Path d="M33 57 l15 15 l30 -32" fill="none" stroke={color.success} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Animated.View>
          )}
        </Animated.View>
        <Animated.View style={[styles.celebrationTexts, { opacity: texts, transform: [{ translateY: texts.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
          <Text variant="headline" align="center">{title}</Text>
          {amountCents ? (
            <Text variant="display" align="center" tabular>
              {`$${Math.floor(shown / 100).toLocaleString('en-US')}.${String(shown % 100).padStart(2, '0')}`}
            </Text>
          ) : null}
          {detail ? <Text variant="body" tone="soft" align="center">{detail}</Text> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  celebration: { flex: 1, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.lg },
  celebrationTexts: { alignItems: 'center', gap: space.sm, maxWidth: 420 },
});
