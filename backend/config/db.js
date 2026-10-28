const { Pool } = require('pg');
require('dotenv').config();

// Configuración de la Base de Datos PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

pool.connect(async (err, client, release) => {
  if (err) {
    return console.error('Error conectando a PostgreSQL:', err.stack);
  }
  console.log('¡Conectado exitosamente a PostgreSQL local (config/db.js)!');
  
  try {
    // 1. Tabla de sesiones activas
    await client.query(`
      CREATE TABLE IF NOT EXISTS sesiones_activas (
          id_sesion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          id_usuario INT REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
          id_rol INT,
          dispositivo VARCHAR(255),
          fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          estado VARCHAR(20) DEFAULT 'activa'
      );
    `);
    await client.query(`ALTER TABLE sesiones_activas ADD COLUMN IF NOT EXISTS id_rol INT;`);

    // 2. Tabla expedientes_tecnicos
    await client.query(`
      CREATE TABLE IF NOT EXISTS expedientes_tecnicos (
          id_expediente SERIAL PRIMARY KEY,
          id_usuario INT REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
          especialidad VARCHAR(100),
          estatus VARCHAR(50) DEFAULT 'En Revisión',
          fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          fecha_resolucion TIMESTAMP,
          motivo_rechazo TEXT,
          documentos JSONB DEFAULT '[]'::jsonb,
          metricas JSONB DEFAULT '{"calificacion": 5.0, "trabajos": 0, "efectividad": 100}'::jsonb
      );
    `);

    // 3. Tabla solicitudes_retiro
    await client.query(`
      CREATE TABLE IF NOT EXISTS solicitudes_retiro (
          id_retiro SERIAL PRIMARY KEY,
          id_usuario INT REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
          monto NUMERIC(10,2) NOT NULL,
          clabe VARCHAR(18) NOT NULL,
          banco VARCHAR(100),
          estado VARCHAR(50) DEFAULT 'Pendiente',
          folio_trx VARCHAR(100),
          fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          fecha_procesado TIMESTAMP,
          motivo_rechazo TEXT
      );
    `);

    // 4. Tabla disputas
    await client.query(`
      CREATE TABLE IF NOT EXISTS disputas (
          id_disputa SERIAL PRIMARY KEY,
          folio_servicio VARCHAR(50),
          id_cliente INT REFERENCES Usuarios(id_usuario),
          id_tecnico INT REFERENCES Usuarios(id_usuario),
          categoria VARCHAR(100),
          prioridad VARCHAR(20) DEFAULT 'Media',
          estado VARCHAR(50) DEFAULT 'Abierta',
          monto_reembolso NUMERIC(10,2) DEFAULT 0,
          monto_multa NUMERIC(10,2) DEFAULT 0,
          observaciones TEXT,
          fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          fecha_resolucion TIMESTAMP
      );
    `);

    // 5. Tabla configuracion_plataforma
    await client.query(`
      CREATE TABLE IF NOT EXISTS configuracion_plataforma (
          id INT PRIMARY KEY DEFAULT 1,
          comision_porcentaje NUMERIC(5,2) DEFAULT 15.00,
          monto_minimo_retiro NUMERIC(10,2) DEFAULT 100.00,
          radio_maximo_km INT DEFAULT 25,
          tolerancia_minutos INT DEFAULT 15,
          sensibilidad_ia VARCHAR(20) DEFAULT 'Media',
          modo_mantenimiento BOOLEAN DEFAULT FALSE,
          mensaje_mantenimiento TEXT DEFAULT 'El sistema se encuentra en mantenimiento programado.',
          actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insertar registro por defecto en configuracion_plataforma si no existe
    await client.query(`
      INSERT INTO configuracion_plataforma (id)
      VALUES (1)
      ON CONFLICT (id) DO NOTHING;
    `);

    // 6. Tabla servicios
    await client.query(`
      CREATE TABLE IF NOT EXISTS servicios (
          id_servicio SERIAL PRIMARY KEY,
          id_usuario INT REFERENCES Usuarios(id_usuario),
          id_cliente INT REFERENCES Usuarios(id_usuario),
          id_tecnico INT REFERENCES Usuarios(id_usuario),
          titulo VARCHAR(150),
          descripcion TEXT,
          estatus VARCHAR(50) DEFAULT 'Pendiente',
          monto NUMERIC(12,2) DEFAULT NULL,
          latitud NUMERIC(10, 7) DEFAULT NULL,
          longitud NUMERIC(10, 7) DEFAULT NULL,
          direccion TEXT DEFAULT NULL,
          fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
          fecha_actualizacion TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`ALTER TABLE servicios ADD COLUMN IF NOT EXISTS id_usuario INT REFERENCES Usuarios(id_usuario);`);
    await client.query(`ALTER TABLE servicios ADD COLUMN IF NOT EXISTS id_cliente INT REFERENCES Usuarios(id_usuario);`);
    await client.query(`ALTER TABLE servicios ADD COLUMN IF NOT EXISTS id_tecnico INT REFERENCES Usuarios(id_usuario);`);
    await client.query(`ALTER TABLE servicios ADD COLUMN IF NOT EXISTS monto NUMERIC(12,2) DEFAULT NULL;`);
    await client.query(`ALTER TABLE servicios ADD COLUMN IF NOT EXISTS latitud NUMERIC(10, 7) DEFAULT NULL;`);
    await client.query(`ALTER TABLE servicios ADD COLUMN IF NOT EXISTS longitud NUMERIC(10, 7) DEFAULT NULL;`);
    await client.query(`ALTER TABLE servicios ADD COLUMN IF NOT EXISTS direccion TEXT DEFAULT NULL;`);
    await client.query(`ALTER TABLE servicios ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMPTZ DEFAULT NOW();`);

    // 7. Tabla pagos
    await client.query(`
      CREATE TABLE IF NOT EXISTS pagos (
          id_pago SERIAL PRIMARY KEY,
          id_servicio INT REFERENCES servicios(id_servicio),
          monto NUMERIC(12, 2) NOT NULL,
          estado VARCHAR(50) DEFAULT 'Confirmado',
          fecha_pago TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('Tablas del sistema administrativo verificadas y listas.');
  } catch (tableErr) {
    console.error('Error creando/actualizando tablas de la BD:', tableErr.stack);
  } finally {
    release();
  }
});

module.exports = pool;
