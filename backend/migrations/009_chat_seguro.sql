-- Click & Serve: chat seguro. Antes de escribir en un chat (de servicio o directo), cada participante acepta las
-- reglas de su rol (cliente: pérdida de garantía; técnico: políticas y suspensión). Se guarda por chat y versión.

CREATE TABLE IF NOT EXISTS aceptaciones_chat (
    id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    tipo_chat VARCHAR(10) NOT NULL CHECK (tipo_chat IN ('SOLICITUD', 'DIRECTO')),
    id_chat BIGINT NOT NULL,
    version VARCHAR(20) NOT NULL,
    fecha_aceptacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id_usuario, tipo_chat, id_chat, version)
);
