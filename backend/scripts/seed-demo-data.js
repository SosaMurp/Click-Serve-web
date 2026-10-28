// scripts/seed-demo-data.js — Solo para desarrollo local.
//
//   node scripts/seed-demo-data.js          → (re)carga datos de demostración para el dashboard
//   node scripts/seed-demo-data.js --clean  → borra solo los datos de demostración
//
// Todo lo que crea pertenece a usuarios con correo @demo.clickserve.test,
// así que la limpieza no toca datos reales.
require('dotenv').config({ quiet: true });
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Pool } = require('pg');

const DOMAIN = '@demo.clickserve.test';

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

// PRNG con semilla para que cada carga produzca los mismos datos
let seed = 20261028;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (min, max) => min + Math.floor(rand() * (max - min + 1));

const ESPECIALIDADES = {
  'Electricidad': ['Reparación de contacto eléctrico', 'Cambio de apagadores', 'Revisión de cableado', 'Instalación de lámparas', 'Corto circuito en cocina'],
  'Plomería':     ['Fuga en lavabo', 'Destape de drenaje', 'Cambio de llave de paso', 'Instalación de calentador', 'Reparación de WC'],
  'Cómputo':      ['Formateo de laptop', 'Configuración de red WiFi', 'Limpieza de virus', 'Cambio de disco SSD', 'Instalación de impresora'],
  'Climas':       ['Mantenimiento de minisplit', 'Instalación de minisplit', 'Recarga de gas', 'Limpieza de evaporador'],
  'Cerrajería':   ['Cambio de chapa', 'Apertura de puerta', 'Duplicado de llaves', 'Instalación de cerradura digital'],
};
// Peso relativo de cada especialidad en la demanda
const PESOS = { 'Electricidad': 38, 'Plomería': 27, 'Cómputo': 18, 'Climas': 11, 'Cerrajería': 6 };

const TECNICOS = [
  ['Luis', 'Ramírez', 'Electricidad'], ['Marco', 'Gil', 'Plomería'], ['Pedro', 'Núñez', 'Climas'],
  ['Jorge', 'Vela', 'Cerrajería'], ['Sofía', 'Medina', 'Cómputo'], ['Raúl', 'Ochoa', 'Electricidad'],
  ['Diana', 'Rosales', 'Plomería'], ['Héctor', 'Salas', 'Cómputo'],
];
const TECNICOS_PENDIENTES = [['Iván', 'Cortés', 'Electricidad'], ['Mariana', 'Luna', 'Climas'], ['Óscar', 'Pineda', 'Plomería']];
const CLIENTES = [
  ['Ana', 'Torres'], ['Rosa', 'León'], ['Iván', 'Soto'], ['Eva', 'Ruiz'], ['Sara', 'Paz'], ['Antonio', 'Mora'],
  ['Lía', 'Cruz'], ['Alberto', 'Lara'], ['Gabriela', 'Ortiz'], ['Carlos', 'Fuentes'], ['Paty', 'Reyes'], ['Miguel', 'Ángeles'],
];
const COLONIAS = ['Col. Centro', 'Col. Infonavit Las Truchas', 'Col. La Mira', 'Col. Guacamayas', 'Col. Primer Sector', 'Col. Segundo Sector', 'Col. Habitacional Sicartsa', 'Col. Morelos'];
const MONTOS = { 'Electricidad': [350, 1200], 'Plomería': [300, 1500], 'Cómputo': [400, 1800], 'Climas': [800, 4500], 'Cerrajería': [250, 900] };

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function pickEspecialidad() {
  let r = rand() * 100
  for (const [esp, w] of Object.entries(PESOS)) { if ((r -= w) <= 0) return esp }
  return 'Electricidad'
}

async function clean(client) {
  const demo = `SELECT id_usuario FROM usuarios WHERE correo LIKE '%${DOMAIN}'`;
  await client.query(`DELETE FROM pagos WHERE id_servicio IN (
    SELECT id_servicio FROM servicios WHERE id_cliente IN (${demo}) OR id_tecnico IN (${demo}) OR id_usuario IN (${demo}))`);
  await client.query(`DELETE FROM servicios WHERE id_cliente IN (${demo}) OR id_tecnico IN (${demo}) OR id_usuario IN (${demo})`);
  const { rowCount } = await client.query(`DELETE FROM usuarios WHERE correo LIKE '%${DOMAIN}'`);
  return rowCount;
}

async function insertUser(client, nombre, apellido, rol, hash) {
  const correo = `${slug(nombre)}.${slug(apellido)}${DOMAIN}`;
  const { rows } = await client.query(
    `INSERT INTO usuarios (nombre, apellido, correo, contrasena, id_rol, estado_cuenta, telefono)
     VALUES ($1, $2, $3, $4, $5, 'Activo', $6) RETURNING id_usuario`,
    [nombre, apellido, correo, hash, rol, `753${between(1000000, 9999999)}`]
  );
  return rows[0].id_usuario;
}

async function seedData(client) {
  // Contraseña aleatoria y descartada: estas cuentas no están pensadas para iniciar sesión
  const hash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
  const DAY = 864e5;
  const now = Date.now();

  // Técnicos aprobados, agrupados por especialidad
  const porEspecialidad = {};
  for (const [nombre, apellido, esp] of TECNICOS) {
    const id = await insertUser(client, nombre, apellido, 2, hash);
    (porEspecialidad[esp] ??= []).push(id);
    await client.query(
      `INSERT INTO expedientes_tecnicos (id_usuario, especialidad, estatus, fecha_solicitud, fecha_resolucion, metricas)
       VALUES ($1, $2, 'Aprobado', $3, $4, $5)`,
      [id, esp, new Date(now - between(40, 120) * DAY), new Date(now - between(30, 39) * DAY),
       JSON.stringify({ calificacion: +(4 + rand()).toFixed(1), trabajos: between(20, 140), efectividad: between(88, 100) })]
    );
  }

  // Sesiones activas: 2 antiguas (cuentan para la semana anterior) y 4 recientes
  const tecnicosIds = Object.values(porEspecialidad).flat();
  for (const [i, id] of tecnicosIds.slice(0, 6).entries()) {
    await client.query(
      `INSERT INTO sesiones_activas (id_usuario, id_rol, dispositivo, fecha_creacion, estado) VALUES ($1, 2, 'Android', $2, 'activa')`,
      [id, new Date(now - (i < 2 ? 10 : between(0, 3)) * DAY)]
    );
  }

  // Técnicos esperando validación (aparecen en "Validaciones" y en la actividad)
  for (const [i, [nombre, apellido, esp]] of TECNICOS_PENDIENTES.entries()) {
    const id = await insertUser(client, nombre, apellido, 2, hash);
    await client.query(
      `INSERT INTO expedientes_tecnicos (id_usuario, especialidad, estatus, fecha_solicitud) VALUES ($1, $2, 'En Revisión', $3)`,
      [id, esp, new Date(now - (i * 5 + 1) * 36e5)]
    );
  }

  const clientes = [];
  for (const [nombre, apellido] of CLIENTES) clientes.push(await insertUser(client, nombre, apellido, 1, hash));

  // Servicios de los últimos 30 días, con más demanda conforme avanza el mes
  let servicios = 0, pagos = 0;
  for (let d = 29; d >= 0; d--) {
    const delDia = Math.round(4 + (29 - d) / 4 + rand() * 4);
    for (let k = 0; k < delDia; k++) {
      const esp = pickEspecialidad();
      const creado = new Date(now - d * DAY - between(0, d === 0 ? 8 : 20) * 36e5 - between(0, 59) * 6e4);
      const r = rand();
      // Hoy y ayer hay más servicios abiertos; los días anteriores ya se resolvieron
      const estatus = d <= 1
        ? (r < 0.35 ? 'En Curso' : r < 0.5 ? 'Pendiente' : r < 0.93 ? 'Completado' : 'Cancelado')
        : (r < 0.87 ? 'Completado' : r < 0.97 ? 'Cancelado' : 'En Curso');
      const tecnico = estatus === 'Pendiente' ? null : pick(porEspecialidad[esp] ?? tecnicosIds);
      const cliente = pick(clientes);
      const [min, max] = MONTOS[esp];
      const monto = estatus === 'Pendiente' ? null : Math.round(between(min, max) / 10) * 10;

      const { rows } = await client.query(
        `INSERT INTO servicios (id_usuario, id_cliente, id_tecnico, titulo, descripcion, estatus, monto,
                                latitud, longitud, direccion, fecha_creacion, fecha_actualizacion)
         VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10) RETURNING id_servicio`,
        [cliente, tecnico, pick(ESPECIALIDADES[esp]), `Servicio de ${esp.toLowerCase()} (demostración)`,
         estatus, monto, 17.958 + rand() * 0.04, -102.225 + rand() * 0.045,
         `${pick(COLONIAS)}, Lázaro Cárdenas, Mich.`, creado]
      );
      servicios++;

      if (estatus === 'Completado') {
        const pagado = new Date(Math.min(creado.getTime() + between(1, 6) * 36e5, now - 6e4));
        await client.query(
          `INSERT INTO pagos (id_servicio, monto, estado, fecha_pago) VALUES ($1, $2, 'Confirmado', $3)`,
          [rows[0].id_servicio, monto, pagado]
        );
        pagos++;
      }
    }
  }

  return { tecnicos: TECNICOS.length + TECNICOS_PENDIENTES.length, clientes: clientes.length, servicios, pagos };
}

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const borrados = await clean(client);
    if (process.argv.includes('--clean')) {
      await client.query('COMMIT');
      console.log(`Datos de demostración eliminados (${borrados} usuarios demo y todo lo relacionado).`);
      return;
    }
    const r = await seedData(client);
    await client.query('COMMIT');
    console.log(`Datos de demostración cargados: ${r.tecnicos} técnicos, ${r.clientes} clientes, ${r.servicios} servicios, ${r.pagos} pagos.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
