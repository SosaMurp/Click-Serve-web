// Prueba el envío de correo con la configuración SMTP de backend/.env.
// Uso:  node scripts/probar-correo.js tu.correo@ejemplo.com
// Manda un correo con un código de ejemplo (igual al del registro) y dice si el proveedor lo aceptó.
require('dotenv').config({ quiet: true });
const nodemailer = require('nodemailer');
const { sendCode } = require('../src/lib/mailer');

async function main() {
  const to = String(process.argv[2] || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error('Uso: node scripts/probar-correo.js tu.correo@ejemplo.com');
  const { SMTP_USER, SMTP_PASS, SMTP_HOST, SMTP_SERVICE } = process.env;
  if (!SMTP_USER || !SMTP_PASS) throw new Error('Faltan SMTP_USER y SMTP_PASS en backend/.env.');
  if (/\s/.test(SMTP_PASS)) console.warn('Aviso: SMTP_PASS tiene espacios. Si es una contraseña de aplicación de Google, quítalos.');

  // Primero se comprueba la conexión y el usuario y contraseña, sin mandar nada.
  const prueba = SMTP_HOST
    ? nodemailer.createTransport({ host: SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', auth: { user: SMTP_USER, pass: SMTP_PASS } })
    : nodemailer.createTransport({ service: SMTP_SERVICE || 'gmail', auth: { user: SMTP_USER, pass: SMTP_PASS } });
  await prueba.verify();
  console.log(`✔ El servidor de correo aceptó el usuario ${SMTP_USER}.`);

  const r = await sendCode({
    usuario: { correo: to, nombre: 'Prueba' },
    code: '123456',
    titulo: 'Prueba de correo',
    texto: 'Este es un correo de prueba de Click & Serve. Si te llegó, los códigos de registro y recuperación ya se envían.',
  });
  if (r.simulated) throw new Error('El correo se simuló en consola: revisa SMTP_USER y SMTP_PASS.');
  console.log(`✔ Correo enviado a ${to}. Revisa tu bandeja (y la carpeta de spam).`);
}

main().catch((error) => {
  const msg = String(error.message || error);
  if (/Invalid login|Username and Password not accepted|535/i.test(msg)) {
    console.error('✖ Gmail rechazó el usuario o la contraseña. Usa una "contraseña de aplicación" de 16 letras, no tu contraseña normal.');
  } else {
    console.error(`✖ ${msg}`);
  }
  process.exitCode = 1;
});
