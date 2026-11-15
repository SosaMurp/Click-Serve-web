import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { CircleArrow } from './Button';
import { Icon, IconName } from './Icon';
import { Text } from './Text';
import { color, radius, space } from './tokens';
import { Ilustracion } from './Ilustracion';
import { figuraDeIcono } from './figuras';

export type SurfaceTint = 'plain' | 'sunk' | 'brand' | 'sky' | 'peach' | 'accent' | 'navy';

// Las tintas claras quedan en gris de panel: el diseño es plano y sin bloques pastel.
const TINTS: Record<SurfaceTint, string> = {
  plain: color.surface,
  sunk: color.surface,
  brand: color.brand,
  sky: color.surface,
  peach: color.accentSoft,
  accent: color.accentStrong,
  navy: color.navy,
};

// `card`: fuerza la tarjeta blanca aunque solo lleve texto (p. ej. sobre un mapa o agrupando interruptores).
type SurfaceProps = { children: React.ReactNode; onPress?: () => void; style?: ViewStyle; padded?: boolean; accessibilityLabel?: string; tint?: SurfaceTint; tone?: 'plain' | 'sunk'; flat?: boolean; card?: boolean };

// Si una Surface queda dentro de otra, la interior se dibuja sin fondo ni relleno: nunca caja dentro de caja.
const InsideSurface = React.createContext(false);

// Texto plano para no abusar de capas: una Surface con relleno (texto, datos, formularios) ya no dibuja tarjeta,
// su contenido va directo sobre el fondo. Solo son tarjeta blanca las listas (padded={false}), las que se tocan
// y las marcadas con `card`; las de color (avisos) conservan su color.
export function Surface({ children, onPress, style, padded = true, accessibilityLabel, tint, tone, card }: SurfaceProps) {
  const nested = React.useContext(InsideSurface);
  const kind = tint || tone || 'plain';
  const clara = kind === 'plain' || kind === 'sunk' || kind === 'sky';
  const plana = clara && padded && !onPress && !card;
  if (plana && !nested) return <View style={[styles.plain, style]}>{children}</View>;
  const bg = nested && clara ? 'transparent' : TINTS[kind];
  const base = [styles.surface, { backgroundColor: bg }, padded && !nested && styles.padded, nested && styles.nested, style];
  const inner = <InsideSurface.Provider value>{children}</InsideSurface.Provider>;
  if (!onPress) return <View style={base}>{inner}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [base, pressed && styles.pressed]}>
      {inner}
    </Pressable>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={[styles.divider, { marginLeft: inset }]} />;
}

type ListItemProps = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconTone?: 'brand' | 'success' | 'danger' | 'warning' | 'accent' | 'neutral';
  trailing?: React.ReactNode;
  trailingText?: string;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  disabled?: boolean;
};

const ICON_TONES = {
  brand: { bg: color.groundAlt, fg: color.brandInk },
  success: { bg: color.successSoft, fg: color.successInk },
  danger: { bg: color.dangerSoft, fg: color.dangerInk },
  warning: { bg: color.warningSoft, fg: color.warningInk },
  accent: { bg: color.accentSoft, fg: color.accentInk },
  neutral: { bg: color.surfaceSunk, fg: color.inkSoft },
};

// Fila de lista: ícono en círculo pastel, texto y valor o flecha a la derecha (como "Cuándo · Cualquiera").
export function ListItem({ title, subtitle, icon, iconTone = 'neutral', trailing, trailingText, onPress, chevron = !!onPress, destructive, disabled }: ListItemProps) {
  const t = ICON_TONES[destructive ? 'danger' : iconTone];
  const figura = destructive ? null : figuraDeIcono(icon);
  const content = (
    <>
      {figura ? <Ilustracion nombre={figura} size={44} /> : icon ? <View style={[styles.leading, { backgroundColor: t.bg }]}><Icon name={icon} size={18} color={t.fg} /></View> : null}
      <View style={styles.texts}>
        <Text variant="subtitle" tone={destructive ? 'danger' : 'default'} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text variant="bodySm" tone="muted" numberOfLines={3}>{subtitle}</Text> : null}
      </View>
      {trailingText ? <Text variant="label" tone="soft" style={styles.trailingText}>{trailingText}</Text> : null}
      {trailing}
      {chevron ? <Icon name="chevron-right" size={20} color={color.inkMuted} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.item}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.pressedItem, disabled && { opacity: 0.45 }]}
    >
      {content}
    </Pressable>
  );
}

// Encabezado de sección: MAYÚSCULAS pequeñas (SOLICITUD RECIBIDA) o título grande, con "ver todo" opcional.
export function SectionHeader({ title, action, onAction, large, right }: { title: string; action?: string; onAction?: () => void; large?: boolean; right?: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant={large ? 'headline' : 'title'} accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
      {right}
      {onAction ? (
        action ? (
          <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10} style={styles.sectionAction}>
            <Text variant="label" weight="700" tone="soft">{action}</Text>
          </Pressable>
        ) : <CircleArrow label={`Ver todo: ${title}`} onPress={onAction} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { borderRadius: radius.xl },
  nested: { borderRadius: 0, paddingVertical: space.xs },
  plain: { paddingVertical: space.xs },
  padded: { padding: space.lg },
  pressed: { opacity: 0.92, transform: [{ scale: 0.995 }] },
  divider: { height: 1, backgroundColor: color.line, marginVertical: space.xs },
  item: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg },
  pressedItem: { backgroundColor: color.surfaceSunk },
  leading: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, gap: 2 },
  trailingText: { marginLeft: space.sm },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.sm, gap: space.md },
  sectionTitle: { flex: 1 },
  sectionAction: { minHeight: 36, justifyContent: 'center' },
});
