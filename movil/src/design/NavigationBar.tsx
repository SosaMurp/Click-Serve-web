import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutRectangle, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from './Icon';
import { Text } from './Text';
import { color, space } from './tokens';
import { usePressScale, useReduceMotion } from './motion';

export type TabMeta = Record<string, { icon: IconName; iconActive: IconName; label: string }>;

// Subconjunto de las props que expo-router entrega a tabBar (evita depender de una ruta interna).
export type TabBarProps = {
  state: { index: number; routes: { key: string; name: string; params?: object }[] };
  descriptors: Record<string, { options: { tabBarBadge?: string | number } }>;
  navigation: { emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean }; navigate: (name: string, params?: object) => void };
};

// Espacio que el contenido de una pestaña deja libre abajo para que la barra flotante no lo tape
// (alto de la barra + su separación del borde). Screen con `inTabs` ya lo aplica.
export const TAB_BAR_SPACE = 80;

// Barra flotante en azul marino: la pestaña activa es una píldora naranja con ícono y nombre;
// las demás, círculos con su ícono (el nombre va en la etiqueta de accesibilidad).
// `comfortable` agranda los botones para las pantallas del cliente (CILIM).
export function makeNavigationBar(meta: TabMeta, { comfortable = false }: { comfortable?: boolean } = {}) {
  const size = comfortable ? 46 : 44;
  const iconSize = 20;
  return function NavigationBar({ state, descriptors, navigation }: TabBarProps) {
    const insets = useSafeAreaInsets();
    const reduce = useReduceMotion();
    const [layouts, setLayouts] = useState<Record<number, LayoutRectangle>>({});
    const x = useRef(new Animated.Value(0)).current;
    const w = useRef(new Animated.Value(0)).current;
    const placed = useRef(false);
    const target = layouts[state.index];

    useEffect(() => {
      if (!target) return;
      if (!placed.current || reduce) {
        x.setValue(target.x); w.setValue(target.width); placed.current = true;
        return;
      }
      Animated.parallel([
        Animated.spring(x, { toValue: target.x, friction: 6, tension: 90, useNativeDriver: false }),
        Animated.spring(w, { toValue: target.width, friction: 6, tension: 90, useNativeDriver: false }),
      ]).start();
    }, [target?.x, target?.width, reduce, x, w, target]);

    return (
      <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, space.md) + space.sm }]}>
        <View style={styles.bar} accessibilityRole="tablist">
          {target ? <Animated.View pointerEvents="none" style={[styles.slider, { left: x, width: w, height: size, borderRadius: size / 2 }]} /> : null}
          {state.routes.map((route, index) => {
            const m = meta[route.name];
            if (!m) return null;
            const focused = state.index === index;
            const badge = descriptors[route.key]?.options.tabBarBadge;
            const onPress = () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            };
            return (
              <TabItem
                key={route.key}
                onLayout={(l) => setLayouts((prev) => (prev[index]?.x === l.x && prev[index]?.width === l.width ? prev : { ...prev, [index]: l }))}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={badge ? `${m.label}, ${badge} pendientes` : m.label}
                onPress={onPress}
                size={size}
                focused={focused}
              >
                <Icon name={focused ? m.iconActive : m.icon} size={iconSize} color={focused ? color.ink : color.inkOnColor} />
                {focused ? <Text variant="label" weight="700" style={styles.labelOn} numberOfLines={1}>{m.label}</Text> : null}
                {badge ? (
                  <View style={styles.badge}>
                    <Text variant="caption" style={styles.badgeText}>{String(badge)}</Text>
                  </View>
                ) : null}
              </TabItem>
            );
          })}
        </View>
      </View>
    );
  };
}

// Pestaña: se hunde al tocarla; la activa deja ver la píldora naranja de atrás.
function TabItem({ children, onLayout, size, focused, ...a11y }: {
  children: React.ReactNode;
  onLayout: (l: LayoutRectangle) => void;
  size: number;
  focused: boolean;
  accessibilityRole: 'tab';
  accessibilityState: { selected: boolean };
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const press = usePressScale(0.88);
  return (
    <Animated.View onLayout={(e) => onLayout(e.nativeEvent.layout)} style={{ transform: [{ scale: press.scale }] }}>
      <Pressable
        {...a11y}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={({ pressed }) => [
          styles.item,
          { height: size, minWidth: size, borderRadius: size / 2 },
          focused ? styles.itemOn : styles.itemOff,
          pressed && !focused && styles.itemPressed,
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row', gap: 4, padding: 4, borderRadius: 999, backgroundColor: color.navy,
    shadowColor: color.navy, shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  itemOn: { backgroundColor: 'transparent', paddingHorizontal: space.md },
  slider: { position: 'absolute', top: 4, backgroundColor: color.accent },
  itemOff: { backgroundColor: 'rgba(255,255,255,0.10)' },
  itemPressed: { backgroundColor: 'rgba(255,255,255,0.22)' },
  labelOn: { color: color.ink, fontSize: 14, lineHeight: 18 },
  badge: {
    position: 'absolute', top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: color.accent,
    borderWidth: 2, borderColor: color.navy, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { fontSize: 10, lineHeight: 12, fontWeight: '800', color: color.ink },
});
