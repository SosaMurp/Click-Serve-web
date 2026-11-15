import React, { useCallback, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppBar, Banner, Button, Screen, space, Text } from '@/src/design';
import { ApiError, errorMessage } from '@/src/api/client';
import { chatDirectoApi, type MensajeDirecto } from '@/src/api/endpoints';
import type { LocalFile } from '@/src/api/types';
import { useLoader } from '@/src/lib/useLoader';
import { goBack } from '@/src/lib/nav';
import { useRealtime } from '@/src/state/realtime';
import { useSession } from '@/src/state/session';
import { ChatThread } from '@/src/features/chat/ChatThread';
import { GarantiaBanner, PoliticasChatModal } from '@/src/features/chat/ChatSeguro';
import { avisarSancion } from '@/src/features/account/SancionesHost';
import { toast } from '@/src/ui/toast';

// Mensajes directos con un técnico (o cliente), sin solicitud de por medio.
// El nombre de la otra persona llega por parámetro desde la búsqueda o la lista de mensajes.
// Chat seguro: antes de escribir se aceptan las reglas del rol; el servidor oculta datos de contacto y pago.
export default function ChatDirecto() {
  const { id, nombre } = useLocalSearchParams<{ id: string; nombre?: string }>();
  const router = useRouter();
  const { user } = useSession();
  const [aceptadas, setAceptadas] = useState<boolean | null>(null);
  const [aviso, setAviso] = useState(false);
  // Anti-evasión: pocos mensajes antes de contratar; después se sigue por el chat del servicio.
  const [restantes, setRestantes] = useState<number | null>(null);
  const [limite, setLimite] = useState(3);
  const [idTecnico, setIdTecnico] = useState<number | null>(null);
  const chat = useLoader(() => chatDirectoApi.mensajes(id).then((r) => {
    setAceptadas(r.politicas_aceptadas);
    if (r.restantes != null) setRestantes(r.restantes);
    if (r.limite) setLimite(r.limite);
    if (r.id_tecnico) setIdTecnico(r.id_tecnico);
    return r.mensajes;
  }), [id]);
  const { setData } = chat;
  const rol = user?.rol === 'tecnico' ? 'tecnico' : 'cliente';

  useRealtime('chat.directo.mensaje', useCallback((m: MensajeDirecto) => {
    if (String(m.id_conversacion) !== String(id)) return;
    setData((prev) => (prev && !prev.some((x) => x.id === m.id) ? [...prev, m] : prev));
  }, [id, setData]));

  async function aceptar() {
    try {
      await chatDirectoApi.aceptarPoliticas(id);
      setAceptadas(true);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function send(text: string, file: LocalFile | null) {
    try {
      const { mensaje, filtrado, restantes: quedan } = await chatDirectoApi.enviar(id, text, file);
      setData((prev) => (prev && !prev.some((x) => x.id === mensaje.id) ? [...prev, mensaje] : prev || [mensaje]));
      if (quedan != null) setRestantes(quedan);
      if (filtrado?.bloqueado) setAviso(true);
      avisarSancion(filtrado?.sancion);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.code === 'CHAT_POLICY_REQUIRED') setAceptadas(false);
      else if (e instanceof ApiError && e.code === 'CHAT_DIRECTO_LIMITE') setRestantes(0);
      else toast.error(errorMessage(e));
      return false;
    }
  }

  return (
    <Screen scroll={false} padded={false} header={<AppBar title={nombre || 'Mensajes'} subtitle="Mensaje directo" />}>
      {aviso ? <GarantiaBanner rol={rol} onClose={() => setAviso(false)} /> : null}
      {restantes === 0 ? (
        <View style={styles.aviso}>
          <Banner
            tone="info"
            title="Para seguir, pide el servicio"
            body={rol === 'cliente'
              ? `El chat directo es solo para dudas antes de contratar. Pide el servicio a ${nombre || 'este técnico'}: el chat del servicio se abre al pagar el precio base, y tu pago queda protegido.`
              : 'El chat directo es solo para dudas antes de contratar. Para seguir, el cliente debe pedirte el servicio desde la app.'}
            action={rol === 'cliente' && idTecnico ? (
              <Button
                title={`Pedir servicio a ${nombre?.split(' ')[0] || 'este técnico'}`}
                icon="plus"
                variant="accent"
                onPress={() => router.push({ pathname: '/nueva-solicitud', params: { tecnico: String(idTecnico), tecnico_nombre: nombre || '' } })}
              />
            ) : undefined}
          />
        </View>
      ) : restantes != null ? (
        <Text variant="caption" tone="muted" align="center" style={styles.cupo}>
          Chat solo para dudas antes de contratar · te quedan {restantes} de {limite} mensajes
        </Text>
      ) : null}
      <ChatThread
        items={(chat.data || []).map((m) => ({
          id: m.id,
          mine: m.id_emisor === user?.id_usuario,
          author: m.emisor_nombre,
          text: m.mensaje,
          attachmentUrl: m.adjunto_url,
          attachmentType: m.adjunto_tipo,
          attachmentName: m.adjunto_nombre,
          time: m.fecha_envio,
        }))}
        onSend={send}
        disabled={restantes === 0}
        disabledText="Ya usaste tus mensajes directos. Sigue la conversación desde el servicio."
        emptyText={`Escríbele a ${nombre || 'esta persona'}. Mantén la conversación dentro de la app.`}
      />
      <PoliticasChatModal visible={aceptadas === false} rol={rol} onAccept={aceptar} onExit={() => goBack(router)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  aviso: { paddingHorizontal: space.lg, paddingTop: space.md },
  cupo: { paddingHorizontal: space.lg, paddingTop: space.sm },
});
