const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const adminUserRoutes = require('./routes/adminUserRoutes');
const adminFinanceRoutes = require('./routes/adminFinanceRoutes');
const adminSettingsRoutes = require('./routes/adminSettingsRoutes');
const serviciosRoutes     = require('./routes/serviciosRoutes');
const dashboardRoutes     = require('./routes/dashboardRoutes');

const app = express();

// Deshabilitar huella digital de Express para seguridad (CWE-200)
app.disable('x-powered-by');

// Cabeceras de seguridad HTTP
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Configuración de middlewares globales
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true,
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Idempotency-Key',
    'X-Client-Timestamp'
  ],
  exposedHeaders: ['X-Request-Id']
}));
app.use(express.json({ limit: '10mb' }));

// Ruta de estado general del backend
app.get('/', (req, res) => {
  res.send('Servidor Backend de Click & Serve funcionando 🚀');
});

// Montaje de los módulos de rutas
app.use('/api', authRoutes);
app.use('/api/admin', adminUserRoutes);
app.use('/api/admin', adminFinanceRoutes);
app.use('/api', adminSettingsRoutes);
app.use('/api/servicios', serviciosRoutes);
app.use('/admin/dashboard', dashboardRoutes);
app.use('/api/admin/dashboard', dashboardRoutes);

// Manejador de rutas no encontradas (404)
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada en el servidor Backend.' });
});

// Encender el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor Click & Serve corriendo exitosamente en el puerto ${PORT}`);
});