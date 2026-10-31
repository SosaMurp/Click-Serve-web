import React from 'react';
import { color, ListItem, Text } from '../../design';
import type { Movimiento } from '../../api/types';
import { formatMoney, formatRelative } from '../../lib/format';

// Fila de movimiento de la billetera: ingreso en verde con +, retiro con −; el signo nunca depende solo del color.
export function MovimientoItem({ m, onPress }: { m: Movimiento; onPress: () => void }) {
  const ingreso = m.tipo === 'INGRESO';
  const ajuste = m.tipo === 'AJUSTE';
  const titulo = ajuste ? (m.concepto === 'MULTA' ? 'Cargo por incidencia' : 'Devolución al cliente por incidencia') : 'Retiro a tu cuenta';
  return (
    <ListItem
      icon={ingreso ? 'arrow-down-left' : ajuste ? 'alert-circle' : 'arrow-up-right'}
      iconTone={ingreso ? 'success' : 'accent'}
      title={ingreso ? (m.categoria_nombre ? `Servicio · ${m.categoria_nombre}` : 'Pago de servicio') : titulo}
      subtitle={`${m.folio} · ${formatRelative(m.fecha)}${m.estado !== 'COMPLETADO' ? ` · ${m.estado === 'PENDIENTE' ? 'En proceso' : m.estado}` : ''}`}
      trailing={<Text variant="subtitle" tabular style={{ color: ingreso ? color.successInk : color.ink }}>{ingreso ? '+' : '−'}{formatMoney(m.monto)}</Text>}
      onPress={onPress}
      chevron={false}
    />
  );
}
