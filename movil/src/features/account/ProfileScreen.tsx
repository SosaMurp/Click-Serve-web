import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Avatar, Button, color, Icon, IconName, ListItem, radius, Screen, SectionHeader, space, Surface, Text } from '../../design';
import { fileUrl } from '../../api/client';
import { useSession } from '../../state/session';
import { dialog } from '../../ui/dialog';

type Item = { icon: IconName; title: string; subtitle?: string; href: string; tone?: 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'neutral'; trailingText?: string };

export type Metrica = { value: string | number; label: string };

// Perfil compartido por cliente y técnico con el mismo diseño: un solo bloque azul con la foto, el nombre,
// el estado de la cuenta y las cifras (opcionales); debajo, la lista de ajustes. Cada rol cambia sus secciones.
export function ProfileScreen({ metrics, sections }: { metrics?: Metrica[]; sections: { title: string; items: Item[] }[] }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useSession();
  if (!user) return null;

  const logout = async () => {
    const ok = await dialog.confirm({ title: '¿Cerrar sesión?', message: 'Tendrás que volver a entrar con tu correo y contraseña.', confirmText: 'Cerrar sesión' });
    if (ok) await signOut({ message: 'Cerraste sesión.' });
  };

  const common: { title: string; items: Item[] }[] = [
    {
      title: 'Seguridad y privacidad',
      items: [
        { icon: 'lock', title: 'Seguridad', subtitle: 'Contraseña, verificación en dos pasos y sesiones', href: '/seguridad', tone: 'brand', trailingText: user['2FA_Activo'] ? '2 pasos' : undefined },
        { icon: 'bell', title: 'Notificaciones', href: '/notificaciones', tone: 'accent' },
        { icon: 'shield', title: 'Mis datos', subtitle: 'Descargar tu información o eliminar la cuenta', href: '/mis-datos', tone: 'neutral' },
      ],
    },
    {
      title: 'Ayuda',
      items: [
        { icon: 'help-circle', title: 'Centro de ayuda', href: '/ayuda', tone: 'brand' },
        { icon: 'life-buoy', title: 'Soporte', subtitle: 'Tus casos y chat con un asesor', href: '/soporte', tone: 'accent' },
        { icon: 'file-text', title: 'Términos y condiciones', href: '/legal/terminos', tone: 'neutral' },
        { icon: 'eye', title: 'Aviso de privacidad', href: '/legal/privacidad', tone: 'neutral' },
      ],
    },
  ];

  return (
    <Screen inTabs padded={false}>
      <StatusBar style="light" />
      <View style={[styles.hero, { paddingTop: insets.top + space.lg }]}>
        <View style={styles.who}>
          <Avatar uri={fileUrl(user.foto_url)} nombre={user.nombre} apellido={user.apellido} size={72} />
          <View style={styles.flex}>
            <Text variant="headline" tone="onColor" numberOfLines={2} accessibilityRole="header">{user.nombre} {user.apellido}</Text>
            <Text variant="body" style={styles.soft} numberOfLines={1}>{user.correo}</Text>
            <View style={styles.estado}>
              <Icon name={user.aprobado ? 'check-circle' : 'clock'} size={16} color={user.aprobado ? color.accent : color.inkOnColor} />
              <Text variant="bodySm" weight="600" tone="onColor">
                {user.rol === 'tecnico' ? 'Técnico' : 'Cliente'} · {user.aprobado ? 'Cuenta aprobada' : 'En revisión'}{user.verificado_sep ? ' · Cédula SEP' : ''}
              </Text>
            </View>
          </View>
        </View>
        {metrics?.length ? (
          <View style={styles.cifras}>
            {metrics.map((m, i) => (
              <View key={m.label} style={[styles.cifra, i > 0 && styles.cifraLinea]} accessibilityLabel={`${m.label}: ${m.value}`}>
                <Text variant="number" tone="onColor" tabular numberOfLines={1} adjustsFontSizeToFit>{String(m.value)}</Text>
                <Text variant="caption" style={styles.soft} numberOfLines={1}>{m.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Pressable accessibilityRole="button" onPress={() => router.push('/datos-personales')} style={styles.edit}>
          <Icon name="edit-2" size={18} color={color.inkOnColor} />
          <Text variant="label" weight="700" tone="onColor">Editar datos personales</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
      {[...sections, ...common].map((sec) => (
        <View key={sec.title}>
          <SectionHeader title={sec.title} />
          <Surface padded={false}>
            {sec.items.map((it) => (
              <ListItem key={it.href} icon={it.icon} iconTone={it.tone || 'neutral'} title={it.title} subtitle={it.subtitle} trailingText={it.trailingText} onPress={() => router.push(it.href as never)} />
            ))}
          </Surface>
        </View>
      ))}

      <Button title="Cerrar sesión" variant="outlined" icon="log-out" full onPress={logout} style={styles.logout} />
      <Text variant="caption" tone="muted" align="center" style={styles.version}>Click & Serve · versión {Constants.expoConfig?.version || '1.0.0'}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  soft: { color: '#C9D0E0' },
  hero: { backgroundColor: color.navy, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.lg },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  estado: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.xs },
  cifras: { flexDirection: 'row', paddingTop: space.lg, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  cifra: { flex: 1, alignItems: 'center', gap: 2 },
  cifraLinea: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.15)' },
  edit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, minHeight: 48, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.12)' },
  body: { paddingHorizontal: space.lg },
  logout: { marginTop: space.xl },
  version: { marginTop: space.md },
});
