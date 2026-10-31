-- Click & Serve: datos que el panel de administrador comparte con la app.
-- Antes el panel usaba tablas propias (expedientes_tecnicos, solicitudes_retiro, disputas) que la app nunca llenaba.
-- Desde aquí el panel trabaja sobre las mismas tablas que la app y esta lee la configuración que el panel guarda.

-- ───────────────────────── Configuración de la plataforma (RF-97, RF-99) ─────────────────────────
-- Una sola fila (id = 1). Los valores iniciales son los que la app usaba fijos en el código.
CREATE TABLE IF NOT EXISTS configuracion_plataforma (
    id INT PRIMARY KEY DEFAULT 1,
    comision_porcentaje NUMERIC(5,2) DEFAULT 10.00,
    monto_minimo_retiro NUMERIC(10,2) DEFAULT 100.00,
    radio_maximo_km INT DEFAULT 25,
    tolerancia_minutos INT DEFAULT 10,
    sensibilidad_ia VARCHAR(20) DEFAULT 'Media',
    modo_mantenimiento BOOLEAN DEFAULT FALSE,
    mensaje_mantenimiento TEXT DEFAULT 'El sistema se encuentra en mantenimiento programado.',
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO configuracion_plataforma (id, comision_porcentaje, monto_minimo_retiro, radio_maximo_km, tolerancia_minutos)
VALUES (1, 10.00, 100.00, 25, 10)
ON CONFLICT (id) DO NOTHING;

-- La comisión deja de estar fija en 10 %: se lee de la configuración (STABLE porque consulta una tabla).
CREATE OR REPLACE FUNCTION cs_liquidacion(p_total NUMERIC)
RETURNS TABLE (total NUMERIC, comision NUMERIC, base NUMERIC, retencion_isr NUMERIC, retencion_iva NUMERIC, neto_tecnico NUMERIC)
LANGUAGE sql STABLE AS $$
    WITH c AS (
        SELECT COALESCE((SELECT comision_porcentaje FROM configuracion_plataforma WHERE id = 1), 10.00) / 100 AS pct
    ), v AS (SELECT ROUND(p_total, 2) AS t, ROUND(ROUND(p_total, 2) / 1.16, 2) AS b, c.pct FROM c)
    SELECT t, ROUND(t * pct, 2), b, ROUND(b * 0.021, 2), ROUND(b * 0.08, 2),
           t - ROUND(t * pct, 2) - ROUND(b * 0.021, 2) - ROUND(b * 0.08, 2)
    FROM v
$$;

-- ───────────────────────── Revisión de técnicos (RF-29, RF-41) ─────────────────────────
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fecha_revision TIMESTAMPTZ;

-- ───────────────────────── Atención de incidencias por el administrador (RF-114, RF-118) ─────────────────────────
ALTER TABLE incidencias ADD COLUMN IF NOT EXISTS notas_admin TEXT;
ALTER TABLE incidencias ADD COLUMN IF NOT EXISTS id_admin INT REFERENCES usuarios(id_usuario);

-- ───────────────────────── Retiros revisados por tesorería (RF-77, RF-78) ─────────────────────────
ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT;
ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS fecha_procesado TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS transacciones_retiros_idx ON transacciones (tipo, estado, fecha DESC);
