// Pago en custodia: helpers que comparten el cobro, la confirmación, las cancelaciones y las incidencias.
// Todas reciben la transacción abierta (tx) para que el cambio de la orden y el de la custodia vayan juntos.

async function custodiaRetenida(tx, idSolicitud) {
  const { rows } = await tx.query(
    "SELECT id_custodia, monto, modo, referencia FROM custodias WHERE id_solicitud = $1 AND estado = 'RETENIDO'",
    [idSolicitud]
  );
  return rows[0] || null;
}

// Cancelación o reasignación: el dinero retenido se devuelve al cliente (lo ejecuta soporte en la pasarela).
// También vuelve a ocultar la dirección. Devuelve el monto por reembolsar o null si no había custodia.
async function marcarReembolso(tx, idSolicitud) {
  const { rows } = await tx.query(
    `UPDATE custodias SET estado = 'REEMBOLSO_PENDIENTE', fecha_cierre = NOW()
     WHERE id_solicitud = $1 AND estado = 'RETENIDO' RETURNING monto`,
    [idSolicitud]
  );
  await tx.query('UPDATE solicitudes_servicio SET direccion_liberada = false WHERE id_solicitud = $1', [idSolicitud]);
  if (!rows[0]) return null;
  await tx.query("UPDATE solicitudes_servicio SET estado_pago = 'REEMBOLSO_PENDIENTE' WHERE id_solicitud = $1", [idSolicitud]);
  return rows[0].monto;
}

async function liberar(tx, idCustodia) {
  await tx.query("UPDATE custodias SET estado = 'LIBERADO', fecha_cierre = NOW() WHERE id_custodia = $1 AND estado = 'RETENIDO'", [idCustodia]);
}

module.exports = { custodiaRetenida, marcarReembolso, liberar };
