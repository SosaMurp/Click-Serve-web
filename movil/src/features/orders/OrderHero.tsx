import React from 'react';
import { StyleSheet, View } from 'react-native';
import { color, Icon, IconName, radius, space, Text } from '../../design';
import type { Solicitud } from '../../api/types';
import { estadoInfo } from '../../lib/estado';
import { ON_NAVY_SOFT } from './StatusHero';

// Bloque azul con el estado de la orden en una frase y qué sigue; debajo puede llevar la línea de avance
// (children). El oficio y el folio ya están en el encabezado; el cliente y el precio, en sus secciones.
export function OrderHero({ s, rol = 'cliente', children }: { s: Solicitud; rol?: 'cliente' | 'tecnico'; children?: React.ReactNode }) {
  const info = estadoInfo(s.estado, rol);
  return (
    <View style={styles.hero} accessibilityRole="summary">
      <View style={styles.top}>
        <View style={styles.icon}><Icon name={info.icon as IconName} size={24} color={color.ink} /></View>
        <View style={styles.flex}>
          <Text variant="headline" tone="onColor">{info.label}</Text>
          <Text variant="body" style={{ color: ON_NAVY_SOFT }}>{info.hint}</Text>
        </View>
      </View>
      {children ? <View style={styles.extra}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  hero: { backgroundColor: color.navy, borderRadius: radius.xl, padding: space.lg, gap: space.lg },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  extra: { paddingTop: space.lg, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
});
