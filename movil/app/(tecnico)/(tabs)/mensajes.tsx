import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { AppBar, Avatar, Button, EmptyState, ListItem, Pill, Screen, SectionHeader, SkeletonList, space, Surface, Text, Icon, color } from '@/src/design';
import { chatDirectoApi, soporteApi } from '@/src/api/endpoints';
import { useLoader } from '@/src/lib/useLoader';
import { formatRelative } from '@/src/lib/format';
import { estadoInfo } from '@/src/lib/estado';
import { useRealtime } from '@/src/state/realtime';
import { useTrabajos } from '@/src/features/tech/hooks';
import { ticketTone } from '@/src/features/chat/ticket';

// Bandeja del técnico: mensajes directos de clientes (aunque no haya servicio), chats de sus servicios y soporte.
export default function MensajesTecnico() {
  const router = useRouter();
  const directos = useLoader(() => chatDirectoApi.lista().then((r) => r.conversaciones), []);
  const enCurso = useTrabajos('en_curso');
  const historial = useTrabajos('historial');
  const tickets = useLoader(() => soporteApi.tickets().then((r) => r.tickets), []);

  // Un mensaje nuevo (directo o de un servicio) reordena la bandeja.
  useRealtime(['chat.directo.mensaje', 'chat.mensaje'], () => { directos.reload(); enCurso.reload(); });

  // Los servicios activos primero; de los terminados, los más recientes (los cancelados no tienen chat útil).
  const servicios = [
    ...(enCurso.data?.solicitudes || []),
    ...(historial.data?.solicitudes || []).filter((s) => s.estado === 'FINALIZADA').slice(0, 10),
  ];
  const refreshing = directos.refreshing || enCurso.refreshing;
  const refresh = () => { directos.refresh(); enCurso.refresh(); historial.reload(); tickets.reload(); };

  return (
    <Screen inTabs refreshing={refreshing} onRefresh={refresh} header={<AppBar title="Mensajes" back={false} />}>
      <SectionHeader title="Mensajes de clientes" />
      {directos.loading ? <SkeletonList rows={1} /> : null}
      {!directos.loading && !(directos.data || []).length ? (
        <Surface><Text variant="body" tone="muted">Aquí verás a los clientes que te escriban desde tu perfil, aunque todavía no te hayan pedido un servicio.</Text></Surface>
      ) : null}
      {(directos.data || []).length ? (
        <Surface padded={false}>
          {(directos.data || []).map((c) => (
            <ListItem
              key={c.id_conversacion}
              icon="message-circle"
              iconTone="brand"
              title={`${c.otro.nombre} ${c.otro.apellido}`}
              subtitle={c.ultimo_mensaje || 'Sin mensajes aún'}
              trailing={<Text variant="caption" tone="muted">{formatRelative(c.fecha)}</Text>}
              onPress={() => router.push({ pathname: '/chat-directo/[id]', params: { id: String(c.id_conversacion), nombre: `${c.otro.nombre} ${c.otro.apellido}` } })}
            />
          ))}
        </Surface>
      ) : null}

      <SectionHeader title="Chats de tus servicios" />
      {enCurso.loading ? <SkeletonList rows={2} /> : null}
      {!enCurso.loading && !servicios.length ? (
        <Surface><Text variant="body" tone="muted">Cuando aceptes un trabajo podrás escribirle al cliente desde aquí.</Text></Surface>
      ) : null}
      {servicios.length ? (
        <Surface padded={false}>
          {servicios.map((s) => {
            const info = estadoInfo(s.estado, 'tecnico');
            return (
              <Pressable
                key={s.id_solicitud}
                accessibilityRole="button"
                accessibilityLabel={`Chat con ${s.cliente_nombre || 'el cliente'}, ${s.servicio_nombre || s.categoria_nombre}`}
                onPress={() => router.push({ pathname: '/chat/[id]', params: { id: String(s.id_solicitud) } })}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Avatar nombre={s.cliente_nombre} apellido={s.cliente_apellido} size={44} />
                <View style={styles.flex}>
                  <Text variant="subtitle" numberOfLines={1}>{s.cliente_nombre} {s.cliente_apellido}</Text>
                  <Text variant="bodySm" tone="muted" numberOfLines={1}>{s.servicio_nombre || s.categoria_nombre} · {info.label}</Text>
                </View>
                <Icon name="chevron-right" size={20} color={color.inkMuted} />
              </Pressable>
            );
          })}
        </Surface>
      ) : null}

      <SectionHeader title="Soporte" action="Nuevo caso" onAction={() => router.push('/soporte/nuevo')} />
      {tickets.loading ? <SkeletonList rows={1} /> : null}
      {!tickets.loading && !(tickets.data || []).length ? (
        <EmptyState icon="life-buoy" title="Sin casos de soporte" body="¿Algún problema con un cliente o un pago? Escríbenos y te atendemos por chat." action={<Button title="Contactar a soporte" icon="message-circle" onPress={() => router.push('/soporte/nuevo')} />} />
      ) : null}
      {(tickets.data || []).length ? (
        <Surface padded={false}>
          {(tickets.data || []).map((t) => (
            <ListItem
              key={t.id_ticket}
              icon="life-buoy"
              iconTone={t.prioridad === 'ALTA' ? 'danger' : 'brand'}
              title={t.asunto}
              subtitle={`${t.folio} · ${t.ultimo_mensaje || ''}`}
              trailing={<View style={styles.trailing}><Pill label={ticketTone(t).label} tone={ticketTone(t).tone} size="sm" /><Text variant="caption" tone="muted">{formatRelative(t.fecha_actualizacion)}</Text></View>}
              onPress={() => router.push({ pathname: '/soporte/[id]', params: { id: String(t.id_ticket) } })}
            />
          ))}
        </Surface>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: { backgroundColor: color.surfaceSunk },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  pill: { alignSelf: 'flex-start', marginTop: 4 },
  trailing: { alignItems: 'flex-end', gap: 4 },
});
