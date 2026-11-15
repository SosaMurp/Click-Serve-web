import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppBar, Button, color, Icon, Pill, Screen, SectionHeader, space, Surface, Text, TextField } from '@/src/design';
import { ApiError, errorMessage } from '@/src/api/client';
import { cuentaApi, tecnicoApi } from '@/src/api/endpoints';
import { onlyDigits } from '@/src/lib/validators';
import { hapticSuccess } from '@/src/lib/media';
import { useRealtime } from '@/src/state/realtime';
import { useSession } from '@/src/state/session';
import { toast } from '@/src/ui/toast';

type Resultado = { ok: boolean; titulo: string | null; mensaje: string; folio: string | null };

// RF-24/25: presentación profesional y validación de la cédula ante la SEP (en segundo plano).
export default function PerfilProfesional() {
  const router = useRouter();
  const { user, setUser, refresh } = useSession();
  const [bio, setBio] = useState(user?.bio || '');
  const [cedula, setCedula] = useState('');
  const [cedulaError, setCedulaError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  // Mientras la SEP responde, el servidor deja la cédula en EN_PROCESO; el resultado llega por WebSocket.
  const enProceso = sending || user?.estado_cedula === 'EN_PROCESO';

  useRealtime('cedula.validada', (d: { verificado_sep: boolean; titulo?: string | null; folio_profesional?: string; mensaje: string }) => {
    setSending(false);
    setResultado({ ok: d.verificado_sep, titulo: d.titulo ?? null, mensaje: d.mensaje, folio: d.folio_profesional ?? null });
    if (d.verificado_sep) hapticSuccess();
    refresh();
  });

  async function saveBio() {
    setSaving(true);
    try {
      const { usuario } = await cuentaApi.updateProfile({ bio: bio.trim() });
      setUser(usuario);
      hapticSuccess();
      toast.success('Presentación guardada.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function validate() {
    if (!/^\d{7,8}$/.test(cedula)) { setCedulaError('La cédula profesional tiene 7 u 8 dígitos.'); return; }
    setSending(true);
    setResultado(null);
    try {
      await tecnicoApi.validarCedula(cedula);
      toast.show('Consultando tu cédula en la SEP…');
    } catch (e) {
      setSending(false);
      if (e instanceof ApiError && e.field === 'cedula') setCedulaError(e.message);
      else toast.error(errorMessage(e));
    }
  }

  return (
    <Screen header={<AppBar title="Perfil profesional" confirmDiscard={bio !== (user?.bio || '')} />}>
      <SectionHeader title="Presentación" />
      <Surface>
        <TextField label="Sobre mí" value={bio} onChangeText={setBio} multiline maxLength={500} counter placeholder="Años de experiencia, especialidades, cómo trabajas…" helper="Los clientes la ven al elegir técnico." />
        <Button title="Guardar presentación" icon="check" variant="filled" onPress={saveBio} loading={saving} disabled={bio === (user?.bio || '')} />
      </Surface>

      <SectionHeader title="Cédula profesional" />
      {user?.verificado_sep ? (
        <Surface tint="sky">
          <View style={styles.row}>
            <Icon name="award" size={22} color={color.brandInk} />
            <Text variant="title" style={styles.flex}>Cédula verificada ante la SEP</Text>
            <Pill label="Verificada" tone="success" size="sm" />
          </View>
          {user.folio_profesional ? (
            <Text variant="label" tabular style={styles.mt}>Identificador profesional: {user.folio_profesional}</Text>
          ) : null}
          <Text variant="bodySm" tone="soft" style={styles.mt}>Tu perfil muestra la insignia "Cédula SEP".</Text>
        </Surface>
      ) : (
        <Surface>
          <Text variant="bodySm" tone="soft">Consultamos el Registro Nacional de Profesionistas con tu nombre. Si tu nombre coincide, la cédula existe y está vigente, te asignamos un identificador profesional y tu perfil muestra la insignia "Cédula SEP".</Text>
          <View style={styles.mt}>
            <TextField label="Número de cédula" value={cedula} onChangeText={(v) => { setCedula(onlyDigits(v).slice(0, 8)); setCedulaError(null); }} keyboardType="number-pad" icon="award" error={cedulaError} maxLength={8} />
          </View>
          <Button title={enProceso ? 'Consultando la SEP…' : 'Validar con la SEP'} icon="search" onPress={validate} loading={enProceso} disabled={cedula.length < 7 || enProceso} full />
          {enProceso && !resultado ? (
            <Text variant="bodySm" tone="muted" style={styles.mt}>Te avisaremos aquí en cuanto la SEP responda. Puedes seguir usando la app.</Text>
          ) : null}
          {resultado ? (
            <View style={styles.resultado}>
              <Icon name={resultado.ok ? 'check-circle' : 'alert-triangle'} size={20} color={resultado.ok ? color.successInk : color.warningInk} />
              <View style={styles.flexCol}>
                <Text variant="subtitle" style={{ color: resultado.ok ? color.successInk : color.warningInk }}>
                  {resultado.ok ? `Verificada${resultado.titulo ? `: ${resultado.titulo}` : ''}` : 'No se pudo verificar'}
                </Text>
                <Text variant="bodySm" tone="soft">{resultado.folio ? `${resultado.mensaje} Tu identificador: ${resultado.folio}.` : resultado.mensaje}</Text>
              </View>
            </View>
          ) : null}
        </Surface>
      )}

      <SectionHeader title="Más credenciales" />
      <Button title="Subir certificaciones y documentos" icon="upload" variant="tonal" onPress={() => router.push('/verificacion')} full />
    </Screen>
  );
}

const styles = StyleSheet.create({
  resultado: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginTop: space.md },
  flexCol: { flex: 1, gap: 2 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  mt: { marginTop: space.md },
});
