import React, { useCallback, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppBar, AppBarAction, Screen } from '@/src/design';
import { ApiError, errorMessage } from '@/src/api/client';
import { solicitudesApi } from '@/src/api/endpoints';
import type { ChatMensaje } from '@/src/api/types';
import { useLoader } from '@/src/lib/useLoader';
import { goBack } from '@/src/lib/nav';
import { useRealtime } from '@/src/state/realtime';
import { useSession } from '@/src/state/session';
import { ChatThread } from '@/src/features/chat/ChatThread';
import { GarantiaBanner, PoliticasChatModal } from '@/src/features/chat/ChatSeguro';
import { avisarSancion } from '@/src/features/account/SancionesHost';
import { useSolicitud } from '@/src/features/orders/hooks';
import { isActive } from '@/src/lib/estado';
import { dialog } from '@/src/ui/dialog';
import { toast } from '@/src/ui/toast';

// RF-108/112/113: chat de la orden entre cliente y técnico, con llamada y escalación a seguridad.
// Chat seguro: antes de escribir se aceptan las reglas del rol; el servidor oculta datos de contacto y pago.
export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useSession();
  const orden = useSolicitud(id);
  const [aceptadas, setAceptadas] = useState<boolean | null>(null);
  const [aviso, setAviso] = useState(false);
  // Anti-evasión: el chat del servicio se abre cuando el cliente paga el precio base en custodia.
  const [bloqueado, setBloqueado] = useState(false);
  const chat = useLoader(() => solicitudesApi.chat(id).then((r) => {
    setBloqueado(!!r.bloqueado);
    setAceptadas(r.bloqueado ? true : r.politicas_aceptadas);
    return r.mensajes;
  }), [id]);
  const { setData } = chat;
  const s = orden.data;
  const soyCliente = user?.rol === 'cliente';
  const rol = soyCliente ? 'cliente' : 'tecnico';

  useRealtime('chat.mensaje', useCallback((m: ChatMensaje) => {
    if (String(m.id_solicitud) !== String(id)) return;
    setData((prev) => (prev && !prev.some((x) => x.id === m.id) ? [...prev, m] : prev));
  }, [id, setData]));

  const otro = s ? (soyCliente ? (s.tecnico ? `${s.tecnico.nombre} ${s.tecnico.apellido}` : 'Técnico') : `${s.cliente_nombre || 'Cliente'} ${s.cliente_apellido || ''}`.trim()) : 'Chat';
  const cerrado = !!s && !isActive(s.estado);

  async function aceptar() {
    try {
      await solicitudesApi.aceptarPoliticasChat(id);
      setAceptadas(true);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function send(text: string, file: Parameters<typeof solicitudesApi.enviarMensaje>[2]) {
    try {
      const { mensaje, filtrado } = await solicitudesApi.enviarMensaje(id, text, file);
      setData((prev) => (prev && !prev.some((x) => x.id === mensaje.id) ? [...prev, mensaje] : prev || [mensaje]));
      if (filtrado?.bloqueado) setAviso(true);
      avisarSancion(filtrado?.sancion);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.code === 'CHAT_POLICY_REQUIRED') setAceptadas(false);
      else if (e instanceof ApiError && e.code === 'CHAT_LOCKED') setBloqueado(true);
      else toast.error(errorMessage(e));
      return false;
    }
  }

  async function escalate() {
    const motivo = await dialog.prompt({
      title: 'Escalar a seguridad',
      message: 'Un asesor de seguridad revisará esta conversación de inmediato. Usa esta opción si te sientes amenazado o hay un comportamiento inapropiado.',
      placeholder: 'Qué está pasando (opcional)',
      confirmText: 'Escalar',
    });
    if (motivo === null) return;
    try {
      const r = await solicitudesApi.escalar(id, motivo.trim());
      toast.success(`${r.mensaje} Caso ${r.ticket.folio}.`);
      router.push({ pathname: '/soporte/[id]', params: { id: String(r.ticket.id_ticket) } });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  const actions: AppBarAction[] = [];
  actions.push({ icon: 'shield', label: 'Escalar a seguridad', onPress: escalate });

  return (
    <Screen scroll={false} padded={false} header={<AppBar title={otro} subtitle={s ? `${s.categoria_nombre} · ${s.folio}` : undefined} actions={actions} />}>
      {aviso ? <GarantiaBanner rol={rol} onClose={() => setAviso(false)} /> : null}
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
        disabled={cerrado || bloqueado}
        disabledText={bloqueado
          ? (soyCliente ? 'El chat se abre cuando pagues el precio base del servicio en custodia.' : 'El chat se abre cuando el cliente pague el precio base en custodia.')
          : 'El servicio terminó; la conversación queda solo para consulta.'}
        emptyText={bloqueado
          ? (soyCliente ? 'Paga el precio base para confirmar el servicio y platicar con tu técnico.' : 'Esperando que el cliente pague el precio base.')
          : `Escríbele a ${otro}. Por seguridad, mantén la comunicación dentro de la app.`}
      />
      <PoliticasChatModal visible={aceptadas === false && !cerrado} rol={rol} onAccept={aceptar} onExit={() => goBack(router)} />
    </Screen>
  );
}
