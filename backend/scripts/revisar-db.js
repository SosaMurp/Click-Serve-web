// Revisión de solo lectura de la base configurada en backend/.env: `npm run db:revisar`.
//
// - Versión del servidor, migraciones aplicadas y tablas con su número de filas.
// - Si hay una base de referencia (REF_DB_*: una base con el esquema de la app, p. ej. clickyserve_test
//   después de correr las pruebas), lista las diferencias que romperían la app:
//   columnas faltantes, columnas obligatorias que la app no llena y tipos distintos.
//
// La conexión se abre con default_transaction_read_only: PostgreSQL rechaza cualquier escritura.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const { Client } = require('pg');

const env = process.env;
const conf = (p) => ({
  host: env[`${p}DB_HOST`],
  port: env[`${p}DB_PORT`] ? Number(env[`${p}DB_PORT`]) : undefined,
  user: env[`${p}DB_USER`],
  password: env[`${p}DB_PASSWORD`] || undefined,
  database: env[`${p}DB_NAME`],
  options: '-c default_transaction_read_only=on',
  connectionTimeoutMillis: 10_000,
});

const COLS = `SELECT table_name t, column_name c, is_nullable n, column_default d, data_type ty
              FROM information_schema.columns WHERE table_schema = 'public'`;

async function main() {
  const db = new Client(conf(''));
  await db.connect();
  const out = {};
  // Una tabla sin permiso de lectura no detiene la revisión: se anota y se sigue.
  const intentar = async (fn) => {
    try { return await fn(); } catch (error) { return `sin acceso (${error.code === '42501' ? 'permiso denegado' : error.message})`; }
  };
  out.servidor = (await db.query('SELECT version() v, current_database() db, current_user u')).rows[0];
  const tieneMigraciones = (await db.query("SELECT to_regclass('public.schema_migraciones') t")).rows[0].t;
  out.migraciones = tieneMigraciones
    ? await intentar(async () => (await db.query('SELECT id FROM schema_migraciones ORDER BY id')).rows.map((r) => r.id))
    : 'sin tabla schema_migraciones';

  const tablas = (await db.query(
    `SELECT tablename, tableowner, has_table_privilege(current_user, format('public.%I', tablename), 'SELECT') AS lectura,
            has_table_privilege(current_user, format('public.%I', tablename), 'INSERT,UPDATE,DELETE') AS escritura
     FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`
  )).rows;
  out.tablas = {};
  for (const t of tablas) {
    out.tablas[t.tablename] = t.lectura ? Number((await db.query(`SELECT COUNT(*) n FROM "${t.tablename}"`)).rows[0].n) : 'sin permiso de lectura';
  }
  out.duenos = [...new Set(tablas.map((t) => t.tableowner))];
  out.permisos_de_mi_usuario = {
    sin_lectura: tablas.filter((t) => !t.lectura).map((t) => t.tablename),
    sin_escritura: tablas.filter((t) => !t.escritura).map((t) => t.tablename),
    puede_crear_tablas: (await db.query("SELECT has_schema_privilege(current_user, 'public', 'CREATE') c")).rows[0].c,
    es_superusuario: (await db.query('SELECT rolsuper s FROM pg_roles WHERE rolname = current_user')).rows[0].s,
  };

  if (env.REF_DB_NAME) {
    const ref = new Client(conf('REF_'));
    await ref.connect();
    const L = (await db.query(COLS)).rows;
    const R = (await ref.query(COLS)).rows;
    const key = (r) => `${r.t}.${r.c}`;
    const RM = new Map(R.map((r) => [key(r), r]));
    const LM = new Set(L.map(key));
    const RT = new Set(R.map((r) => r.t));
    const LT = new Set(L.map((r) => r.t));
    out.diferencias = {
      tablas_que_faltan: [...RT].filter((t) => !LT.has(t)),
      columnas_que_faltan: R.filter((r) => LT.has(r.t) && !LM.has(key(r))).map(key),
      obligatorias_que_la_app_no_llena: L.filter((r) => RT.has(r.t) && !RM.has(key(r)) && r.n === 'NO' && !r.d).map(key),
      tipos_distintos: L.filter((r) => RM.has(key(r)) && RM.get(key(r)).ty !== r.ty).map((r) => `${key(r)}: ${r.ty} (app: ${RM.get(key(r)).ty})`),
      tablas_que_la_app_no_usa: [...LT].filter((t) => !RT.has(t)),
    };
    await ref.end();
  }

  await db.end();
  console.log(JSON.stringify(out, null, 2));
}

main().catch((error) => {
  console.error(`No se pudo revisar la base: ${error.message}`);
  if (error.code === 'ECONNREFUSED') console.error('¿Está abierto el túnel? (npm run tunel en otra terminal)');
  process.exit(1);
});
