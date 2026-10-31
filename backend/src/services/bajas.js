const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { getPool, withTransaction } = require('../db/pool');

// Baja de cuentas (RF-16): la usa la persona desde la app y el administrador desde el panel.
// Anonimiza los datos personales y conserva los registros financieros sin identidad (LFPDPPP).
const ACTIVE_STATES = ['ASIGNADA', 'EN_CAMINO', 'EN_SITIO', 'ESPERANDO_APROBACION', 'EN_PROCESO', 'POR_CONFIRMAR', 'SUSPENDIDA'];

// Devuelve { code, message } si la cuenta no se puede dar de baja todavía; null si sí.
async function deletionBlocker(idUsuario, db = getPool()) {
  const activos = await db.query(
    'SELECT COUNT(*)::int AS n FROM solicitudes_servicio WHERE (id_usuario = $1 OR id_tecnico = $1) AND estado = ANY($2)',
    [idUsuario, ACTIVE_STATES]
  );
  if (activos.rows[0].n > 0) {
    return { code: 'ACTIVE_SERVICES', message: 'Tiene servicios en curso. Hay que terminarlos o cancelarlos antes de eliminar la cuenta.' };
  }
  const saldo = await db.query('SELECT saldo_actual FROM billetera_tecnico WHERE id_usuario = $1 AND saldo_actual > 0', [idUsuario]);
  if (saldo.rowCount > 0) {
    return { code: 'BALANCE_PENDING', message: 'Aún tiene saldo en su billetera. Debe retirarlo antes de eliminar la cuenta.' };
  }
  return null;
}

async function anonymizeUser(idUsuario) {
  await withTransaction(async (db) => {
    await db.query(
      `UPDATE usuarios SET nombre = 'Usuario', apellido = 'eliminado', correo = $2, telefono = NULL,
         fecha_nacimiento = NULL, contrasena = $3, foto_archivo = NULL, foto_perfil = NULL, totp_secreto = NULL,
         totp_pendiente = NULL, "2FA_Activo" = false, preferencias = '{}'::jsonb, push_token = NULL,
         latitud = NULL, longitud = NULL, ine_frente = NULL, ine_reverso = NULL, foto_rostro = NULL,
         url_ine_front = NULL, url_ine_rev = NULL, referencia_facial = NULL, bio = NULL, disponible = false,
         estado_cuenta = 'Eliminado', anonimizado = true, version_sesion = COALESCE(version_sesion, 1) + 1
       WHERE id_usuario = $1`,
      [idUsuario, `eliminado+${idUsuario}.${crypto.randomUUID().slice(0, 8)}@clickserve.invalid`, await bcrypt.hash(crypto.randomUUID(), 4)]
    );
    await db.query("UPDATE sesiones_activas SET estado = 'revocada' WHERE id_usuario = $1", [idUsuario]);
    await db.query('DELETE FROM direcciones WHERE id_usuario = $1', [idUsuario]);
    await db.query('DELETE FROM metodos_pago WHERE id_usuario = $1', [idUsuario]);
    await db.query('DELETE FROM documentos_usuario WHERE id_usuario = $1', [idUsuario]);
    await db.query('DELETE FROM portafolio_tecnico WHERE id_usuario = $1', [idUsuario]);
    await db.query("DELETE FROM archivos WHERE id_propietario = $1 AND categoria IN ('AVATAR', 'INE', 'ROSTRO', 'DOCUMENTO', 'PORTAFOLIO')", [idUsuario]);
  });
}

module.exports = { ACTIVE_STATES, deletionBlocker, anonymizeUser };
