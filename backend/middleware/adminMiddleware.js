const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Acceso denegado. Usuario no autenticado.' });
  }

  // Rol 3 es Administrador en Click & Serve
  if (req.user.id_rol !== 3) {
    return res.status(403).json({ error: 'Acceso denegado. Privilegios de Administrador requeridos.' });
  }

  next();
};

module.exports = adminMiddleware;

