const { fail } = require('../lib/http');
const { getConfig } = require('../services/config');

// RNF-42 / RF-99: con MAINTENANCE=1 o con el modo mantenimiento activado desde el panel, la API responde 503
// y la app muestra la pantalla de mantenimiento. Las rutas del administrador (incluido su inicio de sesión)
// siguen abiertas para poder apagarlo aunque la sesión del panel haya vencido durante el mantenimiento.
const ADMIN_OPEN = ['/api/login-admin', '/api/verify-login-admin', '/api/logout'];

async function maintenance(req, res, next) {
  if (!req.path.startsWith('/api') || req.path.startsWith('/api/admin/') || ADMIN_OPEN.some((p) => req.path === p || req.path.startsWith(`${p}/`))) {
    return next();
  }
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
