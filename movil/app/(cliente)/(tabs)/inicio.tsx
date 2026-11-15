import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Avatar, Banner, Button, color, Icon, radius, Screen, Skeleton, space, Text, NATIVE, Ilustracion, ilustracionDe, IlustracionNombre } from '@/src/design';
import { fileUrl } from '@/src/api/client';
import { solicitudesApi } from '@/src/api/endpoints';
import type { Solicitud } from '@/src/api/types';
import { useSession } from '@/src/state/session';
import { useLoader } from '@/src/lib/useLoader';
import { clientStatusText, estadoInfo } from '@/src/lib/estado';
import { formatShortDate } from '@/src/lib/format';
import { ON_NAVY_SOFT, StatusHeroBody } from '@/src/features/orders/StatusHero';
import { SuspensionBanner } from '@/src/features/account/SancionesHost';
import { activeOrders, needsClientAction, useMisSolicitudes } from '@/src/features/orders/hooks';

// Inicio del cliente: un solo bloque azul arriba con lo importante (el servicio en curso y su siguiente paso,
// o la invitación a pedir uno); abajo, sin tarjetas anidadas, los oficios más pedidos y la lista de servicios.
export default function Inicio() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { data, loading, refreshing, refresh } = useMisSolicitudes();
  const cats = useLoader(() => solicitudesApi.categorias().then((r) => r.categorias), []);

  const activas = activeOrders(data);
  const pendientes = activas.filter(needsClientAction);
  const hoy = pendientes[0] || activas[0];
  const open = (id: number) => router.push({ pathname: '/orden/[id]', params: { id: String(id) } });
  const accionHoy = hoy ? clientStatusText(hoy).accion : undefined;
  const oficios = (cats.data || []).slice(0, 3);

  return (
    <Screen inTabs padded={false} refreshing={refreshing} onRefresh={refresh} background={color.groundAlt}>
      <StatusBar style="light" />
      <View style={[styles.hero, { paddingTop: insets.top + space.lg }]}>
        <View style={styles.hello}>
          <Avatar uri={fileUrl(user?.foto_url)} nombre={user?.nombre} apellido={user?.apellido} size={48} />
          <View style={styles.flex}>
            <Text variant="bodySm" style={styles.soft}>Hola,</Text>
            <Text variant="title" tone="onColor" numberOfLines={1} accessibilityRole="header">{user?.nombre || 'bienvenido'}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Ayuda" onPress={() => router.push('/ayuda')} style={styles.roundBtn}>
            <Icon name="help-circle" size={22} color={color.inkOnColor} />
          </Pressable>
        </View>

        {loading && !data ? <Skeleton height={150} style={styles.skeleton} /> : null}

        {hoy ? (
          <>
            <StatusHeroBody s={hoy} />
            <Button
              variant="accent"
              size="xl"
              full
              title={accionHoy || 'Ver mi servicio'}
              icon={accionHoy ? undefined : 'arrow-right'}
              onPress={() => open(hoy.id_solicitud)}
            />
          </>
        ) : data ? (
          <>
            <View style={styles.invite}>
              <Text variant="headline" tone="onColor">¿Qué necesitas hoy?</Text>
              <Text variant="body" style={styles.soft}>Un técnico verificado cerca de ti. Pagas en custodia y el dinero se libera cuando confirmas.</Text>
            </View>
            <Button variant="accent" size="xl" full title="Pedir un servicio" icon="plus" onPress={() => router.push('/nueva-solicitud')} />
          </>
        ) : null}
      </View>

      <View style={styles.body}>
        <SuspensionBanner />
        {user && !user.aprobado ? (
          <Banner tone="warning" title="Tu cuenta está en revisión" body="Revisamos tus documentos. Podrás pedir servicios en cuanto quede aprobada." />
        ) : null}

        <Pressable accessibilityRole="search" accessibilityLabel="Buscar técnicos por nombre o servicio" onPress={() => router.push('/buscar-tecnicos')} style={styles.search}>
          <Icon name="search" size={20} color={color.inkMuted} />
          <Text variant="body" tone="muted" style={styles.flex} numberOfLines={1}>Buscar técnico o servicio</Text>
        </Pressable>

        <View style={styles.section}>
          <SectionTitle title="Pedir un servicio" />
          <View style={styles.oficios}>
            {oficios.map((c) => (
              <Oficio key={c.codigo} figura={ilustracionDe(c.nombre)} label={c.nombre} onPress={() => router.push({ pathname: '/nueva-solicitud', params: { categoria: c.codigo } })} />
            ))}
            <Oficio figura="todo" label="Ver todo" onPress={() => router.push('/nueva-solicitud')} />
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle title="Mis servicios" action={data?.length ? 'Ver todos' : undefined} onAction={() => router.push('/servicios')} />
          {activas.length ? (
            activas.slice(0, 3).map((s, i) => <ServicioFila key={s.id_solicitud} s={s} first={i === 0} onPress={() => open(s.id_solicitud)} />)
          ) : data ? (
            <Text variant="body" tone="muted">No tienes servicios en curso.</Text>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHead}>
      <Text variant="title" accessibilityRole="header">{title}</Text>
      {action ? (
        <Pressable accessibilityRole="link" onPress={onAction} hitSlop={12}>
          <Text variant="label" tone="soft">{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// Ícono de oficio: al tocarlo salta, gira un poco y se pinta de naranja claro.
function Oficio({ figura, label, onPress }: { figura: IlustracionNombre; label: string; onPress: () => void }) {
  const v = useRef(new Animated.Value(0)).current;
  const go = (to: number) => Animated.spring(v, { toValue: to, friction: 4, tension: 180, useNativeDriver: NATIVE }).start();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Pedir ${label}`} onPress={onPress} onPressIn={() => go(1)} onPressOut={() => go(0)} style={styles.oficio}>
      {({ pressed }) => (
        <>
          <Animated.View
            style={[
              styles.oficioIcon,
              pressed && styles.oficioPressed,
              { transform: [
                { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
                { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-10deg'] }) },
                { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
              ] },
            ]}
          >
            <Ilustracion nombre={figura} size={64} />
          </Animated.View>
          <Text variant="bodySm" weight="600" align="center" numberOfLines={2} style={styles.oficioLabel}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

// Una fila por servicio: sin tarjeta, separada por una línea. Si al cliente le toca hacer algo, la etiqueta va en naranja.
function ServicioFila({ s, first, onPress }: { s: Solicitud; first: boolean; onPress: () => void }) {
  const urgente = needsClientAction(s);
  const etiqueta = urgente ? 'Te toca' : estadoInfo(s.estado, 'cliente').label;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${s.servicio_nombre || s.categoria_nombre}, ${etiqueta}. Ver detalle`}
      onPress={onPress}
      style={({ pressed }) => [styles.fila, !first && styles.filaLinea, pressed && styles.filaPressed]}
    >
      <Ilustracion nombre={ilustracionDe(s.categoria_nombre)} size={46} />
      <View style={styles.flex}>
        <Text variant="subtitle" numberOfLines={1}>{s.servicio_nombre || s.categoria_nombre}</Text>
        <Text variant="bodySm" tone="soft" numberOfLines={1}>{s.categoria_nombre} · {formatShortDate(s.fecha_creacion)}</Text>
      </View>
      <View style={[styles.tag, urgente ? styles.tagUrgente : styles.tagNormal]}>
        <Text variant="caption" weight="700" style={{ color: color.ink }}>{etiqueta}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  soft: { color: ON_NAVY_SOFT },
  hero: {
    backgroundColor: color.navy, borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
    paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.xl,
  },
  hello: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  roundBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  skeleton: { opacity: 0.25 },
  invite: { gap: space.xs },
  body: { paddingHorizontal: space.lg, paddingTop: space.xl, gap: space.xl },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingHorizontal: space.lg,
    borderRadius: radius.full, backgroundColor: color.surface,
  },
  section: { gap: space.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  oficios: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  oficio: { flex: 1, alignItems: 'center', gap: space.sm },
  oficioIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  oficioPressed: { opacity: 0.85 },
  oficioLabel: { fontSize: 13, lineHeight: 17 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  filaLinea: { borderTopWidth: 1, borderTopColor: color.line },
  filaPressed: { opacity: 0.7 },
  filaIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' },
  tag: { borderRadius: radius.full, paddingHorizontal: space.sm + 2, paddingVertical: 5 },
  tagNormal: { backgroundColor: color.brandSoft },
  tagUrgente: { backgroundColor: color.accent },
});
