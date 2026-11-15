-- Click & Serve: asignación automática por proximidad, en cascada.
-- En modo AUTOMATICA la solicitud se propone al técnico disponible más cercano dentro del radio; si no acepta en el
-- tiempo de tolerancia (o la descarta), pasa al siguiente. intentos_asignacion guarda a quién ya se le propuso.

ALTER TABLE solicitudes_servicio ADD COLUMN IF NOT EXISTS modo_asignacion VARCHAR(12) NOT NULL DEFAULT 'MANUAL';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'solicitudes_modo_asignacion_ck') THEN
        ALTER TABLE solicitudes_servicio
            ADD CONSTRAINT solicitudes_modo_asignacion_ck CHECK (modo_asignacion IN ('MANUAL', 'AUTOMATICA'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS intentos_asignacion (
    id_solicitud BIGINT NOT NULL REFERENCES solicitudes_servicio(id_solicitud) ON DELETE CASCADE,
    id_tecnico INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    distancia_km NUMERIC(8, 1),
    resultado VARCHAR(12) NOT NULL DEFAULT 'PROPUESTA' CHECK (resultado IN ('PROPUESTA', 'VENCIDA', 'DESCARTADA')),
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id_solicitud, id_tecnico)
);

CREATE INDEX IF NOT EXISTS solicitudes_asignacion_pendiente_idx
    ON solicitudes_servicio (propuesto_hasta) WHERE estado = 'PENDIENTE' AND modo_asignacion = 'AUTOMATICA';
