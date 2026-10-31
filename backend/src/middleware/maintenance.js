const { fail } = require('../lib/http');
const { getConfig } = require('../services/config');

// RNF-42 / RF-99: con MAINTENANCE=1 o con el modo mantenimiento activado desde el panel, la API responde 503
// y la app muestra la pantalla de mantenimiento. Las rutas del administrador siguen abiertas para poder apagarlo.
async function maintenance(req, res, next) {
  if (!req.path.startsWith('/api') || req.path.startsWith('/api/admin/')) return next();
  let activo = process.env.MAINTENANCE === '1';
  let mensaje = 'Click & Serve está en mantenimiento. Vuelve a intentarlo en unos minutos.';
  if (!activo) {
    const config = await getConfig();
    activo = config.modo_mantenimiento === true;
    if (activo && config.mensaje_mantenimiento) mensaje = config.mensaje_mantenimiento;
  }
  if (activo) {
    res.set('Retry-After', '600');
    return fail(res, 503, 'MAINTENANCE', mensaje);
  }
  return next();
}

module.exports = { maintenance };
