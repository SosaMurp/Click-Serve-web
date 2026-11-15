-- Click & Serve: motivo del rechazo de un adicional.
-- Cuando el cliente rechaza la cotización adicional dice por qué (precio alto, no lo quiere u otro motivo con
-- comentario). El técnico ve el motivo y puede enviar otra cotización.
ALTER TABLE cotizaciones_servicio ADD COLUMN IF NOT EXISTS motivo_rechazo VARCHAR(20);
ALTER TABLE cotizaciones_servicio ADD COLUMN IF NOT EXISTS comentario_rechazo VARCHAR(300);
ALTER TABLE cotizaciones_servicio DROP CONSTRAINT IF EXISTS cotizaciones_motivo_rechazo_ck;
ALTER TABLE cotizaciones_servicio ADD CONSTRAINT cotizaciones_motivo_rechazo_ck
    CHECK (motivo_rechazo IS NULL OR motivo_rechazo IN ('PRECIO_ALTO', 'NO_LO_DESEA', 'OTRO'));
