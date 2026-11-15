import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { color, Entrance, radius, space, Text } from '../../design';
import type { ResumenTecnico } from '../../api/types';
import { formatMoney } from '../../lib/format';
import { useAvailability } from '../../state/availability';

// Encabezado del Panel de Trabajo (referencia): título, píldora En línea / Desconectado que enciende y apaga
// la disponibilidad (RF-21) y "Téc. Nombre · Lázaro Cárdenas". Debajo, las cifras de la semana (RF-111/122).
// Al perfil se entra solo por la pestaña "Perfil" de la barra inferior (RF-86), como en las apps más usadas.
export function PanelHeader({ nombre, apellido, resumen }: { nombre?: string | null; apellido?: string | null; resumen: ResumenTecnico | null }) {
  const insets = useSafeAreaInsets();
  const { disponible, cambiando, setDisponible } = useAvailability();
  const quien = [nombre, apellido ? `${apellido.trim()[0]}.` : ''].filter(Boolean).join(' ');
  const cifras = [
    { label: 'Esta semana', value: resumen ? formatMoney(resumen.ganancias_semana) : '—' },
    { label: 'Servicios', value: String(resumen?.servicios_semana ?? '—') },
    { label: 'Calificación', value: resumen?.calificacion || '—' },
    { label: 'Saldo', value: resumen ? formatMoney(resumen.saldo) : '—' },
  ];
  return (
    <View style={[styles.band, { paddingTop: insets.top + space.md }]}>
      <StatusBar style="light" />
      <Entrance from="down" style={styles.inner}>
        <View style={styles.top}>
          <Text variant="headline" tone="onColor" style={styles.flex} accessibilityRole="header">Mis trabajos</Text>
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Disponible para recibir trabajos"
            accessibilityState={{ checked: disponible, busy: cambiando }}
            onPress={() => !cambiando && setDisponible(!disponible)}
            hitSlop={8}
            style={[styles.pill, disponible ? styles.pillOn : styles.pillOff]}
          >
            {cambiando ? <ActivityIndicator size="small" color={disponible ? color.ink : color.inkOnColor} /> : <View style={[styles.dot, { backgroundColor: disponible ? color.ink : color.inkOnColor }]} />}
            <Text variant="label" weight="700" style={{ color: disponible ? color.ink : color.inkOnColor }}>{disponible ? 'En línea' : 'Desconectado'}</Text>
          </Pressable>
        </View>
        <Text variant="body" style={styles.soft}>Téc. {quien} · Lázaro Cárdenas</Text>
        <View style={styles.cifras}>
          {cifras.map((c) => (
            <View key={c.label} style={styles.cifra} accessibilityLabel={`${c.label}: ${c.value}`}>
              <Text variant="subtitle" weight="700" tone="onColor" numberOfLines={1} adjustsFontSizeToFit tabular>{c.value}</Text>
              <Text variant="caption" numberOfLines={1} style={styles.soft}>{c.label}</Text>
            </View>
          ))}
        </View>
      </Entrance>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  band: { backgroundColor: color.navy, alignItems: 'center', borderBottomLeftRadius: 32, borderBottomRightRadius: 32, paddingBottom: space.lg },
  inner: { width: '100%', maxWidth: 640, paddingHorizontal: space.lg, gap: space.xs },
  soft: { color: '#C9D0E0' },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.full, borderWidth: 1 },
  pillOn: { backgroundColor: color.accent, borderColor: color.accent },
  pillOff: { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.35)' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cifras: { flexDirection: 'row', gap: space.sm, marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  cifra: { flex: 1, alignItems: 'center', gap: 2 },
});
