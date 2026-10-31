const { getPool } = require('../db/pool');

// Configuración que el administrador ajusta desde el panel (RF-97, RF-99).
// Se guarda en configuracion_plataforma (una fila) y se lee con un caché corto para no consultar en cada petición.
const DEFAULTS = Object.freeze({
  comision_porcentaje: '10.00',
  monto_minimo_retiro: '100.00',
  radio_maximo_km: 25,
  tolerancia_minutos: 10,
  sensibilidad_ia: 'Media',
  modo_mantenimiento: false,
  mensaje_mantenimiento: 'El sistema se encuentra en mantenimiento programado.',
});

const TTL_MS = 10_000;
let cached = null;
let cachedAt = 0;

async function getConfig(db = getPool()) {
  if (cached && Date.now() - cachedAt < TTL_MS) return cached;
  try {
    const { rows } = await db.query('SELECT * FROM configuracion_plataforma WHERE id = 1');
    cached = { ...DEFAULTS, ...(rows[0] || {}) };
  } catch (error) {
    // Sin la tabla (base sin migrar) se usan los valores de siempre.
    console.error('No se pudo leer la configuración de la plataforma:', error.message);
    cached = { ...DEFAULTS };
  }
  cachedAt = Date.now();
  return cached;
}

function invalidateConfig() {
  cached = null;
  cachedAt = 0;
}

module.exports = { getConfig, invalidateConfig, DEFAULTS };
