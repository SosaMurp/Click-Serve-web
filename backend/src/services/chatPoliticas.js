const { getPool } = require('../db/pool');
const { HttpError } = require('../lib/http');

// Aceptación obligatoria de las reglas del chat seguro. Al cambiar el texto de los modales en la app,
// sube VERSION para que todos vuelvan a aceptarlas.
const VERSION = '2026-11-custodia';
const TIPO = { SOLICITUD: 'SOLICITUD', DIRECTO: 'DIRECTO' };

async function politicasAceptadas(idUsuario, tipo, idChat, db = getPool()) {
  const { rows } = await db.query(
    'SELECT 1 FROM aceptaciones_chat WHERE id_usuario = $1 AND tipo_chat = $2 AND id_chat = $3 AND version = $4',
    [idUsuario, tipo, idChat, VERSION]
  );
  return rows.length > 0;
}

async function aceptarPoliticas(idUsuario, tipo, idChat, db = getPool()) {
  await db.query(
    `INSERT INTO aceptaciones_chat (id_usuario, tipo_chat, id_chat, version) VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING`,
    [idUsuario, tipo, idChat, VERSION]
  );
}

async function exigirPoliticas(idUsuario, tipo, idChat, db = getPool()) {
  if (!(await politicasAceptadas(idUsuario, tipo, idChat, db))) {
    throw new HttpError(403, 'CHAT_POLICY_REQUIRED', 'Acepta las reglas del chat seguro antes de escribir.');
  }
}

module.exports = { VERSION, TIPO, politicasAceptadas, aceptarPoliticas, exigirPoliticas };
