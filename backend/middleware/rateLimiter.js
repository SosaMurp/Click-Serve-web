/**
 * Middleware de Rate Limiting en memoria para protección contra ataques de fuerza bruta y DoS
 */

class MemoryRateLimiter {
  constructor(windowMs, maxRequests, message) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.message = message;
    this.hits = new Map();

    // Limpieza periódica cada 5 minutos
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
  }

  cleanup() {
    const now = Date.now();
    for (const [key, data] of this.hits.entries()) {
      if (now > data.resetTime) {
        this.hits.delete(key);
      }
    }
  }

  getMiddleware(keyGenerator) {
    return (req, res, next) => {
      const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
      const key = keyGenerator ? keyGenerator(req, ip) : ip;
      const now = Date.now();

      const record = this.hits.get(key) || { count: 0, resetTime: now + this.windowMs };

      if (now > record.resetTime) {
        record.count = 1;
        record.resetTime = now + this.windowMs;
      } else {
        record.count += 1;
      }

      this.hits.set(key, record);

      const remaining = Math.max(0, this.maxRequests - record.count);
      const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetSeconds);

      if (record.count > this.maxRequests) {
        return res.status(429).json({
          error: this.message || 'Demasiadas solicitudes. Por favor, inténtalo más tarde.',
          retryAfter: resetSeconds
        });
      }

      next();
    };
  }
}

// 1. Límite para intentos de Login (10 intentos por cada 15 min)
const loginLimiter = new MemoryRateLimiter(
  15 * 60 * 1000, 
  10, 
  'Demasiados intentos de inicio de sesión. Por seguridad, tu acceso ha sido pausado temporalmente por 15 minutos.'
).getMiddleware((req, ip) => {
  const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : '';
  return `login:${ip}:${email}`;
});

// 2. Límite para verificación de códigos OTP (5 intentos por cada 15 min por email/IP para evitar fuerza bruta)
const otpLimiter = new MemoryRateLimiter(
  15 * 60 * 1000, 
  5, 
  'Demasiados intentos de verificación de código de seguridad. Intenta nuevamente más tarde.'
).getMiddleware((req, ip) => {
  const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : '';
  return `otp:${ip}:${email}`;
});

// 3. Límite para solicitudes de recuperación y reenvío de códigos (5 solicitudes por cada 15 min)
const recoveryLimiter = new MemoryRateLimiter(
  15 * 60 * 1000, 
  5, 
  'Has excedido el número máximo de solicitudes de código. Por favor espera antes de intentar de nuevo.'
).getMiddleware((req, ip) => {
  const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : '';
  return `recovery:${ip}:${email}`;
});

module.exports = {
  loginLimiter,
  otpLimiter,
  recoveryLimiter
};

