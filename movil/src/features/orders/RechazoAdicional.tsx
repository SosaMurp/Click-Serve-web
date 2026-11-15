import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, color, Icon, IconName, radius, Sheet, space, Text, TextField } from '../../design';

export type MotivoRechazo = 'PRECIO_ALTO' | 'NO_LO_DESEA' | 'OTRO';

export const MOTIVOS_RECHAZO: { value: MotivoRechazo; label: string; detalle: string; icon: IconName }[] = [
  { value: 'PRECIO_ALTO', label: 'El precio es muy alto', detalle: 'El técnico puede mandarte otra cotización más baja.', icon: 'dollar-sign' },
  { value: 'NO_LO_DESEA', label: 'No quiero ese trabajo extra', detalle: 'El técnico hace solo lo del precio base que ya pagaste.', icon: 'x-circle' },
  { value: 'OTRO', label: 'Otro motivo', detalle: 'Cuéntale al técnico qué pasa.', icon: 'message-circle' },
];

export const motivoTexto = (m?: string | null) => MOTIVOS_RECHAZO.find((x) => x.value === m)?.label || 'Sin motivo';

// Rechazar el adicional pide el motivo (opciones grandes y claras) y, si se quiere, un comentario para el técnico.
// Con "Otro motivo" el comentario es obligatorio.
export function RechazoAdicionalSheet({ visible, busy, onClose, onConfirm }: {
  visible: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (motivo: MotivoRechazo, comentario: string) => void;
}) {
  const [motivo, setMotivo] = useState<MotivoRechazo | null>(null);
  const [comentario, setComentario] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) { setMotivo(null); setComentario(''); setError(null); }
  }, [visible]);

  const enviar = () => {
    if (!motivo) { setError('Elige por qué lo rechazas.'); return; }
    if (motivo === 'OTRO' && comentario.trim().length < 3) { setError('Escribe brevemente el motivo.'); return; }
    onConfirm(motivo, comentario.trim());
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="¿Por qué rechazas el adicional?"
      footer={<Button title="Rechazar adicional" variant="danger" onPress={enviar} loading={busy} full size="xl" />}
    >
      <Text variant="body" tone="soft" style={styles.intro}>Le diremos al técnico tu motivo. Lo que ya pagaste de precio base sigue protegido.</Text>
      <View style={styles.opciones} accessibilityRole="radiogroup">
        {MOTIVOS_RECHAZO.map((m) => {
          const on = motivo === m.value;
          return (
            <Pressable
              key={m.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={m.label}
              onPress={() => { setMotivo(m.value); setError(null); }}
              style={[styles.opcion, on && styles.opcionOn]}
            >
              <View style={[styles.icono, on && styles.iconoOn]}><Icon name={m.icon} size={20} color={on ? color.inkOnColor : color.brand} /></View>
              <View style={styles.flex}>
                <Text variant="subtitle">{m.label}</Text>
                <Text variant="bodySm" tone="soft">{m.detalle}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <TextField
        label={motivo === 'OTRO' ? 'Cuéntale al técnico qué pasa' : 'Comentario para el técnico (opcional)'}
        value={comentario}
        onChangeText={(v) => { setComentario(v); setError(null); }}
        placeholder={motivo === 'PRECIO_ALTO' ? 'Ej. me alcanza hasta $300 más' : 'Ej. prefiero dejarlo para otro día'}
        multiline
        maxLength={300}
      />
      {error ? <Text variant="body" tone="danger">{error}</Text> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  intro: { marginBottom: space.md },
  opciones: { gap: space.sm, marginBottom: space.md },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: color.line, backgroundColor: color.surface },
  opcionOn: { borderColor: color.accent, backgroundColor: color.accentSoft },
  icono: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.brandSoft, alignItems: 'center', justifyContent: 'center' },
  iconoOn: { backgroundColor: color.accent },
});
