// scripts/create-test-admin.js — Solo para desarrollo local.
//
//   node scripts/create-test-admin.js       → crea/actualiza el admin de prueba y guarda
//                                             sus credenciales en backend/test-admin.local
//   node scripts/create-test-admin.js otp   → muestra el último código 2FA sin usar de ese admin
//
// test-admin.local está ignorado por git (*.local).
require('dotenv').config({ quiet: true });
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const EMAIL = 'admin.pruebas@clickserve.test';
const CREDS_FILE = path.join(__dirname, '..', 'test-admin.local');

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

async function createAdmin() {
  const password = crypto.randomBytes(9).toString('base64url');
  const hash = await bcrypt.hash(password, 10);

  const existing = await pool.query('SELECT id_usuario FROM usuarios WHERE correo = $1', [EMAIL]);
  if (existing.rows.length) {
    await pool.query(
      `UPDATE usuarios SET contrasena = $1, id_rol = 3, estado_cuenta = 'Activo' WHERE correo = $2`,
      [hash, EMAIL]
    );
  } else {
    await pool.query(
      `INSERT INTO usuarios (nombre, apellido, correo, contrasena, id_rol, estado_cuenta)
       VALUES ('Admin', 'Pruebas', $1, $2, 3, 'Activo')`,
      [EMAIL, hash]
    );
  }

  fs.writeFileSync(CREDS_FILE, `Admin de prueba (solo local)\ncorreo:     ${EMAIL}\ncontraseña: ${password}\n`);
  console.log(`Admin de prueba listo. Credenciales guardadas en ${CREDS_FILE}`);
}

async function showOtp() {
  const { rows } = await pool.query(
    `SELECT t.token, t.fecha_expiracion FROM tokens_temporales t
     JOIN usuarios u ON u.id_usuario = t.id_usuario
     WHERE u.correo = $1 AND t.tipo_accion = 'login_admin' AND t.estado_uso = 'sin usar'
       AND t.fecha_expiracion > CURRENT_TIMESTAMP
     ORDER BY t.fecha_expiracion DESC LIMIT 1`,
    [EMAIL]
  );
  console.log(rows.length ? `Código 2FA: ${rows[0].token}` : 'No hay código vigente. Inicia sesión primero en el panel.');
}

(process.argv[2] === 'otp' ? showOtp() : createAdmin())
  .catch((err) => { console.error('Error:', err.message); process.exitCode = 1; })
  .finally(() => pool.end());
