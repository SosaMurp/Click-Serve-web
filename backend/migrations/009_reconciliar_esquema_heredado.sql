-- Segunda parte de la reconciliación con tablas del panel anterior (ver 007). En bases que ya traían
-- esas tablas, la app no podía crear solicitudes (columnas obligatorias que la app no llena) ni usar la
-- verificación biométrica (otra tabla con id entero). En una base nueva esta migración no cambia nada.

-- solicitudes_servicio: columnas del esquema anterior que eran obligatorias y la app no usa.
DO $$
DECLARE col TEXT;
BEGIN
    FOREACH col IN ARRAY ARRAY['titulo', 'id_cliente', 'id_direccion', 'categoria'] LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'solicitudes_servicio' AND column_name = col
              AND is_nullable = 'NO' AND column_default IS NULL
        ) THEN
            EXECUTE format('ALTER TABLE solicitudes_servicio ALTER COLUMN %I DROP NOT NULL', col);
        END IF;
    END LOOP;

    -- Fechas sin zona horaria: se interpretan en la zona de la sesión, la misma con la que NOW() las escribió.
    FOREACH col IN ARRAY ARRAY['fecha_creacion', 'fecha_finalizacion'] LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'solicitudes_servicio' AND column_name = col
              AND data_type = 'timestamp without time zone'
        ) THEN
            EXECUTE format('ALTER TABLE solicitudes_servicio ALTER COLUMN %I TYPE TIMESTAMPTZ', col);
        END IF;
    END LOOP;
END $$;

-- verificaciones_biometricas: la tabla anterior (id entero, score, detalles) se conserva como *_legacy.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'verificaciones_biometricas'
          AND column_name = 'id_verificacion' AND data_type <> 'uuid'
    ) THEN
        IF to_regclass('public.verificaciones_biometricas_legacy') IS NOT NULL THEN
            RAISE EXCEPTION 'Existe verificaciones_biometricas_legacy: revisa la base a mano antes de migrar.';
        END IF;
        ALTER TABLE verificaciones_biometricas RENAME TO verificaciones_biometricas_legacy;
        IF to_regclass('public.verificaciones_biometricas_id_verificacion_seq') IS NOT NULL THEN
            ALTER SEQUENCE verificaciones_biometricas_id_verificacion_seq RENAME TO verificaciones_biometricas_legacy_id_seq;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'verificaciones_biometricas_pkey') THEN
            ALTER TABLE verificaciones_biometricas_legacy RENAME CONSTRAINT verificaciones_biometricas_pkey TO verificaciones_biometricas_legacy_pkey;
        END IF;
        IF to_regclass('public.verificaciones_usuario_estado_idx') IS NOT NULL THEN
            ALTER INDEX verificaciones_usuario_estado_idx RENAME TO verificaciones_legacy_usuario_estado_idx;
        END IF;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS verificaciones_biometricas (
    id_verificacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    desafio VARCHAR(128) NOT NULL UNIQUE,
    proveedor VARCHAR(40) NOT NULL DEFAULT 'opencv',
    estado VARCHAR(30) NOT NULL DEFAULT 'solicitada',
    resultado JSONB,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_expiracion TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
    fecha_resolucion TIMESTAMPTZ,
    CONSTRAINT verificaciones_estado_ck CHECK (estado IN ('solicitada', 'procesando', 'APROBADO', 'RECHAZADO', 'expirada'))
);
CREATE INDEX IF NOT EXISTS verificaciones_usuario_estado_idx ON verificaciones_biometricas (id_usuario, estado);
