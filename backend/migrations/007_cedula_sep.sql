-- Click & Serve: validación de cédula profesional en segundo plano (SEP).
-- estado_cedula guarda el resultado de la última consulta; folio_profesional es el identificador especial
-- que se asigna al técnico cuando la cédula coincide con su nombre, existe y no está dada de baja.
ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS estado_cedula VARCHAR(20),
    ADD COLUMN IF NOT EXISTS folio_profesional VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_folio_profesional_key ON usuarios (folio_profesional) WHERE folio_profesional IS NOT NULL;
