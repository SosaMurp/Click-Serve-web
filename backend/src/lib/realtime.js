const { WebSocketServer } = require('ws');
const { verifyToken } = require('./tokens');

// RNF-12/16/17: canal en tiempo real. Una persona puede tener varias conexiones (varios dispositivos).
const clients = new Map();
let wss = null;
let pingTimer = null;
// El token llega en el primer mensaje, nunca en la URL: las direcciones quedan en los registros de proxies y
// balanceadores (RNF-40). Si no llega a tiempo o no es válido, se cierra con 4401.
const AUTH_TIMEOUT_MS = 5000;

function register(userId, ws, session) {
  const id = Number(userId);
  if (!clients.has(id)) clients.set(id, new Set());
  clients.get(id).add(ws);
  ws.session = session;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('close', () => {
    const set = clients.get(id);
    if (set) {
      set.delete(ws);
      if (set.size === 0) clients.delete(id);
    }
  });
  ws.on('error', () => {});
  ws.send(JSON.stringify({ event: 'conectado', data: { id_usuario: id }, ts: Date.now() }));
}

function attach(server) {
  // Import diferido: auth depende del pool y este módulo se carga antes en algunos scripts.
  const { loadSessionUser } = require('../middleware/auth');
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (req, socket, head) => {
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      socket.destroy();
      return;
    }
    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }
    // Un token en la URL ya no se acepta (y no se lee): la app lo manda como primer mensaje.
    if (url.searchParams.has('token')) {
      socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const timer = setTimeout(() => ws.close(4401, 'Sin autenticación'), AUTH_TIMEOUT_MS);
      ws.once('message', async (raw) => {
        clearTimeout(timer);
        try {
          const msg = JSON.parse(String(raw));
          if (msg?.type !== 'auth' || typeof msg.token !== 'string') throw new Error('mensaje inicial inválido');
          const result = await loadSessionUser(verifyToken(msg.token));
          if (result.error) throw new Error(result.error);
          if (ws.readyState !== 1) return;
          register(result.user.id_usuario, ws, { id: result.user.sessionId, version: result.user.version_sesion });
        } catch {
          ws.close(4401, 'Sesión no válida');
        }
      });
      ws.on('error', () => {});
    });
  });

  pingTimer = setInterval(() => {
    revalidateSessions().catch((error) => console.error('No se pudieron revalidar las sesiones del WebSocket:', error.message));
    for (const set of clients.values()) {
      for (const ws of set) {
        if (!ws.isAlive) {
          ws.terminate();
          continue;
        }
        ws.isAlive = false;
        ws.ping();
      }
    }
  }, 25000);
  pingTimer.unref();
  return wss;
}

// La sesión solo se valida al conectar; en cada ping se revisa de nuevo para cortar los sockets de
// sesiones cerradas, revocadas desde otro dispositivo, con contraseña cambiada o cuentas borradas.
async function revalidateSessions() {
  const sockets = [...clients.values()].flatMap((set) => [...set]).filter((ws) => ws.session);
  if (sockets.length === 0) return;
  const { getPool } = require('../db/pool');
  const { rows } = await getPool().query(
    `SELECT s.id_sesion::text AS id, u.version_sesion
     FROM sesiones_activas s JOIN usuarios u ON u.id_usuario = s.id_usuario
     WHERE s.id_sesion = ANY($1::uuid[]) AND s.estado = 'activa' AND u.anonimizado = false AND s.id_rol = u.id_rol`,
    [[...new Set(sockets.map((ws) => ws.session.id))]]
  );
  const vigentes = new Map(rows.map((r) => [r.id, r.version_sesion || 1]));
  for (const ws of sockets) {
    if (vigentes.get(String(ws.session.id)) !== ws.session.version) ws.close(4401, 'Sesión terminada');
  }
}

function emitToUser(userId, event, data) {
  if (userId == null) return 0;
  const set = clients.get(Number(userId));
  if (!set) return 0;
  const message = JSON.stringify({ event, data, ts: Date.now() });
  for (const ws of set) {
    if (ws.readyState === 1) ws.send(message);
  }
  return set.size;
}

function emitToUsers(userIds, event, data) {
  for (const id of new Set(userIds.filter((v) => v != null).map(Number))) emitToUser(id, event, data);
}

function isOnline(userId) {
  return clients.has(Number(userId));
}

function closeAll() {
  if (pingTimer) clearInterval(pingTimer);
  for (const set of clients.values()) for (const ws of set) ws.terminate();
  clients.clear();
  if (wss) wss.close();
  wss = null;
}

module.exports = { attach, emitToUser, emitToUsers, isOnline, closeAll, revalidateSessions };
