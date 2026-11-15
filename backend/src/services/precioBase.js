// Precio base por servicio (anti-evasión): Click & Serve fija un rango por categoría y cada técnico su precio
// dentro del rango. Al aceptar una solicitud, ese precio se congela en la orden como una cotización base que el
// cliente paga en custodia antes de abrir el chat y la dirección. Así la comisión queda asegurada aunque lo
// adicional se intente arreglar por fuera.
const { getPool } = require('../db/pool');
const catalogo = require('./catalogo');

// Solicitudes sin categoría ("Otro"): visita de diagnóstico con precio fijo.
const DIAGNOSTICO = { precio: '250.00', nombre: 'Visita de diagnóstico' };

const db = () => getPool();

async function rangoDe(categoria, q = db()) {
  if (!categoria) return null;
  const { rows } = await q.query(
    'SELECT codigo, nombre, precio_min, precio_max, tarifa_base AS precio_sugerido FROM categorias_servicio WHERE codigo = $1',
    [categoria]
  );
  return rows[0] || null;
}

// Precio que cobra un técnico: por el servicio del catálogo que eligió el cliente; si la solicitud no trae
// servicio (versión anterior), por la categoría: el suyo, si no el sugerido, si no el de diagnóstico.
async function precioDe(idTecnico, categoria, q = db(), idServicio = null) {
  if (idServicio) {
    const srv = await catalogo.precioDeServicio(idTecnico, idServicio, q);
    if (srv) return { precio: srv.precio, concepto: `Precio base · ${srv.nombre}` };
  }
  if (!categoria) return { precio: DIAGNOSTICO.precio, concepto: DIAGNOSTICO.nombre };
  const { rows } = await q.query(
    `SELECT c.nombre, COALESCE(e.precio_base, NULLIF(c.tarifa_base, 0), c.precio_min, $3::numeric)::numeric(10,2)::text AS precio
     FROM categorias_servicio c
     LEFT JOIN especialidades_tecnico e ON e.categoria = c.codigo AND e.id_usuario = $1
     WHERE c.codigo = $2`,
    [idTecnico, categoria, DIAGNOSTICO.precio]
  );
  if (!rows[0]) return { precio: DIAGNOSTICO.precio, concepto: DIAGNOSTICO.nombre };
  return { precio: rows[0].precio, concepto: `Precio base · ${rows[0].nombre}` };
}

// Precios del técnico (para mostrar "Tu precio" en las solicitudes nuevas): por servicio si la solicitud trae
// uno, si no por categoría. Devuelve una función (categoria, idServicio) → precio.
async function preciosDelTecnico(idTecnico, q = db()) {
  const porServicio = await catalogo.mapaPrecios(idTecnico, q);
  const { rows } = await q.query(
    `SELECT c.codigo, COALESCE(e.precio_base, NULLIF(c.tarifa_base, 0), c.precio_min)::numeric(10,2)::text AS precio
     FROM categorias_servicio c
     LEFT JOIN especialidades_tecnico e ON e.categoria = c.codigo AND e.id_usuario = $1`,
    [idTecnico]
  );
  const map = Object.fromEntries(rows.map((r) => [r.codigo, r.precio]));
  return (categoria, idServicio = null) => (idServicio && porServicio.get(idServicio))
    || (categoria ? map[categoria] || DIAGNOSTICO.precio : DIAGNOSTICO.precio);
}

// Cotización base al aceptar: un concepto con el precio del técnico; la orden queda esperando el pago.
async function crearCotizacionBase(tx, row, idTecnico) {
  const { precio, concepto } = await precioDe(idTecnico, row.categoria, tx, row.id_servicio);
  await tx.query("UPDATE cotizaciones_servicio SET estado = 'REEMPLAZADA' WHERE id_solicitud = $1 AND estado = 'ENVIADA'", [row.id_solicitud]);
  const cot = (await tx.query(
    `INSERT INTO cotizaciones_servicio (id_solicitud, id_tecnico, monto_mano_obra, monto_materiales, monto_total, detalles, estado)
     VALUES ($1, $2, $3::numeric, 0, $3::numeric, $4, 'ENVIADA') RETURNING id_cotizacion`,
    [row.id_solicitud, idTecnico, precio, 'Precio base del servicio. Si se necesita algo más, el técnico lo cotiza dentro de la app.']
  )).rows[0];
  await tx.query(
    "INSERT INTO conceptos_cotizacion (id_solicitud, id_cotizacion, tipo, descripcion, monto) VALUES ($1, $2, 'MANO_OBRA', $3, $4::numeric)",
    [row.id_solicitud, cot.id_cotizacion, concepto, precio]
  );
  await tx.query(
    "UPDATE solicitudes_servicio SET estado = 'ESPERANDO_APROBACION', precio_base = $1::numeric, monto_cotizacion = $1::numeric WHERE id_solicitud = $2",
    [precio, row.id_solicitud]
  );
  return precio;
}

// ───────────── Vencimiento del pago del precio base ─────────────
// Si el cliente no paga el precio base a tiempo, la orden se cancela sola y el técnico queda libre.
const VENCE_MINUTOS = Number(process.env.PRECIO_BASE_VENCE_MIN) || 120;
const MOTIVO_VENCIDO = 'No se pagó el precio base a tiempo.';

// Hora límite para pagar (solo mientras la orden espera el pago del precio base).
function pagoVence(row) {
  if (row.estado !== 'ESPERANDO_APROBACION' || row.fecha_llegada || row.custodia_estado === 'RETENIDO' || !row.fecha_asignacion) return null;
  return new Date(new Date(row.fecha_asignacion).getTime() + VENCE_MINUTOS * 60000).toISOString();
}

async function vencerPreciosBase(q = db()) {
  const { rows } = await q.query(
    `UPDATE solicitudes_servicio s SET estado = 'CANCELADA', cancelado_por = 'SISTEMA', motivo_cancelacion = $2, estado_pago = 'NO_APLICA'
     WHERE s.estado = 'ESPERANDO_APROBACION' AND s.fecha_llegada IS NULL
       AND s.fecha_asignacion < NOW() - make_interval(mins => $1::int)
       AND COALESCE(s.estado_pago, '') <> 'PROCESANDO'
       AND NOT EXISTS (SELECT 1 FROM custodias k WHERE k.id_solicitud = s.id_solicitud AND k.estado = 'RETENIDO')
     RETURNING s.id_solicitud`,
    [VENCE_MINUTOS, MOTIVO_VENCIDO]
  );
  // Carga diferida: solicitudes.js no depende de este módulo, pero así se evita cualquier ciclo.
  const S = require('./solicitudes');
  for (const { id_solicitud: id } of rows) {
    await q.query("UPDATE cotizaciones_servicio SET estado = 'CANCELADA' WHERE id_solicitud = $1 AND estado = 'ENVIADA'", [id]);
    await q.query("UPDATE reprogramaciones SET estado = 'CANCELADA' WHERE id_solicitud = $1 AND estado = 'PENDIENTE'", [id]);
    const row = await S.findRow(id, q);
    S.notify(row, `La solicitud ${row.folio} se canceló porque no se pagó el precio base a tiempo. No se hizo ningún cargo.`, {
      push: [[row.id_usuario, 'Solicitud cancelada'], [row.id_tecnico, 'Servicio liberado']],
    });
  }
  return rows.length;
}

// ───────────── Cargo por visita al cancelar sin motivo ─────────────
// El cliente que cancela cuando el técnico ya salió paga la visita: la mitad del precio base (mínimo $100),
// nunca más de lo que tiene en custodia. No hay cargo si el técnico va tarde (más de 30 min después de la cita).
const CARGO_VISITA = { porcentaje: 0.5, minimo: 100 };
const TOLERANCIA_RETRASO_MIN = 30;

const minutosMx = (fecha, hora) => {
  const [y, m, d] = String(fecha).split('-').map(Number);
  const [h, mi] = String(hora).split(':').map(Number);
  return Date.UTC(y, m - 1, d, h, mi) / 60000;
};

function tecnicoRetrasado(row, now = new Date()) {
  if (row.estado !== 'EN_CAMINO' || !row.fecha_preferida || !row.hora_preferida) return false;
  const { nowMx } = require('../lib/dates');
  const ahora = nowMx(now);
  return minutosMx(ahora.fecha, ahora.hora) > minutosMx(row.fecha_preferida, row.hora_preferida) + TOLERANCIA_RETRASO_MIN;
}

function cargoCancelacion(row, now = new Date()) {
  if (row.custodia_estado !== 'RETENIDO' || !row.custodia_monto) return null;
  const salio = ['EN_CAMINO', 'EN_SITIO'].includes(row.estado) || (row.estado === 'ESPERANDO_APROBACION' && row.fecha_llegada);
  if (!salio || tecnicoRetrasado(row, now)) return null;
  const base = Number(row.precio_base || row.custodia_monto);
  const cargo = Math.min(Number(row.custodia_monto), Math.max(CARGO_VISITA.minimo, Math.round(base * CARGO_VISITA.porcentaje * 100) / 100));
  return cargo.toFixed(2);
}

// Cobra el cargo de lo que hay en custodia: lo registra como pago, abona el neto al técnico y deja en la
// custodia solo lo que se devuelve. Devuelve el cargo aplicado.
async function cobrarCargoCancelacion(tx, row, cargo) {
  const custodia = (await tx.query(
    "SELECT id_custodia, id_metodo, monto, modo, referencia FROM custodias WHERE id_solicitud = $1 AND estado = 'RETENIDO' FOR UPDATE",
    [row.id_solicitud]
  )).rows[0];
  if (!custodia) return null;
  const resto = Number(custodia.monto) - Number(cargo);
  if (resto <= 0.004) {
    await tx.query("UPDATE custodias SET estado = 'LIBERADO', cargo_cancelacion = monto, fecha_cierre = NOW() WHERE id_custodia = $1", [custodia.id_custodia]);
  } else {
    await tx.query('UPDATE custodias SET monto = monto - $2::numeric, cargo_cancelacion = $2::numeric WHERE id_custodia = $1', [custodia.id_custodia, cargo]);
  }
  const liq = (await tx.query('SELECT * FROM cs_liquidacion($1::numeric)', [cargo])).rows[0];
  const desglose = {
    total: liq.total, comision: liq.comision, base: liq.base,
    retencion_isr: liq.retencion_isr, retencion_iva: liq.retencion_iva, neto_tecnico: liq.neto_tecnico, concepto: 'CARGO_CANCELACION',
  };
  await tx.query(
    `INSERT INTO pagos (id_solicitud, id_cliente, id_metodo, monto, estado, modo, referencia, desglose)
     VALUES ($1, $2, $3, $4::numeric, 'PAGADO', $5, $6, $7)`,
    [row.id_solicitud, row.id_usuario, custodia.id_metodo, cargo, custodia.modo, custodia.referencia, JSON.stringify(desglose)]
  );
  const wallet = (await tx.query(
    `INSERT INTO billetera_tecnico (id_usuario, saldo_actual) VALUES ($1, 0)
     ON CONFLICT (id_usuario) DO UPDATE SET id_usuario = EXCLUDED.id_usuario RETURNING id_billetera`,
    [row.id_tecnico]
  )).rows[0];
  await tx.query('UPDATE billetera_tecnico SET saldo_actual = saldo_actual + $1::numeric, fecha_actualizacion = NOW() WHERE id_billetera = $2', [liq.neto_tecnico, wallet.id_billetera]);
  const { folio } = require('./solicitudes');
  await tx.query(
    `INSERT INTO transacciones (id_billetera, monto, tipo, estado, folio, concepto, id_solicitud, desglose)
     VALUES ($1, $2::numeric, 'INGRESO', 'COMPLETADO', $3, 'CARGO_CANCELACION', $4, $5)`,
    [wallet.id_billetera, liq.neto_tecnico, folio('TRX'), row.id_solicitud, JSON.stringify(desglose)]
  );
  await tx.query("UPDATE solicitudes_servicio SET cargo_cancelacion = $2::numeric, estado_pago = 'PAGADO' WHERE id_solicitud = $1", [row.id_solicitud, cargo]);
  return { cargo, neto_tecnico: liq.neto_tecnico };
}

module.exports = {
  DIAGNOSTICO, VENCE_MINUTOS, CARGO_VISITA, rangoDe, precioDe, preciosDelTecnico, crearCotizacionBase,
  pagoVence, vencerPreciosBase, cargoCancelacion, tecnicoRetrasado, cobrarCargoCancelacion,
};
