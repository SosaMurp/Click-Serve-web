// Copia a la base de DESTINO los usuarios de ORIGEN cuyo correo no existe en destino (los que ya existen
// se dejan tal cual). Todo en una transacción: si algo falla, el destino no cambia.
//
//   node scripts/copiar-usuarios.js <archivo .env de origen> <archivo .env de destino> [--aplicar]
//
// Sin --aplicar solo muestra lo que haría (y deshace la transacción al final).
// - Se copian las columnas que existen en ambas tablas.
// - El id se conserva si está libre en destino; si lo ocupa otra persona, el destino asigna uno nuevo.
// - No se copian sesiones, códigos temporales ni datos relacionados.
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { Client } = require('pg');

const [origenFile, destinoFile] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const aplicar = process.argv.includes('--aplicar');
if (!origenFile || !destinoFile) {
  console.error('Uso: node scripts/copiar-usuarios.js <.env origen> <.env destino> [--aplicar]');
  process.exit(1);
}
const leer = (f) => dotenv.parse(fs.readFileSync(path.resolve(f)));
const cliente = (e, soloLectura) => new Client({
  host: e.DB_HOST, port: Number(e.DB_PORT), user: e.DB_USER, password: e.DB_PASSWORD || undefined, database: e.DB_NAME,
  ...(soloLectura ? { options: '-c default_transaction_read_only=on' } : {}),
});

async function columnas(db) {
  const { rows } = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'usuarios' AND is_generated = 'NEVER'`
  );
  return rows.map((r) => r.column_name);
}

async function main() {
  const origen = cliente(leer(origenFile), true);
  const destino = cliente(leer(destinoFile), false);
  await origen.connect();
  await destino.connect();

  const comunes = (await columnas(origen)).filter(Set.prototype.has, new Set(await columnas(destino)));
  const sinId = comunes.filter((c) => c !== 'id_usuario');
  const enDestino = await destino.query('SELECT id_usuario, lower(correo) correo FROM usuarios');
  const correos = new Set(enDestino.rows.map((r) => r.correo));
  const ids = new Set(enDestino.rows.map((r) => r.id_usuario));

  const lista = comunes.map((c) => `"${c}"`).join(', ');
  const nuevos = (await origen.query(`SELECT ${lista} FROM usuarios ORDER BY id_usuario`)).rows
    .filter((u) => !correos.has(String(u.correo).toLowerCase()));

  const resumen = { copiados_con_mismo_id: 0, copiados_con_id_nuevo: [], omitidos_por_correo_existente: enDestino.rowCount };
  await destino.query('BEGIN');
  try {
    for (const u of nuevos) {
      const conservarId = !ids.has(u.id_usuario);
      const cols = conservarId ? comunes : sinId;
      const { rows } = await destino.query(
        `INSERT INTO usuarios (${cols.map((c) => `"${c}"`).join(', ')})
         VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id_usuario`,
        cols.map((c) => u[c])
      );
      if (conservarId) resumen.copiados_con_mismo_id += 1;
      else resumen.copiados_con_id_nuevo.push({ correo: u.correo, id_origen: u.id_usuario, id_destino: rows[0].id_usuario });
    }
    // La secuencia sigue después del id más alto para que los registros nuevos no choquen.
    await destino.query(
      `SELECT setval(pg_get_serial_sequence('usuarios', 'id_usuario'), (SELECT MAX(id_usuario) FROM usuarios))`
    );
    resumen.total_en_destino = Number((await destino.query('SELECT count(*) n FROM usuarios')).rows[0].n);
    await destino.query(aplicar ? 'COMMIT' : 'ROLLBACK');
  } catch (error) {
    await destino.query('ROLLBACK');
    throw error;
  }

  console.log(JSON.stringify({ modo: aplicar ? 'APLICADO' : 'ENSAYO (sin cambios)', columnas_copiadas: comunes.length, a_copiar: nuevos.length, ...resumen }, null, 2));
  await origen.end();
  await destino.end();
}

main().catch((error) => {
  console.error(`No se copió nada: ${error.message}${error.detail ? ` (${error.detail})` : ''}`);
  process.exit(1);
});
