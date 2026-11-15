// Ayuda para probar la escala de sanciones en desarrollo con las cuentas de prueba.
// Uso:
//   node scripts/sanciones-dev.js estado    correo@ejemplo.com   → nivel, suspensión, baneo e intentos
//   node scripts/sanciones-dev.js avanzar   correo@ejemplo.com   → mueve los intentos 15 min atrás (el siguiente
//                                                                  mensaje bloqueado cuenta como intento nuevo)
//   node scripts/sanciones-dev.js reiniciar correo@ejemplo.com   → borra intentos y sanciones, quita suspensión y baneo
// Solo funciona con NODE_ENV=development o test: en producción borraría historial real.
require('dotenv').config({ quiet: true });
const { getPool, closePool } = require('../src/db/pool');
const { isDevelopment } = require('../src/lib/env');

const USO = 'Uso: node scripts/sanciones-dev.js <estado|avanzar|reiniciar> correo@ejemplo.com';

async function main() {
  if (!isDevelopment()) throw new Error('Este script solo corre con NODE_ENV=development o test.');
  const [accion, correoRaw] = process.argv.slice(2);
  const correo = String(correoRaw || '').trim().toLowerCase();
  if (!['estado', 'avanzar', 'reiniciar'].includes(accion) || !correo) throw new Error(USO);

  const db = getPool();
  const { rows: [u] } = await db.query(
    'SELECT id_usuario, nombre, suspendido_hasta, prioridad_baja_hasta, baneado, estado_cuenta FROM usuarios WHERE correo = $1',
    [correo]
  );
  if (!u) throw new Error(`No existe una cuenta con el correo ${correo}.`);

  if (accion === 'avanzar') {
    const { rowCount } = await db.query("UPDATE infracciones SET fecha = fecha - INTERVAL '15 minutes' WHERE id_usuario = $1", [u.id_usuario]);
    console.log(`Listo: ${rowCount} intento(s) movidos 15 minutos atrás. El próximo mensaje bloqueado subirá de nivel.`);
  }

  if (accion === 'reiniciar') {
    await db.query('DELETE FROM sanciones WHERE id_usuario = $1', [u.id_usuario]);
    await db.query('DELETE FROM infracciones WHERE id_usuario = $1', [u.id_usuario]);
    await db.query(
      `UPDATE usuarios SET suspendido_hasta = NULL, prioridad_baja_hasta = NULL, baneado = false,
         estado_cuenta = CASE WHEN UPPER(estado_cuenta) = 'SUSPENDIDO'
                              THEN CASE WHEN identidad_verificada THEN 'APROBADO' ELSE 'Activo' END ELSE estado_cuenta END
       WHERE id_usuario = $1`,
      [u.id_usuario]
    );
    console.log(`Listo: ${u.nombre} quedó sin sanciones ni intentos. Si estaba baneado, vuelve a iniciar sesión.`);
  }

  const { rows: [actual] } = await db.query(
    `SELECT u.suspendido_hasta, u.prioridad_baja_hasta, u.baneado,
            (SELECT MAX(nivel) FROM sanciones s WHERE s.id_usuario = u.id_usuario AND NOT s.levantada) AS nivel,
            (SELECT COUNT(*)::int FROM infracciones i WHERE i.id_usuario = u.id_usuario) AS intentos
     FROM usuarios u WHERE u.id_usuario = $1`,
    [u.id_usuario]
  );
  const fecha = (d) => (d && new Date(d) > new Date() ? new Date(d).toLocaleString('es-MX') : 'no');
  console.log(`\n${u.nombre} (${correo})`);
  console.log(`  Nivel más alto aplicado: ${actual.nivel ?? 'ninguno'}`);
  console.log(`  Mensajes bloqueados registrados: ${actual.intentos}`);
  console.log(`  Suspendido hasta: ${fecha(actual.suspendido_hasta)}`);
  console.log(`  Baja prioridad hasta: ${fecha(actual.prioridad_baja_hasta)}`);
  console.log(`  Baneado: ${actual.baneado ? 'sí' : 'no'}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => closePool());
