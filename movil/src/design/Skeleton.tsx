import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NATIVE } from './motion';
import { color, radius, space } from './tokens';

// Marcadores de carga (RNF-10/28). Respetan "reducir movimiento": sin animación si está activo.
export function Skeleton({ height = 16, width = '100%', style }: { height?: number; width?: number | `${number}%`; style?: ViewStyle }) {
  const shine = useRef(new Animated.Value(0)).current;
  const [reduce, setReduce] = useState(false);
  const [w, setW] = useState(0);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduce).catch(() => {});
  }, []);

  useEffect(() => {
    if (reduce) return undefined;
    const loop = Animated.loop(Animated.timing(shine, { toValue: 1, duration: 1250, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }));
    loop.start();
    return () => loop.stop();
  }, [shine, reduce]);

  return (
    <View aria-hidden style={[styles.block, { height, width, overflow: 'hidden' }, style]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {!reduce && w ? (
        <Animated.View style={[StyleSheet.absoluteFill, { width: w * 0.6, transform: [{ translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-w * 0.6, w] }) }] }]}>
          <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
    </View>
  );
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <View accessibilityLabel="Cargando" accessibilityRole="progressbar" style={styles.list}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.card}>
          <Skeleton height={14} width="40%" />
          <Skeleton height={18} width="85%" />
          <Skeleton height={14} width="60%" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: color.groundAlt, borderRadius: radius.sm },
  list: { gap: space.md },
  card: { gap: space.sm, padding: space.lg, borderRadius: radius.lg, backgroundColor: color.surface },
});
