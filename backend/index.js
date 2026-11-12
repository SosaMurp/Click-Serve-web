const http = require('http');
require('dotenv').config({ quiet: true });
const { migrate } = require('./src/db/migrate');
const { createApp } = require('./src/app');
const realtime = require('./src/lib/realtime');
const { getPool, closePool } = require('./src/db/pool');

// RNF-34: un técnico sin latido en 5 minutos deja de figurar como disponible.
function startAvailabilitySweep() {
  const timer = setInterval(() => {
    getPool()
      .query("UPDATE usuarios SET disponible = false WHERE disponible AND id_rol = 2 AND (ultimo_latido IS NULL OR ultimo_latido < NOW() - INTERVAL '5 minutes')")
      .catch((error) => console.error('No se pudo actualizar la disponibilidad:', error.message));
  }, 60 * 1000);
  timer.unref();
}

async function start(port = process.env.PORT || 3000) {
  // DB_AUTO_MIGRATE=false evita que el arranque modifique la base (p. ej. una base remota con datos que
  // todavía no se ha revisado). Las migraciones se aplican entonces a mano con `npm run db:migrate`.
  if (process.env.DB_AUTO_MIGRATE === 'false') {
    console.log('DB_AUTO_MIGRATE=false: no se aplican migraciones al arrancar.');
  } else {
    await migrate();
  }
  const server = http.createServer(createApp());
  realtime.attach(server);
  startAvailabilitySweep();
  server.listen(port, () => {
    console.log(`Servidor corriendo en el puerto ${port}`);
  });

  // Apagado ordenado (despliegues y reinicios): deja de aceptar conexiones, cierra los WebSocket,
  // espera a que terminen las peticiones en curso y cierra el pool de PostgreSQL.
  let closing = false;
  const shutdown = (signal) => {
    if (closing) return;
    closing = true;
    console.log(`${signal} recibido: cerrando el servidor…`);
    realtime.closeAll();
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    server.close(() => {
      closePool().finally(() => process.exit(0));
    });
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
  return server;
}

if (require.main === module) {
  start().catch((error) => {
    // Base remota por túnel SSH: si el túnel no está abierto, se dice directamente qué hacer.
    if (error.code === 'ECONNREFUSED' && process.env.SSH_HOST && String(error.port) === String(process.env.DB_PORT)) {
      console.error(`No se pudo conectar a la base en ${error.address}:${error.port}: el túnel SSH no está abierto.`);
      console.error('Ábrelo en otra terminal con "npm run tunel", escribe la contraseña SSH y vuelve a iniciar el backend.');
    } else {
      console.error('No se pudo iniciar el servidor:', error);
    }
    process.exit(1);
  });
}

module.exports = { start };
