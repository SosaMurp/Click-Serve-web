import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { goBack } from '@/src/lib/nav';
import { AppBar, Button, color, Icon, IconButton, Money, radius, Screen, space, Surface, Text, TextField } from '@/src/design';
import { errorMessage } from '@/src/api/client';
import { solicitudesApi } from '@/src/api/endpoints';
import { compareMoney, formatMoney, normalizeMoney, parseMoneyInput, restaMoney, sumMoney } from '@/src/lib/format';
import { hapticSuccess } from '@/src/lib/media';
import { useSolicitud } from '@/src/features/orders/hooks';
import { toast } from '@/src/ui/toast';

type Tipo = 'MANO_OBRA' | 'MATERIAL';
type Linea = { key: number; tipo: Tipo; descripcion: string; monto: string };
let seq = 0;
const nueva = (tipo: Tipo = 'MANO_OBRA'): Linea => ({ key: (seq += 1), tipo, descripcion: '', monto: '' });

// RF-72: cotización en una sola hoja: mano de obra y materiales juntos, cada uno con su subtotal.
// El total final lo calcula el servidor.
export default function Cotizar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: s } = useSolicitud(id);
  const [lineas, setLineas] = useState<Linea[]>([nueva('MANO_OBRA')]);
  const [detalles, setDetalles] = useState('');
  const [minutos, setMinutos] = useState('');
  const [sending, setSending] = useState(false);
  const [touched, setTouched] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Si ya hay una cotización enviada, se precarga para editarla.
  useEffect(() => {
    if (loaded || !s) return;
    setLoaded(true);
    // Después de un rechazo se parte del adicional rechazado, para ajustar precios en vez de escribir todo otra vez.
    const base = s.estado === 'EN_SITIO' && s.ultimo_rechazo?.conceptos?.length ? s.ultimo_rechazo.conceptos : s.cotizacion?.conceptos;
    if (base?.length) {
      setLineas(base.filter((c) => c.tipo !== 'EXTRA').map((c) => ({ key: (seq += 1), tipo: c.tipo as Tipo, descripcion: c.descripcion, monto: normalizeMoney(c.monto) })));
      setDetalles(s.cotizacion?.detalles || '');
      setMinutos(s.cotizacion?.tiempo_estimado_minutos ? String(s.cotizacion.tiempo_estimado_minutos) : '');
    }
  }, [s, loaded]);

  const parsed = lineas.map((l) => ({ ...l, value: parseMoneyInput(l.monto) }));
  const total = sumMoney(parsed.map((l) => l.value));
  // Adicional: el cliente ya pagó el precio base en custodia; la cotización es el trabajo completo y solo paga la diferencia.
  // RNF-37: en centavos enteros, sin flotantes (el total oficial lo calcula el servidor).
  const pagado = s?.custodia?.estado === 'RETENIDO' ? normalizeMoney(s.custodia.monto) : null;
  const diferencia = restaMoney(total, pagado);
  const bajoLoPagado = !!pagado && compareMoney(total, pagado) < 0;
  const subtotal = (t: Tipo) => sumMoney(parsed.filter((l) => l.tipo === t).map((l) => l.value));
  const invalid = parsed.some((l) => !l.descripcion.trim() || !l.value);

  const update = (key: number, patch: Partial<Linea>) => setLineas((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  async function submit() {
    setTouched(true);
    if (invalid) { toast.warning('Completa la descripción y el monto de cada concepto.'); return; }
    if (bajoLoPagado) { toast.warning(`El total no puede ser menor a lo que el cliente ya pagó (${formatMoney(pagado)}).`); return; }
    setSending(true);
    try {
      await solicitudesApi.cotizar(id, parsed.map((l) => ({ tipo: l.tipo, descripcion: l.descripcion.trim(), monto: l.value as string })), detalles.trim(), minutos ? Number(minutos) : undefined);
      hapticSuccess();
      toast.success('Adicional enviado. Te avisamos cuando el cliente lo pague.');
      goBack(router);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen
      header={<AppBar title="Cotizar adicional" subtitle={s ? `${s.categoria_nombre} · ${s.folio}` : undefined} confirmDiscard={lineas.some((l) => l.descripcion || l.monto)} />}
      footer={(
        <View style={styles.footer}>
          <View style={styles.total}>
            <Text variant="caption" tone="muted">{pagado ? 'El cliente paga' : 'Total (IVA incluido)'}</Text>
            <Money value={pagado ? diferencia : total} size="lg" />
          </View>
          <Button variant="accent" title="Enviar al cliente" icon="send" onPress={submit} loading={sending} size="lg" style={styles.flex} />
        </View>
      )}
    >
      <Text variant="body" tone="soft" style={styles.intro}>Escribe el trabajo completo: deja el precio base y agrega la mano de obra y los materiales que hacen falta. El cliente solo paga la diferencia, en custodia, antes de que empieces.</Text>
      {pagado ? (
        <Surface tint="sky" style={styles.card}>
          <View style={styles.cardHead}>
            <Text variant="bodySm" tone="soft" style={styles.flex}>Ya pagado en custodia (precio base)</Text>
            <Money value={pagado} size="sm" />
          </View>
          <View style={styles.cardHead}>
            <Text variant="bodySm" tone="soft" style={styles.flex}>Total del trabajo completo</Text>
            <Money value={total} size="sm" />
          </View>
          <View style={styles.cardHead}>
            <Text variant="subtitle" style={styles.flex}>Diferencia que paga el cliente</Text>
            <Money value={diferencia} size="md" />
          </View>
          {bajoLoPagado ? <Text variant="bodySm" tone="danger">El total no puede ser menor a lo que el cliente ya pagó.</Text> : null}
        </Surface>
      ) : null}
      <Surface style={styles.card}>
        {(['MANO_OBRA', 'MATERIAL'] as Tipo[]).map((tipo) => {
          const del = lineas.map((l, i) => ({ l, p: parsed[i] })).filter((x) => x.l.tipo === tipo);
          const mano = tipo === 'MANO_OBRA';
          return (
            <View key={tipo} style={!mano ? styles.section : undefined}>
              <View style={styles.cardHead}>
                <View style={[styles.secIcon, !mano && styles.secIconMat]}><Icon name={mano ? 'tool' : 'package'} size={18} color={color.inkOnColor} /></View>
                <Text variant="title" style={styles.flex}>{mano ? 'Mano de obra' : 'Materiales'}</Text>
                <Money value={subtotal(tipo)} size="sm" />
              </View>
              {del.length === 0 ? <Text variant="bodySm" tone="muted" style={styles.empty}>{mano ? 'Sin mano de obra.' : 'Sin materiales. Agrégalos si el trabajo los necesita.'}</Text> : null}
              {del.map(({ l, p }) => (
                <View key={l.key} style={styles.linea}>
                  <View style={styles.flex}>
                    <TextField label={mano ? 'Trabajo a realizar' : 'Material'} value={l.descripcion} onChangeText={(v) => update(l.key, { descripcion: v })} placeholder={mano ? 'Cambio de contacto y revisión del circuito' : 'Contacto doble polarizado'} maxLength={200} error={touched && !l.descripcion.trim() ? 'Escribe la descripción.' : null} />
                    <TextField label="Monto (MXN)" value={l.monto} onChangeText={(v) => update(l.key, { monto: v.replace(/[^\d.,]/g, '') })} keyboardType="decimal-pad" icon="dollar-sign" placeholder="0.00" error={touched && !p.value ? 'Monto mayor a 0 con máximo 2 decimales.' : null} />
                  </View>
                  {lineas.length > 1 ? <IconButton icon="trash-2" label={`Quitar ${l.descripcion || (mano ? 'mano de obra' : 'material')}`} size={18} onPress={() => setLineas((xs) => xs.filter((x) => x.key !== l.key))} /> : null}
                </View>
              ))}
              {lineas.length < 20 ? (
                <Button title={mano ? '+ Agregar mano de obra' : '+ Agregar material'} variant="tonal" onPress={() => setLineas((xs) => [...xs, nueva(tipo)])} full style={styles.add} />
              ) : null}
            </View>
          );
        })}
      </Surface>

      <Surface style={styles.card}>
        <TextField label="Notas para el cliente (opcional)" value={detalles} onChangeText={setDetalles} multiline maxLength={500} placeholder="Qué incluye, garantía de refacciones…" />
        <TextField label="Tiempo estimado (minutos)" value={minutos} onChangeText={(v) => setMinutos(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" icon="clock" />
      </Surface>

      <Text variant="caption" tone="muted">De este total, Click & Serve retiene su comisión y las retenciones de ley; verás tu neto en la billetera.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  intro: { marginBottom: space.md },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  total: { minWidth: 120 },
  card: { marginBottom: space.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm, minHeight: 40 },
  section: { marginTop: space.lg, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: color.line },
  secIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: color.brand, alignItems: 'center', justifyContent: 'center', marginRight: space.sm },
  secIconMat: { backgroundColor: color.accent },
  empty: { marginBottom: space.sm },
  linea: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs, marginBottom: space.sm },
  add: { borderRadius: radius.full, borderWidth: 1.5, borderStyle: 'dashed', borderColor: color.brandMid },
});
