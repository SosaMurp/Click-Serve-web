const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { maintenance } = require('./middleware/maintenance');
const { errorHandler, notFound } = require('./lib/http');
const { isDevelopment } = require('./lib/env');

function securityHeaders(_req, res, next) {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('X-Frame-Options', 'DENY');
  res.set('Cross-Origin-Resource-Policy', 'same-site');
  // Fuera de desarrollo el servidor se publica con HTTPS: el navegador no debe volver a intentar HTTP.
  if (!isDevelopment()) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}

// CORS_ORIGINS (lista separada por comas) limita qué páginas web pueden llamar a la API desde el navegador.
// La app móvil no usa CORS. Sin la variable se acepta cualquier origen, como hasta ahora (útil en desarrollo).
function corsOptions() {
  const allowed = String(process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    exposedHeaders: ['Idempotent-Replay', 'Retry-After'],
    origin: allowed.length ? (origin, cb) => cb(null, !origin || allowed.includes(origin)) : true,
  };
}

// Cuerpos JSON de hasta 1 MB. Solo el registro acepta más: la app anterior enviaba ahí las fotos como data URI.
const LARGE_BODY_PATHS = new Set(['/api/register']);
const jsonSmall = express.json({ limit: '1mb' });
const jsonLarge = express.json({ limit: '25mb' });
const formSmall = express.urlencoded({ extended: true, limit: '1mb' });
const formLarge = express.urlencoded({ extended: true, limit: '25mb' });
const bodyParsers = (req, res, next) => {
  const large = LARGE_BODY_PATHS.has(req.path);
  (large ? jsonLarge : jsonSmall)(req, res, (err) => {
    if (err) return next(err);
    return (large ? formLarge : formSmall)(req, res, next);
  });
};

// Construye la app sin escuchar en ningún puerto (las pruebas la levantan en un puerto libre).
function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // req.ip alimenta los límites de intentos. Detrás de un balanceador, TRUST_PROXY indica cuántos saltos
  // (p. ej. 1) o qué subredes son de confianza; sin él solo se confía en un proxy local.
  const trust = process.env.TRUST_PROXY;
  app.set('trust proxy', !trust ? 'loopback' : /^\d+$/.test(trust) ? Number(trust) : trust);
  app.use(compression());
  app.use(cors(corsOptions()));
  // Webhook de Stripe: necesita el cuerpo crudo para verificar la firma, así que va antes del JSON.
  app.post('/api/stripe/webhook', express.raw({ type: '*/*', limit: '1mb' }), require('./routes/stripe').webhook);
  app.use(bodyParsers);
  app.use(securityHeaders);

  app.get('/', (_req, res) => res.send('Servidor Backend de Click & Serve funcionando 🚀'));
  app.get('/api/salud', (_req, res) => res.json({ ok: true, hora: new Date().toISOString() }));
  app.use(maintenance);

  app.use(require('./routes/archivos'));
  app.use(require('./routes/auth'));
  app.use(require('./routes/social'));
  app.use(require('./routes/ine'));
  app.use(require('./routes/cuenta'));
  app.use(require('./routes/solicitudes'));
  app.use(require('./routes/incidencias'));
  app.use(require('./routes/pagos'));
  app.use(require('./routes/stripe'));
  app.use(require('./routes/tecnico'));
  app.use(require('./routes/chatDirecto'));
  app.use(require('./routes/soporte'));
  app.use(require('./routes/direcciones'));
  app.use(require('./routes/biometria'));
  app.use(require('./routes/admin'));
  app.use(require('./routes/panel'));
  app.use(require('./routes/reportes'));
  app.use(require('./routes/liquidaciones'));
  app.use(require('./routes/custodias'));
  app.use(require('./routes/sanciones'));
  app.use(require('./routes/catalogo'));
  app.use(require('./routes/comunicados'));

  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
