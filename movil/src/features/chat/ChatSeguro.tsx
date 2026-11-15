import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { Banner, Button, color, elevation, Icon, radius, space, Text } from '../../design';

// Chat seguro: reglas que cada participante acepta antes de escribir y aviso cuando se ocultan datos.
// Si cambia este texto, sube VERSION en backend/src/services/chatPoliticas.js para que se vuelva a aceptar.

type Rol = 'cliente' | 'tecnico';

const POLITICAS: Record<Rol, { icon: 'alert-triangle' | 'shield'; title: string; puntos: string[] }> = {
  cliente: {
    icon: 'alert-triangle',
    title: 'Aviso de seguridad y garantía',
    puntos: [
      'No compartas números de teléfono ni pactes pagos por fuera.',
      'Si pagas fuera de Click & Serve, pierdes la garantía ante trabajos inconclusos.',
      'La dirección exacta se libera al técnico cuando pagas la cotización en custodia; el dinero se le entrega solo cuando confirmas el trabajo.',
    ],
  },
  tecnico: {
    icon: 'shield',
    title: 'Políticas de trabajo y reputación',
    puntos: [
      'No solicites ni aceptes pagos por fuera.',
      'Evadir la app resulta en la suspensión permanente de tu cuenta y tu historial.',
      'Cobros asegurados mediante pago retenido: el cliente paga en custodia antes de que salgas y se te libera al confirmar.',
    ],
  },
};

// Modal obligatorio: no se cierra tocando fuera; las únicas salidas son aceptar o dejar el chat.
export function PoliticasChatModal({ visible, rol, onAccept, onExit }: {
  visible: boolean;
  rol: Rol;
  onAccept: () => Promise<void>;
  onExit: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const p = POLITICAS[rol];

  async function accept() {
    setBusy(true);
    try {
      await onAccept();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onExit} statusBarTranslucent>
      <View style={styles.scrim}>
        <View style={styles.panel} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.icon}><Icon name={p.icon} size={28} color={color.inkOnColor} /></View>
            <Text variant="headline" align="center" accessibilityRole="header">{p.title}</Text>
            <View style={styles.list}>
              {p.puntos.map((punto) => (
                <View key={punto} style={styles.item}>
                  <Icon name="check-circle" size={18} color={color.brandInk} />
                  <Text variant="body" style={styles.flex}>{punto}</Text>
                </View>
              ))}
            </View>
            <Text variant="caption" tone="muted" align="center">
              Por tu seguridad, ocultamos teléfonos, redes sociales, enlaces, correos y datos bancarios en este chat.
            </Text>
          </ScrollView>
          <View style={styles.actions}>
            <Button title="Entendido y Aceptar" variant="accent" icon="check" onPress={accept} loading={busy} full size="lg" />
            <Button title="Salir del chat" variant="text" onPress={onExit} disabled={busy} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Aviso que ve quien envió un mensaje con datos ocultos.
export function GarantiaBanner({ rol, onClose }: { rol: Rol; onClose: () => void }) {
  return (
    <Banner
      tone="warning"
      title={rol === 'cliente' ? 'Protegimos tu garantía' : 'Mensaje protegido'}
      // Mensaje oficial del nivel 1 de la escala de sanciones; reincidir suspende la cuenta.
      body={`Por tu seguridad y la garantía del servicio, no compartas datos de contacto ni acuerdes pagos por fuera. Si vuelves a intentarlo, tu cuenta ${rol === 'cliente' ? '' : 'de técnico '}se suspenderá.`}
      action={<Button title="Entendido" variant="text" onPress={onClose} />}
      style={styles.banner}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrim: { flex: 1, backgroundColor: color.scrim, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  panel: { width: '100%', maxWidth: 440, maxHeight: '90%', backgroundColor: color.surface, borderRadius: radius.xl, ...elevation[2] },
  content: { padding: space.xl, gap: space.md, alignItems: 'stretch' },
  icon: { alignSelf: 'center', width: 56, height: 56, borderRadius: 28, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  list: { gap: space.md, marginVertical: space.sm },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  actions: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.xs },
  banner: { marginHorizontal: space.lg, marginTop: space.md },
});
