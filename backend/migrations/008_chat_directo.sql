-- Click & Serve: mensajes directos cliente → técnico, sin necesidad de una solicitud (búsqueda de técnicos).
-- Una conversación por par cliente-técnico. Los mensajes del servicio siguen en mensajes_chat.

CREATE TABLE IF NOT EXISTS conversaciones_directas (
    id_conversacion BIGSERIAL PRIMARY KEY,
    id_cliente INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_tecnico INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT conversaciones_directas_par_key UNIQUE (id_cliente, id_tecnico),
    CONSTRAINT conversaciones_directas_distintos_ck CHECK (id_cliente <> id_tecnico)
);

CREATE TABLE IF NOT EXISTS mensajes_directos (
    id BIGSERIAL PRIMARY KEY,
    id_conversacion BIGINT NOT NULL REFERENCES conversaciones_directas(id_conversacion) ON DELETE CASCADE,
    id_emisor INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    mensaje TEXT,
    id_archivo BIGINT REFERENCES archivos(id_archivo) ON DELETE SET NULL,
    fecha_envio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT mensajes_directos_contenido_ck CHECK (mensaje IS NOT NULL OR id_archivo IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS mensajes_directos_conv_fecha_idx ON mensajes_directos (id_conversacion, fecha_envio);
