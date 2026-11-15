const { getPool, withTransaction } = require('../db/pool');
const realtime = require('../lib/realtime');
const { sendPush } = require('../lib/push');
const { HttpError } = require('../lib/http');

// Escala progresiva de sanciones por intentos de desintermediación (sacar el trato o el pago de la app).
//   Nivel 1 (primer aviso): advertencia visible; el mensaje ya lo bloqueó el filtro del chat.
//   Nivel 2 (reincidencia): 2+ intentos en 30 días, o cancelar un pedido tras compartir contacto → 24 h sin
//            poder pedir ni aceptar trabajos.
//   Nivel 3 (reincidir tras la suspensión de 24 h) → 7 días suspendido + baja prioridad en la asignación.
//   Nivel 4 (reincidir tras el nivel 3, o falta grave que registra un administrador) → baneo definitivo.

const MENSAJES = {
  1: 'Por tu seguridad y la garantía del servicio, no compartas datos de contacto ni acuerdes pagos por fuera.',
  2: 'Tu cuenta ha sido suspendida temporalmente por 24 horas debido a incumplimiento en las políticas de contratación dentro de la app.',
  3: 'Suspensión de 7 días por reincidencia en evasión de plataforma.',
  4: 'Tu cuenta ha sido desactivada permanentemente por infringir los Términos de Servicio de Click&Serve.',
};

const TITULOS = { 1: 'Aviso de seguridad', 2: 'Cuenta suspendida 24 horas', 3: 'Cuenta suspendida 7 días', 4: 'Cuenta desactivada' };

// Duración de cada nivel y cuánto dura la baja prioridad en la asignación después de un nivel 3.
const DURACION = { 2: "INTERVAL '24 hours'", 3: "INTERVAL '7 days'" };
const PRIORIDAD_BAJA_EXTRA = "INTERVAL '30 days'";
// Mensajes bloqueados dentro de esta ventana cuentan como un mismo intento (alguien que escribe su número en
// varios mensajes seguidos no pasa del aviso a la suspensión en segundos).
const RAFAGA = "INTERVAL '10 minutes'";
const VENTANA_REINCIDENCIA = "INTERVAL '30 days'";

const TIPOS = {
  CHAT_CONTACTO: 'CHAT_CONTACTO',
  CANCELACION_TRAS_CONTACTO: 'CANCELACION_TRAS_CONTACTO',
  ADMIN: 'ADMIN',
};

// Siguiente nivel de la escala para esta persona (la consulta corre dentro de la transacción y con la fila bloqueada).
async function siguienteNivel(tx, idUsuario, nivelMinimo) {
  const { rows: [h] } = await tx.query(
    `SELECT COALESCE(MAX(nivel) FILTER (WHERE nivel >= 2), 0) AS maximo,
            (SELECT COUNT(*)::int FROM infracciones
              WHERE id_usuario = $1 AND nivel_resultante IS NOT NULL AND fecha > NOW() - ${VENTANA_REINCIDENCIA}) AS recientes
     FROM sanciones WHERE id_usuario = $1 AND levantada = false`,
    [idUsuario]
  );
  let nivel;
  if (h.maximo >= 3) nivel = 4;
  else if (h.maximo === 2) nivel = 3;
  // "recientes" no incluye la infracción actual: con una previa en 30 días, esta es la segunda.
  else if (h.recientes >= 1) nivel = 2;
  else nivel = 1;
  return Math.max(nivel, nivelMinimo);
}

// Aplica el nivel sobre la cuenta (dentro de la transacción) y deja el registro de la sanción.
async function aplicarNivel(tx, { idUsuario, nivel, motivo, idInfraccion = null, aplicadaPor = 'SISTEMA', idAdmin = null }) {
  if (nivel === 4) {
    await tx.query(
      "UPDATE usuarios SET baneado = true, estado_cuenta = 'SUSPENDIDO', disponible = false, suspendido_hasta = NULL WHERE id_usuario = $1",
      [idUsuario]
    );
    await tx.query("UPDATE sesiones_activas SET estado = 'revocada' WHERE id_usuario = $1 AND estado = 'activa'", [idUsuario]);
  } else if (nivel === 2 || nivel === 3) {
    const extra = nivel === 3 ? `, prioridad_baja_hasta = NOW() + ${DURACION[3]} + ${PRIORIDAD_BAJA_EXTRA}` : '';
    await tx.query(
      `UPDATE usuarios SET suspendido_hasta = GREATEST(COALESCE(suspendido_hasta, NOW()), NOW() + ${DURACION[nivel]}),
         disponible = false${extra}
       WHERE id_usuario = $1`,
      [idUsuario]
    );
  }
  // Fin: la advertencia termina al momento, el baneo no termina, la suspensión dura lo que quedó en la cuenta.
  let fin = null;
  if (nivel === 1) fin = new Date();
  if (nivel === 2 || nivel === 3) fin = (await tx.query('SELECT suspendido_hasta FROM usuarios WHERE id_usuario = $1', [idUsuario])).rows[0].suspendido_hasta;
  const { rows: [s] } = await tx.query(
    `INSERT INTO sanciones (id_usuario, nivel, motivo, fin, aplicada_por, id_admin, id_infraccion)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id_sancion, nivel, inicio, fin`,
    [idUsuario, nivel, motivo, fin, aplicadaPor, idAdmin, idInfraccion]
  );
  return s;
}

function notificar(idUsuario, sancion) {
  const data = { nivel: sancion.nivel, titulo: TITULOS[sancion.nivel], mensaje: MENSAJES[sancion.nivel], hasta: sancion.fin };
  realtime.emitToUser(idUsuario, 'cuenta.sancion', data);
  if (sancion.nivel >= 2) sendPush(idUsuario, TITULOS[sancion.nivel], MENSAJES[sancion.nivel], { tipo: 'sancion', nivel: sancion.nivel });
  // El baneo cierra las sesiones abiertas: el WebSocket se corta después de avisar.
  if (sancion.nivel === 4) setTimeout(() => realtime.revalidateSessions().catch(() => {}), 500);
}

// Registra un intento de desintermediación y aplica el nivel que corresponda.
// Devuelve { nivel, titulo, mensaje, hasta } o null si se contó como parte de un intento reciente.
async function registrarInfraccion({ idUsuario, tipo, idSolicitud = null, idConversacion = null, detalle = null, nivelMinimo = 1 }) {
  const out = await withTransaction(async (tx) => {
    const { rows: [u] } = await tx.query('SELECT baneado FROM usuarios WHERE id_usuario = $1 FOR UPDATE', [idUsuario]);
    if (!u) return null;
    const rafaga = tipo === TIPOS.CHAT_CONTACTO && (await tx.query(
      `SELECT 1 FROM infracciones WHERE id_usuario = $1 AND tipo = $2 AND fecha > NOW() - ${RAFAGA} LIMIT 1`,
      [idUsuario, tipo]
    )).rowCount > 0;
    const nivel = u.baneado || rafaga ? null : await siguienteNivel(tx, idUsuario, nivelMinimo);
    const { rows: [inf] } = await tx.query(
      `INSERT INTO infracciones (id_usuario, tipo, id_solicitud, id_conversacion, detalle, nivel_resultante)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_infraccion`,
      [idUsuario, tipo, idSolicitud, idConversacion, detalle ? JSON.stringify(detalle) : null, nivel]
    );
    if (!nivel) return null;
    return aplicarNivel(tx, { idUsuario, nivel, motivo: tipo, idInfraccion: inf.id_infraccion });
  });
  if (!out) return null;
  notificar(idUsuario, out);
  return { nivel: out.nivel, titulo: TITULOS[out.nivel], mensaje: MENSAJES[out.nivel], hasta: out.fin };
}

// Sanción que aplica un administrador (p. ej. nivel 4 por cobro indebido o agresión).
async function sancionarComoAdmin({ idUsuario, nivel, motivo, idAdmin }) {
  const out = await withTransaction(async (tx) => {
    const { rows: [u] } = await tx.query('SELECT id_usuario FROM usuarios WHERE id_usuario = $1 AND anonimizado = false FOR UPDATE', [idUsuario]);
    if (!u) throw new HttpError(404, 'NOT_FOUND', 'Usuario no encontrado.');
    const { rows: [inf] } = await tx.query(
      'INSERT INTO infracciones (id_usuario, tipo, detalle, nivel_resultante) VALUES ($1, $2, $3, $4) RETURNING id_infraccion',
      [idUsuario, TIPOS.ADMIN, JSON.stringify({ motivo }), nivel]
    );
    return aplicarNivel(tx, { idUsuario, nivel, motivo, idInfraccion: inf.id_infraccion, aplicadaPor: 'ADMIN', idAdmin });
  });
  notificar(idUsuario, out);
  return out;
}

// Levanta una sanción (revisión del administrador): quita la suspensión o el baneo que impuso.
async function levantarSancion(idSancion) {
  return withTransaction(async (tx) => {
    const { rows: [s] } = await tx.query(
      'UPDATE sanciones SET levantada = true, fecha_levantada = NOW() WHERE id_sancion = $1 AND levantada = false RETURNING id_usuario, nivel',
      [idSancion]
    );
    if (!s) throw new HttpError(409, 'INVALID_STATE', 'La sanción no existe o ya fue levantada.');
    if (s.nivel === 4) {
      await tx.query(
        "UPDATE usuarios SET baneado = false, estado_cuenta = CASE WHEN identidad_verificada THEN 'APROBADO' ELSE 'Activo' END WHERE id_usuario = $1",
        [s.id_usuario]
      );
    } else if (s.nivel >= 2) {
      // Si queda otra suspensión vigente sin levantar, se respeta la más larga.
      await tx.query(
        `UPDATE usuarios SET suspendido_hasta = (
           SELECT MAX(fin) FROM sanciones WHERE id_usuario = $1 AND levantada = false AND nivel IN (2, 3) AND fin > NOW())
         WHERE id_usuario = $1`,
        [s.id_usuario]
      );
    }
    return s;
  });
}

// Estado de sanción de una cuenta para mostrarlo en la app.
function estadoSancion(row) {
  const hasta = row?.suspendido_hasta ? new Date(row.suspendido_hasta) : null;
  if (!hasta || hasta <= new Date()) return null;
  return { suspendido_hasta: hasta.toISOString() };
}

// Una cuenta suspendida (nivel 2 o 3) no puede pedir ni aceptar trabajos nuevos: lanza 403 con la fecha de fin.
async function exigirNoSuspendido(idUsuario, db = getPool()) {
  const { rows: [u] } = await db.query('SELECT suspendido_hasta FROM usuarios WHERE id_usuario = $1', [idUsuario]);
  const estado = estadoSancion(u);
  if (!estado) return;
  const fecha = new Date(estado.suspendido_hasta).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'medium', timeStyle: 'short' });
  throw new HttpError(
    403,
    'ACCOUNT_SUSPENDED_TEMP',
    `Tu cuenta está suspendida hasta el ${fecha} por incumplir las políticas de contratación dentro de la app. Mientras tanto no puedes pedir ni aceptar trabajos nuevos.`,
    { suspendido_hasta: estado.suspendido_hasta }
  );
}

// La misma regla como middleware de Express (Express 5 propaga el error al manejador).
async function noSuspendido(req, _res, next) {
  await exigirNoSuspendido(req.user.id_usuario);
  next();
}

module.exports = { TIPOS, MENSAJES, registrarInfraccion, sancionarComoAdmin, levantarSancion, estadoSancion, exigirNoSuspendido, noSuspendido };
