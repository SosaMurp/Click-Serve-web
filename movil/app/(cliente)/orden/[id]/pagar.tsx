import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AppBar, Banner, Button, Checkbox, color, Icon, Money, radius, Screen, SectionHeader, Skeleton, space, Surface, Text, Celebration,
} from '@/src/design';
import { errorMessage } from '@/src/api/client';
import { pagosApi, solicitudesApi } from '@/src/api/endpoints';
import { useLoader } from '@/src/lib/useLoader';
import { hapticSuccess } from '@/src/lib/media';
import { useOperationKey } from '@/src/lib/useOperationKey';
import { QuoteCard } from '@/src/features/orders/QuoteCard';
import { compareMoney, formatMoney, normalizeMoney, restaMoney } from '@/src/lib/format';
import { useSolicitud } from '@/src/features/orders/hooks';
import { toast } from '@/src/ui/toast';

// Aprobar la cotización pagándola en custodia: Click & Serve retiene el dinero, libera la dirección al técnico
// y le paga solo cuando el cliente confirma que el trabajo quedó bien.
export default function PagarCustodia() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: s, loading } = useSolicitud(id);
  const tarjetas = useLoader(() => pagosApi.tarjetas().then((r) => r.metodos), []);
  const key = useOperationKey();
  const [metodo, setMetodo] = useState<number | null>(null);
  const [conforme, setConforme] = useState(false);
  const [sending, setSending] = useState(false);
  // Celebración al terminar (palomita, monto que cuenta y confeti) antes de ir a la siguiente pantalla.
  const [fiesta, setFiesta] = useState<{ titulo: string; detalle: string; centavos: number | null } | null>(null);

  useEffect(() => {
    const list = tarjetas.data || [];
    if (!metodo && list.length) setMetodo((list.find((t) => t.predeterminada) || list[0]).id_metodo);
  }, [tarjetas.data, metodo]);

  async function pagar() {
    // Un adicional sin diferencia (mismo total) no toca la tarjeta.
    const sinCargo = !!s?.cotizacion && s.custodia?.estado === 'RETENIDO' && compareMoney(s.cotizacion.monto_total, s.custodia.monto) <= 0;
    if (!metodo && !sinCargo) return;
    setSending(true);
    try {
      const r = await solicitudesApi.pagarCustodia(id, metodo ?? 0, key.get());
      key.reset();
      hapticSuccess();
      const aCentavos = (v: string | null | undefined) => { const [i = '0', d = ''] = String(v || '0').split('.'); return Number(i) * 100 + Number((d + '00').slice(0, 2)); };
      setFiesta({
        titulo: adicional ? 'Adicional pagado' : 'Pago en custodia listo',
        detalle: r.mensaje,
        centavos: r.custodia?.monto ? aCentavos(r.custodia.monto) : null,
      });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  if (fiesta) {
    return <Celebration visible title={fiesta.titulo} detail={fiesta.detalle} amountCents={fiesta.centavos} onDone={() => router.replace({ pathname: '/orden/[id]', params: { id } })} />;
  }
  if (!s) return <Screen header={<AppBar title="Aprobar y pagar" />}>{loading ? <Skeleton height={300} /> : null}</Screen>;
  if (s.estado !== 'ESPERANDO_APROBACION' || !s.cotizacion) {
    return (
      <Screen header={<AppBar title="Aprobar y pagar" />}>
        <Banner tone="info" title="No hay un precio por aprobar" body="Regresa al seguimiento de tu servicio." action={<Button title="Ver servicio" variant="text" onPress={() => router.replace({ pathname: '/orden/[id]', params: { id } })} />} />
      </Screen>
    );
  }

  const list = tarjetas.data || [];
  const total = s.cotizacion.monto_total;
  // Precio base (primer pago) o adicional (ya hay custodia: solo se paga la diferencia).
  // RNF-37: en centavos enteros, sin flotantes (el cobro real lo calcula el servidor).
  const yaPagado = s.custodia?.estado === 'RETENIDO' ? normalizeMoney(s.custodia.monto) : null;
  const adicional = !!yaPagado && compareMoney(yaPagado, '0') > 0;
  const porPagar = restaMoney(total, yaPagado);

  return (
    <Screen
      header={<AppBar title={adicional ? 'Pagar adicional' : 'Pagar precio base'} subtitle={s.folio} />}
      footer={(
        <View style={styles.footer}>
          <View style={styles.total}>
            <Text variant="caption" tone="muted">{adicional ? 'Diferencia' : 'A custodia'}</Text>
            <Money value={porPagar} size="lg" />
          </View>
          <Button variant="accent" title={adicional ? 'Pagar diferencia' : 'Pagar y confirmar'} icon="lock" onPress={pagar} loading={sending} disabled={!conforme || (!metodo && compareMoney(porPagar, '0') > 0)} size="lg" style={styles.flex} />
        </View>
      )}
    >
      <Surface>
        <View style={styles.row}>
          <Icon name="shield" size={22} color={color.brandInk} />
          <Text variant="title" style={styles.flex}>Tu dinero queda protegido</Text>
        </View>
        <View style={styles.list}>
          <Punto texto="Lo guardamos nosotros y se libera al técnico solo cuando confirmas que el trabajo quedó bien." />
          {adicional
            ? <Punto texto={`Ya pagaste ${formatMoney(yaPagado)} de precio base; ahora solo pagas la diferencia.`} />
            : <Punto texto="Al pagar se confirma el servicio, se abre el chat y el técnico recibe tu dirección." />}
          <Punto texto="Si se cancela antes de empezar, te lo devolvemos. La garantía cubre solo lo pagado en la app." />
        </View>
      </Surface>

      <SectionHeader title={adicional ? 'Trabajo completo' : 'Precio base'} />
      <QuoteCard cotizacion={s.cotizacion} extras={s.extras} total={total} />
      {adicional ? (
        <Surface style={styles.gap}>
          <View style={styles.row}><Text variant="body" tone="soft" style={styles.flex}>Total del trabajo</Text><Money value={total} size="sm" /></View>
          <View style={styles.row}><Text variant="body" tone="soft" style={styles.flex}>Ya pagado</Text><Money value={yaPagado} size="sm" /></View>
          <View style={styles.row}><Text variant="subtitle" style={styles.flex}>Pagas ahora</Text><Money value={porPagar} size="md" /></View>
        </Surface>
      ) : null}

      <SectionHeader title="Paga con" action="Agregar tarjeta" onAction={() => router.push('/tarjeta-nueva')} />
      {tarjetas.loading ? <Skeleton height={72} /> : null}
      {!tarjetas.loading && !list.length ? (
        <Banner tone="warning" title="No tienes tarjetas guardadas" body="Agrega una tarjeta para aprobar el precio." action={<Button title="Agregar tarjeta" icon="plus" variant="text" onPress={() => router.push('/tarjeta-nueva')} />} />
      ) : null}
      <View style={styles.cards} accessibilityRole="radiogroup">
        {list.map((t) => {
          const on = metodo === t.id_metodo;
          return (
            <Pressable key={t.id_metodo} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${t.marca} terminación ${t.ultimos_4}`} onPress={() => setMetodo(t.id_metodo)} style={[styles.card, on && styles.cardOn]}>
              <View style={styles.cardIcon}><Icon name="credit-card" size={20} color={color.brandInk} /></View>
              <View style={styles.flex}>
                <Text variant="subtitle">{t.marca} •••• {t.ultimos_4}</Text>
                <Text variant="caption" tone="muted">{t.titular} · vence {t.expiracion}</Text>
              </View>
              <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.gap}>
        <Checkbox checked={conforme} onChange={setConforme}>
          <Text variant="body">{adicional ? 'Apruebo el adicional y autorizo el cargo de la diferencia.' : 'Apruebo el precio base y autorizo el cargo.'} Entiendo que el pago queda en custodia hasta que confirme el trabajo.</Text>
        </Checkbox>
      </View>
    </Screen>
  );
}

function Punto({ texto }: { texto: string }) {
  return (
    <View style={styles.punto}>
      <Icon name="check-circle" size={18} color={color.successInk} />
      <Text variant="bodySm" tone="soft" style={styles.flex}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  list: { gap: space.sm, marginTop: space.md },
  punto: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  gap: { marginTop: space.md },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  total: { minWidth: 110 },
  cards: { gap: space.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 2, borderColor: 'transparent' },
  cardOn: { borderColor: color.accent },
  cardIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.brandSoft, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: color.lineStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: color.accentPressed },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: color.accentPressed },
});
