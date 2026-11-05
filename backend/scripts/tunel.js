// Abre el túnel SSH hacia el PostgreSQL del servidor (OVH): `npm run tunel`.
//
//   127.0.0.1:TUNNEL_LOCAL_PORT  ══ ssh ══>  servidor: TUNNEL_REMOTE_HOST:TUNNEL_REMOTE_PORT
//
// Con el túnel abierto, el backend usa DB_HOST=127.0.0.1 y DB_PORT=TUNNEL_LOCAL_PORT.
// Deja esta terminal abierta mientras trabajas; Ctrl+C cierra el túnel. Si el acceso es con contraseña,
// ssh la pide aquí mismo (no se guarda en ningún archivo).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const { spawn } = require('child_process');

const host = process.env.SSH_HOST;
const user = process.env.SSH_USER || 'ubuntu';
const sshPort = process.env.SSH_PORT || '22';
const localPort = process.env.TUNNEL_LOCAL_PORT || '15432';
const remoteHost = process.env.TUNNEL_REMOTE_HOST || 'localhost';
const remotePort = process.env.TUNNEL_REMOTE_PORT || '5432';

if (!host) {
  console.error('Falta SSH_HOST en backend/.env (la IP o dominio del servidor).');
  process.exit(1);
}

const args = [
  '-N', // solo reenvío de puerto, sin abrir una consola remota
  '-L', `127.0.0.1:${localPort}:${remoteHost}:${remotePort}`,
  '-p', sshPort,
  '-o', 'ExitOnForwardFailure=yes', // si el puerto local está ocupado, falla en vez de quedarse "abierto" sin túnel
  '-o', 'ServerAliveInterval=30', // mantiene viva la conexión y detecta cortes
  '-o', 'ServerAliveCountMax=3',
  `${user}@${host}`,
];
if (process.env.SSH_KEY) args.unshift('-i', process.env.SSH_KEY);

console.log(`Túnel: 127.0.0.1:${localPort} → ${user}@${host}:${sshPort} → ${remoteHost}:${remotePort}`);
console.log('Ctrl+C para cerrarlo.\n');
const ssh = spawn('ssh', args, { stdio: 'inherit' });
ssh.on('exit', (code) => {
  if (code) console.error(`\nEl túnel se cerró (código ${code}). Revisa usuario, contraseña, IP o que el puerto ${localPort} esté libre.`);
  process.exit(code ?? 0);
});
process.on('SIGINT', () => ssh.kill('SIGINT'));
