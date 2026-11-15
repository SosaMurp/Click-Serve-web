import React, { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AppBar, Banner, Button, Checkbox, color, Divider, Icon, IconButton, ListItem, Money, radius, Screen, SectionHeader, Sheet, Skeleton, space, Surface, Text, TextField, StepsWindow,
} from '@/src/design';
import { errorMessage } from '@/src/api/client';
import { solicitudesApi } from '@/src/api/endpoints';
import type { Solicitud } from '@/src/api/types';
import { STEPS, stepIndex, isActive } from '@/src/lib/estado';
import { formatDate, formatDateTime, formatMoney, formatShortDate, formatTime12, parseMoneyInput } from '@/src/lib/format';
import { hapticSuccess } from '@/src/lib/media';
import { useOperationKey } from '@/src/lib/useOperationKey';
import { useLocationBroadcast } from '@/src/state/availability';
import { MapView } from '@/src/features/map/MapView';
import { OrderHero } from '@/src/features/orders/OrderHero';
import { QuoteCard } from '@/src/features/orders/QuoteCard';
import { ReprogramCard } from '@/src/features/orders/ReprogramCard';
import { SosButton } from '@/src/features/orders/SosButton';
import { EvidenceFeed, Gallery } from '@/src/features/orders/Gallery';
import { cancelOrder } from '@/src/features/orders/actions';
import { useSolicitud } from '@/src/features/orders/hooks';
import { motivoTexto } from '@/src/features/orders/RechazoAdicional';
import { dialog } from '@/src/ui/dialog';
import { toast } from '@/src/ui/toast';

const TECH_CANCELABLE = ['ASIGNADA', 'EN_CAMINO', 'EN_SITIO', 'ESPERANDO_APROBACION'];
const SOS_STATES = ['EN_CAMINO', 'EN_SITIO', 'ESPERANDO_APROBACION', 'EN_PROCESO'];

// RF-59-65/72/90/104: ejecución del trabajo por el técnico, de "voy en camino" a "terminar".
export default function Trabajo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: s, loading, error, refreshing, refresh, reload, setData } = useSolicitud(id);
  const finishKey = useOperationKey();
  const [busy, setBusy] = useState<string | null>(null);
  const [extraOpen, setExtraOpen] = useState(false);
  const [extra, setExtra] = useState({ descripcion: '', monto: '' });
  const [nuevaTarea, setNuevaTarea] = useState('');
  useLocationBroadcast(s?.estado === 'EN_CAMINO');

  const run = async (key: string, fn: () => Promise<{ solicitud?: Solicitud; mensaje?: string }>, ok?: string) => {
    setBusy(key);
    try {
      const r = await fn();
      if (r.solicitud) setData(r.solicitud); else reload();
      hapticSuccess();
      if (ok || r.mensaje) toast.success(ok || r.mensaje || '');
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (!s) {
    return (
      <Screen header={<AppBar title="Trabajo" fallbackHref="/trabajos" />}>
        {loading ? <Skeleton height={240} /> : null}
        {error ? <Banner tone="error" title="No pudimos abrir el trabajo" body={error} action={<Button title="Reintentar" variant="text" onPress={refresh} />} /> : null}
      </Screen>
    );
  }

  const active = isActive(s.estado);
  const home = s.latitud != null && s.longitud != null ? { lat: Number(s.latitud), lng: Number(s.longitud) } : null;
  const cliente = `${s.cliente_nombre || 'Cliente'} ${s.cliente_apellido || ''}`.trim();
  const tareas = s.tareas || [];
  const hechas = tareas.filter((t) => t.completada).length;
  // Pago en custodia: sin pago no hay dirección exacta ni salida; con la custodia retenida se inicia el trabajo.
  const liberada = s.direccion_liberada === true;
  const pagada = s.custodia?.estado === 'RETENIDO';
  const openChat = () => router.push({ pathname: '/chat/[id]', params: { id } });
  const openQuote = () => router.push({ pathname: '/trabajo/[id]/cotizar', params: { id } });

  const navigate = () => {
    if (!home) return;
    const url = Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${home.lat},${home.lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${home.lat},${home.lng}`;
    Linking.openURL(url);
  };

  const toggleTask = async (idTarea: number, completada: boolean) => {
    setData((prev) => (prev ? { ...prev, tareas: (prev.tareas || []).map((t) => (t.id_tarea === idTarea ? { ...t, completada } : t)) } : prev));
    try {
      await solicitudesApi.marcarTarea(id, idTarea, completada);
    } catch (e) {
      toast.error(errorMessage(e));
      reload();
    }
  };

  const addTask = async () => {
    const d = nuevaTarea.trim();
    if (d.length < 3) return;
    try {
      const { tarea } = await solicitudesApi.agregarTarea(id, d);
      setData((prev) => (prev ? { ...prev, tareas: [...(prev.tareas || []), tarea] } : prev));
      setNuevaTarea('');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const addExtra = async () => {
    const monto = parseMoneyInput(extra.monto);
    if (extra.descripcion.trim().length < 3 || !monto) { toast.warning('Escribe la descripción y un monto válido.'); return; }
    const ok = await run('extra', () => solicitudesApi.agregarExtra(id, extra.descripcion.trim(), monto), 'Concepto agregado. El cliente lo verá antes de pagar.');
    if (ok) { setExtraOpen(false); setExtra({ descripcion: '', monto: '' }); }
  };

  const removeExtra = async (idConcepto: number) => {
    const ok = await dialog.confirm({ title: '¿Quitar este concepto?', confirmText: 'Quitar', destructive: true });
    if (ok) run('rm', () => solicitudesApi.quitarExtra(id, idConcepto));
  };

  const finish = async () => {
    if (!s.evidencias?.length) {
      const go = await dialog.confirm({ title: 'Falta la evidencia', message: 'Sube al menos una foto del trabajo terminado antes de finalizar.', confirmText: 'Subir fotos' });
      if (go) router.push({ pathname: '/trabajo/[id]/evidencias', params: { id } });
      return;
    }
    if (hechas < tareas.length) {
      const ok = await dialog.confirm({ title: 'Hay tareas sin marcar', message: `Marcaste ${hechas} de ${tareas.length}. ¿Terminar de todos modos?`, confirmText: 'Terminar' });
      if (!ok) return;
    }
    const done = await run('fin', () => solicitudesApi.finalizar(id, finishKey.get()));
    if (done) finishKey.reset();
  };

  const leave = async () => {
    if (await cancelOrder(id, 'tecnico')) router.replace('/trabajos');
  };

  return (
    <View style={styles.flex}>
      <Screen
        refreshing={refreshing}
        onRefresh={refresh}
        contentStyle={{ paddingBottom: SOS_STATES.includes(s.estado) ? 96 : undefined }}
        header={(
          <AppBar
            title={s.categoria_nombre}
            subtitle={s.folio}
            fallbackHref="/trabajos"
            actions={active && liberada ? [
              { icon: 'message-circle', label: 'Chat con el cliente', onPress: openChat },
            ] : []}
          />
        )}
      >
        <OrderHero s={s} rol="tecnico">
          <StepsWindow oscuro steps={STEPS} current={stepIndex(s.estado, s.estado_previo, pagada)} stopped={s.estado === 'CANCELADA' || s.estado === 'SUSPENDIDA'} />
        </OrderHero>
        {s.alerta_sos ? <Banner tone="error" title="Alerta SOS activa" body="El equipo de seguridad fue notificado." style={styles.gap} /> : null}
        {s.reprogramacion ? <View style={styles.gap}><ReprogramCard r={s.reprogramacion} onChanged={reload} /></View> : null}

        {/* ───── Acción principal por estado ───── */}
        {(s.estado === 'ASIGNADA' && !liberada) || (s.estado === 'ESPERANDO_APROBACION' && !pagada) ? (
          <Surface tint="peach" style={styles.gap}>
            <Text variant="title">Esperando el pago del precio base</Text>
            {s.precio_base ? <Money value={s.precio_base} size="lg" /> : null}
            <Text variant="bodySm" tone="soft">El cliente paga tu precio base en custodia para confirmar el servicio. En cuanto lo haga verás la dirección exacta, se abrirá el chat y podrás salir. Tu cobro queda asegurado.</Text>
            {s.pago_vence ? <Text variant="bodySm" weight="600" style={styles.mt}>Si no paga antes del {formatDateTime(s.pago_vence)}, la orden se cancela sola y quedas libre para otros trabajos.</Text> : null}
            <Text variant="caption" tone="muted" style={styles.mt}>¿Hace falta algo más? En el domicilio podrás cotizar un adicional desde la app.</Text>
          </Surface>
        ) : null}

        {s.estado === 'ASIGNADA' && liberada ? (
          <Surface tint="sky" style={styles.gap}>
            <Text variant="title">¿Listo para salir?</Text>
            <Text variant="bodySm" tone="soft">Al avisar que vas en camino, el cliente verá tu ubicación en vivo.</Text>
            <View style={styles.row}>
              <Button title="Voy en camino" icon="navigation" variant="filled" onPress={() => run('camino', () => solicitudesApi.estado(id, 'EN_CAMINO'))} loading={busy === 'camino'} disabled={!!busy} style={styles.flex} />
              <Button title="Ya llegué" variant="white" onPress={() => run('sitio', () => solicitudesApi.estado(id, 'EN_SITIO'))} loading={busy === 'sitio'} disabled={!!busy} />
            </View>
          </Surface>
        ) : null}

        {s.estado === 'EN_CAMINO' ? (
          <Surface tint="sky" style={styles.gap}>
            <View style={styles.live}><View style={styles.liveDot} /><Text variant="label" tone="brand">Compartiendo tu ubicación con el cliente</Text></View>
            <Button title="Llegué al domicilio" icon="map-pin" variant="filled" onPress={() => run('sitio', () => solicitudesApi.estado(id, 'EN_SITIO'))} loading={busy === 'sitio'} disabled={!!busy} full style={styles.mt} />
          </Surface>
        ) : null}

        {s.estado === 'EN_SITIO' && pagada && s.ultimo_rechazo ? (
          <Surface tint="peach" style={styles.gap}>
            <View style={styles.live}>
              <Icon name="x-circle" size={20} color={color.dangerInk} />
              <Text variant="title" style={styles.flex}>El cliente rechazó tu adicional</Text>
            </View>
            <Text variant="bodySm" tone="soft" style={styles.mtSm}>Cotizaste el trabajo completo en <Text variant="bodySm" weight="700">{formatMoney(s.ultimo_rechazo.monto_total)}</Text>.</Text>
            <View style={styles.motivo}>
              <Text variant="caption" tone="muted">Motivo</Text>
              <Text variant="subtitle">{motivoTexto(s.ultimo_rechazo.motivo)}</Text>
              {s.ultimo_rechazo.comentario ? <Text variant="body" tone="soft">“{s.ultimo_rechazo.comentario}”</Text> : null}
            </View>
            <Text variant="bodySm" tone="soft" style={styles.mtSm}>
              {s.ultimo_rechazo.motivo === 'PRECIO_ALTO'
                ? 'Puedes mandarle otra cotización con un precio más bajo, o hacer solo el trabajo del precio base.'
                : 'Puedes hacer solo el trabajo del precio base que ya pagó, o mandarle otra cotización.'}
            </Text>
            <Button title="Crear otra cotización" icon="file-plus" variant="filled" onPress={openQuote} full style={styles.mt} />
          </Surface>
        ) : null}

        {s.estado === 'EN_SITIO' && pagada ? (
          <Surface tint="sky" style={styles.gap}>
            <Text variant="title">Revisa la falla</Text>
            <Text variant="body" tone="soft">Si el precio base alcanza, inicia el trabajo. Si hace falta más, cotiza un adicional y el cliente paga la diferencia.</Text>
            <Button title="Iniciar trabajo" icon="tool" variant="filled" onPress={() => run('iniciar', () => solicitudesApi.estado(id, 'EN_PROCESO'))} loading={busy === 'iniciar'} disabled={!!busy} full style={styles.mt} />
            <Button title="Cotizar un adicional" icon="file-plus" variant="white" onPress={openQuote} full style={styles.mtSm} />
          </Surface>
        ) : null}

        {s.estado === 'EN_SITIO' && !pagada ? (
          <Banner tone="warning" title="Falta el pago del precio base" body="El cliente debe pagar el precio base en custodia antes de iniciar." style={styles.gap} />
        ) : null}

        {s.estado === 'ESPERANDO_APROBACION' && pagada ? (
          <Surface tint="peach" style={styles.gap}>
            <Text variant="title">Esperando que el cliente apruebe el adicional</Text>
            <Text variant="bodySm" tone="soft">El cliente paga la diferencia en custodia desde su app. Puedes cambiar el adicional mientras no lo pague; si lo rechaza, haces el trabajo del precio base.</Text>
            <Button title="Editar adicional" icon="file-text" onPress={openQuote} style={styles.mt} />
          </Surface>
        ) : null}

        {s.estado === 'POR_CONFIRMAR' ? (
          <Banner tone="info" title="Esperando confirmación del cliente" body={pagada ? 'Cuando confirme, liberamos a tu billetera el pago que está en custodia, con su desglose.' : 'Cuando confirme y pague, el dinero llegará a tu billetera con su desglose.'} style={styles.gap} />
        ) : null}

        {s.estado === 'FINALIZADA' ? (
          <Surface tint="sky" style={styles.gap}>
            <Text variant="caption" tone="muted">Ganaste en este servicio</Text>
            <Money value={s.pago?.desglose?.neto_tecnico || s.monto_total} size="lg" tone="success" />
            {s.pago?.desglose ? (
              <Text variant="caption" tone="soft">Total {s.pago.desglose.total} · comisión {s.pago.desglose.comision} · ISR {s.pago.desglose.retencion_isr} · IVA {s.pago.desglose.retencion_iva}</Text>
            ) : null}
            {!s.calificacion_al_cliente ? <Button title="Calificar al cliente" icon="star" onPress={() => router.push({ pathname: '/trabajo/[id]/calificar', params: { id } })} style={styles.mt} /> : null}
          </Surface>
        ) : null}

        {s.estado === 'SUSPENDIDA' ? (
          <Banner tone="error" title="Orden en pausa por un reporte" body={`${s.incidencia?.folio || ''} ${s.incidencia?.descripcion || ''}`.trim() || 'El cliente abrió un reporte. Soporte te contactará.'} action={<Button title="Contactar a soporte" variant="text" onPress={() => router.push({ pathname: '/soporte/nuevo', params: { solicitud: id } })} />} style={styles.gap} />
        ) : null}
        {s.estado === 'CANCELADA' ? (
          <Banner
            tone="info"
            title="Servicio cancelado"
            body={[s.motivo_cancelacion, s.cargo_cancelacion ? `El cliente pagó ${formatMoney(s.cargo_cancelacion)} por tu visita; el neto ya está en tu billetera.` : null].filter(Boolean).join(' ') || undefined}
            style={styles.gap}
          />
        ) : null}

        {/* ───── Trabajo en proceso ───── */}
        {s.estado === 'EN_PROCESO' ? (
          <>
            <SectionHeader title={`Tareas de seguridad · ${hechas}/${tareas.length}`} />
            <Surface>
              {tareas.map((t, i) => (
                <View key={t.id_tarea}>
                  {i ? <Divider /> : null}
                  <Checkbox checked={t.completada} onChange={(v) => toggleTask(t.id_tarea, v)}>
                    <Text variant="body">{t.descripcion}</Text>
                    {t.norma ? <Text variant="caption" tone="muted">{t.norma}</Text> : null}
                  </Checkbox>
                </View>
              ))}
              <View style={styles.addTask}>
                <View style={styles.flex}><TextField label="Agregar tarea" hideLabel value={nuevaTarea} onChangeText={setNuevaTarea} placeholder="Agregar otra tarea" maxLength={200} onSubmitEditing={addTask} /></View>
                <IconButton icon="plus" label="Agregar tarea" background={color.brandSoft} tint={color.brandInk} onPress={addTask} />
              </View>
            </Surface>

            <SectionHeader title="Evidencia" action="Subir fotos" onAction={() => router.push({ pathname: '/trabajo/[id]/evidencias', params: { id } })} />
            {!s.evidencias?.length ? (
              <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/trabajo/[id]/evidencias', params: { id } })} style={styles.evidenceEmpty}>
                <Icon name="camera" size={24} color={color.brandInk} />
                <Text variant="subtitle" tone="brand">Sube fotos de antes, durante y después</Text>
                <Text variant="caption" tone="muted">Son obligatorias para terminar el trabajo.</Text>
              </Pressable>
            ) : null}

            <SectionHeader title="Conceptos adicionales" action="+ Agregar" onAction={() => setExtraOpen(true)} />
            {(s.extras || []).length ? (
              <Surface padded={false}>
                {(s.extras || []).map((c) => (
                  <ListItem key={c.id_concepto} icon="plus-circle" iconTone="warning" title={c.descripcion} trailing={<View style={styles.extraRight}><Money value={c.monto} size="sm" /><IconButton icon="trash-2" label={`Quitar ${c.descripcion}`} size={18} onPress={() => removeExtra(c.id_concepto)} /></View>} />
                ))}
              </Surface>
            ) : <Text variant="bodySm" tone="muted">¿Hizo falta una refacción o material extra? Agrégalo para que el cliente lo vea antes de pagar.</Text>}

            <Button variant="accent" title="Terminar trabajo" icon="check-circle" onPress={finish} loading={busy === 'fin'} disabled={!!busy} full size="lg" style={styles.finish} />
          </>
        ) : null}

        {s.evidencias?.length ? (
          <>
            <SectionHeader title={s.estado === 'EN_PROCESO' ? 'Fotos subidas' : 'Evidencia del trabajo'} />
            <EvidenceFeed items={s.evidencias} />
          </>
        ) : null}

        {s.cotizacion && s.estado !== 'CANCELADA' ? (
          <>
            <SectionHeader title={s.estado === 'ESPERANDO_APROBACION' ? (pagada ? 'Adicional enviado' : 'Precio base') : 'Precio del servicio'} />
            <QuoteCard cotizacion={s.cotizacion} extras={s.extras} total={s.monto_total} />
          </>
        ) : null}

        {/* ───── Cliente y domicilio ───── */}
        <SectionHeader title="Cliente y domicilio" />
        <Surface>
          <Text variant="title">{cliente}</Text>
          {s.direccion ? <Text variant="body" tone="soft" style={styles.mtSm}>{s.direccion}{s.referencias ? `\n${s.referencias}` : ''}</Text> : null}
          {!liberada && active ? (
            <View style={styles.locked}>
              <Icon name="lock" size={18} color={color.inkMuted} />
              <Text variant="bodySm" tone="muted" style={styles.flex}>
                Zona: {s.zona || 'Lázaro Cárdenas'}. La dirección exacta y el chat aparecen cuando el cliente paga el precio base.
              </Text>
            </View>
          ) : null}
          <Text variant="bodySm" tone="muted" style={styles.mtSm}>
            {s.fecha_preferida ? `Cita: ${formatShortDate(s.fecha_preferida)}${s.hora_preferida ? ` · ${formatTime12(s.hora_preferida)}` : ''}` : 'Lo antes posible'}
          </Text>
          {home && active ? (
            <View style={styles.map}>
              <MapView center={home} zoom={15} height={180} markers={[{ id: 'cliente', lat: home.lat, lng: home.lng, kind: 'cliente', label: s.cliente_nombre || 'Cliente' }]} />
            </View>
          ) : null}
          {active ? (
            <View style={styles.row}>
              {home ? <Button title="Cómo llegar" icon="navigation" variant="tonal" onPress={navigate} style={styles.flex} /> : null}
            </View>
          ) : null}
        </Surface>

        <SectionHeader title="Falla reportada" />
        <Surface>
          <Text variant="body">{s.descripcion}</Text>
          {s.imagenes?.length ? <View style={styles.mt}><Gallery items={s.imagenes.map((im, i) => ({ url: im.url, label: `Foto ${i + 1}` }))} size={72} /></View> : null}
        </Surface>


        {active ? (
          <>
            <SectionHeader title="Otras acciones" />
            <Surface padded={false}>
              {['ASIGNADA', 'EN_CAMINO'].includes(s.estado) && !s.reprogramacion ? (
                <ListItem icon="calendar" iconTone="brand" title="Proponer otro horario" onPress={() => router.push({ pathname: '/reprogramar/[id]', params: { id } })} />
              ) : null}
              <ListItem icon="life-buoy" iconTone="accent" title="Hablar con soporte" onPress={() => router.push({ pathname: '/soporte/nuevo', params: { solicitud: id } })} />
              {TECH_CANCELABLE.includes(s.estado) ? <ListItem icon="x-circle" title="Dejar este servicio" destructive onPress={leave} /> : null}
            </Surface>
          </>
        ) : null}
        {s.garantia_hasta ? <Text variant="caption" tone="muted" style={styles.mt}>Garantía vigente hasta el {formatDate(s.garantia_hasta)}.</Text> : null}
      </Screen>

      {SOS_STATES.includes(s.estado) ? <SosButton idSolicitud={s.id_solicitud} bottom={24} /> : null}

      <Sheet
        visible={extraOpen}
        onClose={() => setExtraOpen(false)}
        title="Agregar concepto"
        footer={<Button title="Agregar" icon="plus" onPress={addExtra} loading={busy === 'extra'} full />}
      >
        <Text variant="bodySm" tone="muted" style={styles.sheetHint}>El cliente verá este cargo en el total antes de confirmar.</Text>
        <TextField label="Descripción" value={extra.descripcion} onChangeText={(v) => setExtra((x) => ({ ...x, descripcion: v }))} placeholder="Ej. Contacto doble polarizado" maxLength={200} />
        <TextField label="Monto (MXN)" value={extra.monto} onChangeText={(v) => setExtra((x) => ({ ...x, monto: v.replace(/[^\d.]/g, '') }))} keyboardType="decimal-pad" icon="dollar-sign" placeholder="0.00" />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { marginTop: space.lg },
  mt: { marginTop: space.md },
  mtSm: { marginTop: space.xs },
  motivo: { marginTop: space.md, paddingLeft: space.md, borderLeftWidth: 3, borderLeftColor: color.dangerInk, gap: 2 },
  locked: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginTop: space.sm },
  row: { flexDirection: 'row', gap: space.sm, marginTop: space.md, alignItems: 'center' },
  live: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.success },
  addTask: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  evidenceEmpty: { borderRadius: radius.lg, borderWidth: 2, borderStyle: 'dashed', borderColor: color.brandMid, backgroundColor: color.brandSoft, padding: space.lg, alignItems: 'center', gap: 4 },
  extraRight: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  finish: { marginTop: space.xl },
  map: { borderRadius: radius.md, overflow: 'hidden', marginTop: space.md },
  sheetHint: { marginBottom: space.md },
});
