-- Click & Serve: escala progresiva de sanciones por intentos de sacar el trato de la app (desintermediación).
-- infracciones: cada intento detectado (mensaje bloqueado por el chat seguro, cancelar tras compartir contacto,
-- o lo que registre un administrador). sanciones: lo que se aplicó por cada nivel de la escala.
--   Nivel 1: advertencia (el mensaje ya se bloqueó).  Nivel 2: suspensión de 24 h.
--   Nivel 3: suspensión de 7 días + baja prioridad en la asignación.  Nivel 4: baneo definitivo.

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS suspendido_hasta TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS prioridad_baja_hasta TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS baneado BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS infracciones (
    id_infraccion BIGSERIAL PRIMARY KEY,
    id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    tipo VARCHAR(40) NOT NULL,
    id_solicitud BIGINT REFERENCES solicitudes_servicio(id_solicitud) ON DELETE SET NULL,
    id_conversacion BIGINT REFERENCES conversaciones_directas(id_conversacion) ON DELETE SET NULL,
    detalle JSONB,
    -- Nivel que detonó; NULL si se contó como parte del mismo intento (ráfaga de mensajes en pocos minutos).
    nivel_resultante SMALLINT CHECK (nivel_resultante BETWEEN 1 AND 4),
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS infracciones_usuario_fecha_idx ON infracciones (id_usuario, fecha DESC);

CREATE TABLE IF NOT EXISTS sanciones (
    id_sancion BIGSERIAL PRIMARY KEY,
    id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    nivel SMALLINT NOT NULL CHECK (nivel BETWEEN 1 AND 4),
    motivo TEXT NOT NULL,
    inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- NULL = permanente (nivel 4); en la advertencia (nivel 1) es igual al inicio.
    fin TIMESTAMPTZ,
    aplicada_por VARCHAR(10) NOT NULL DEFAULT 'SISTEMA' CHECK (aplicada_por IN ('SISTEMA', 'ADMIN')),
    id_admin INTEGER REFERENCES usuarios(id_usuario),
    id_infraccion BIGINT REFERENCES infracciones(id_infraccion) ON DELETE SET NULL,
    levantada BOOLEAN NOT NULL DEFAULT false,
    fecha_levantada TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS sanciones_usuario_idx ON sanciones (id_usuario, inicio DESC);
