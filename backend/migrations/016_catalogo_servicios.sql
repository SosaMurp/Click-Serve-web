-- Click & Serve: catálogo de servicios con precio base por servicio (anti-evasión).
-- Cada categoría tiene servicios concretos (Plomería → Destapar drenaje, Reparar fuga, Instalar calentador…)
-- con un rango (IVA incluido) y un precio sugerido que administra Click & Serve desde el panel. El técnico fija
-- su precio por servicio dentro del rango (como mucho un cambio por semana por servicio). El cliente elige el
-- servicio al pedir; si no sabe qué tiene, elige la visita de diagnóstico (precio fijo) y lo demás se cotiza en
-- la app como adicional.

CREATE TABLE IF NOT EXISTS servicios_catalogo (
    id_servicio SERIAL PRIMARY KEY,
    categoria VARCHAR(30) NOT NULL REFERENCES categorias_servicio(codigo) ON UPDATE CASCADE,
    nombre VARCHAR(80) NOT NULL,
    descripcion VARCHAR(200),
    precio_min NUMERIC(10, 2) NOT NULL CHECK (precio_min > 0),
    precio_max NUMERIC(10, 2) NOT NULL,
    precio_sugerido NUMERIC(10, 2) NOT NULL,
    es_diagnostico BOOLEAN NOT NULL DEFAULT false,
    activo BOOLEAN NOT NULL DEFAULT true,
    orden SMALLINT NOT NULL DEFAULT 100,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT servicios_rango_ck CHECK (precio_min <= precio_sugerido AND precio_sugerido <= precio_max),
    CONSTRAINT servicios_categoria_nombre_uq UNIQUE (categoria, nombre)
);
CREATE INDEX IF NOT EXISTS servicios_catalogo_categoria_idx ON servicios_catalogo (categoria, activo, orden);

CREATE TABLE IF NOT EXISTS precios_tecnico (
    id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_servicio INTEGER NOT NULL REFERENCES servicios_catalogo(id_servicio) ON DELETE CASCADE,
    precio NUMERIC(10, 2) NOT NULL CHECK (precio > 0),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id_usuario, id_servicio)
);

ALTER TABLE solicitudes_servicio ADD COLUMN IF NOT EXISTS id_servicio INTEGER REFERENCES servicios_catalogo(id_servicio);

-- Catálogo inicial (el administrador lo ajusta desde el panel). La visita de diagnóstico tiene precio fijo.
INSERT INTO servicios_catalogo (categoria, nombre, descripcion, precio_min, precio_max, precio_sugerido, es_diagnostico, orden)
SELECT v.categoria, v.nombre, v.descripcion, v.min, v.max, v.sug, v.diag, v.orden
FROM (VALUES
    ('COMPUTO', 'Visita de diagnóstico', 'Revisión del equipo cuando no sabes qué falla', 250, 250, 250, true, 1),
    ('COMPUTO', 'Formateo e instalación de sistema', 'Respaldo básico, sistema operativo y controladores', 300, 700, 450, false, 2),
    ('COMPUTO', 'Limpieza y mantenimiento', 'Limpieza interna, pasta térmica y revisión general', 250, 600, 350, false, 3),
    ('COMPUTO', 'Configuración de red o WiFi', 'Módem, repetidores y equipos conectados', 300, 800, 450, false, 4),
    ('COMPUTO', 'Eliminación de virus', 'Limpieza de malware y antivirus', 250, 600, 350, false, 5),
    ('ELECTRICIDAD', 'Visita de diagnóstico', 'Revisión de la instalación cuando no sabes qué falla', 250, 250, 250, true, 1),
    ('ELECTRICIDAD', 'Cambio de contacto o apagador', 'Por pieza, material aparte', 200, 500, 300, false, 2),
    ('ELECTRICIDAD', 'Instalación de lámpara', 'Lámpara, plafón o ventilador de techo', 250, 700, 400, false, 3),
    ('ELECTRICIDAD', 'Reparar cortocircuito', 'Localizar y reparar la falla', 350, 1200, 600, false, 4),
    ('ELECTRICIDAD', 'Instalar centro de carga', 'Centro de carga con pastillas', 800, 2500, 1400, false, 5),
    ('PLOMERIA', 'Visita de diagnóstico', 'Revisión cuando no sabes qué falla', 250, 250, 250, true, 1),
    ('PLOMERIA', 'Destapar drenaje', 'Lavabo, fregadero, regadera o WC', 200, 500, 300, false, 2),
    ('PLOMERIA', 'Cambiar llave o mezcladora', 'Mano de obra; la pieza se cotiza aparte', 250, 600, 350, false, 3),
    ('PLOMERIA', 'Reparar fuga', 'Fuga visible en tubería o conexión', 250, 800, 400, false, 4),
    ('PLOMERIA', 'Instalar calentador', 'Boiler de paso o de depósito', 800, 2000, 1200, false, 5),
    ('CLIMATIZACION', 'Visita de diagnóstico', 'Revisión del equipo cuando no sabes qué falla', 300, 300, 300, true, 1),
    ('CLIMATIZACION', 'Mantenimiento de minisplit', 'Limpieza de evaporador y condensador', 450, 1000, 650, false, 2),
    ('CLIMATIZACION', 'Recarga de gas', 'Revisión de fugas y recarga', 600, 1500, 900, false, 3),
    ('CLIMATIZACION', 'Instalación de minisplit', 'Equipo del cliente, instalación estándar', 1500, 4000, 2500, false, 4),
    ('LINEA_BLANCA', 'Visita de diagnóstico', 'Revisión del aparato cuando no sabes qué falla', 300, 300, 300, true, 1),
    ('LINEA_BLANCA', 'Reparar lavadora', 'Mano de obra; refacciones aparte', 400, 1200, 700, false, 2),
    ('LINEA_BLANCA', 'Reparar refrigerador', 'Mano de obra; refacciones aparte', 450, 1500, 800, false, 3),
    ('LINEA_BLANCA', 'Reparar estufa', 'Quemadores, encendido y fugas de gas', 300, 900, 500, false, 4),
    ('CERRAJERIA', 'Visita de diagnóstico', 'Revisión de chapa o puerta', 250, 250, 250, true, 1),
    ('CERRAJERIA', 'Apertura de puerta', 'Puerta de casa, sin daño cuando es posible', 300, 800, 450, false, 2),
    ('CERRAJERIA', 'Cambio de chapa', 'Mano de obra; la chapa se cotiza aparte', 300, 900, 500, false, 3),
    ('CERRAJERIA', 'Instalar cerrojo', 'Cerrojo o pasador adicional', 250, 700, 400, false, 4),
    ('PINTURA', 'Visita de presupuesto', 'Medición y presupuesto del trabajo', 300, 300, 300, true, 1),
    ('PINTURA', 'Retoques y resanes', 'Resanes y pintura en áreas pequeñas', 300, 1000, 500, false, 2),
    ('PINTURA', 'Pintar habitación', 'Habitación estándar, pintura aparte', 800, 2500, 1500, false, 3),
    ('PINTURA', 'Impermeabilizar azotea', 'Hasta 30 m², material aparte', 1500, 6000, 3000, false, 4),
    ('MECANICA', 'Visita de diagnóstico', 'Revisión del vehículo en tu domicilio', 350, 350, 350, true, 1),
    ('MECANICA', 'Paso de corriente o cambio de batería', 'La batería se cotiza aparte', 250, 700, 350, false, 2),
    ('MECANICA', 'Cambio de aceite', 'Mano de obra; aceite y filtro aparte', 400, 1000, 600, false, 3),
    ('MECANICA', 'Cambio de balatas', 'Por eje, balatas aparte', 500, 1500, 900, false, 4)
) AS v(categoria, nombre, descripcion, min, max, sug, diag, orden)
WHERE EXISTS (SELECT 1 FROM categorias_servicio c WHERE c.codigo = v.categoria)
ON CONFLICT (categoria, nombre) DO NOTHING;
