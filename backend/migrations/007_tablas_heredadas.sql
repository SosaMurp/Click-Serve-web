-- Bases que ya traían tablas del panel anterior: los "CREATE TABLE IF NOT EXISTS" de 001/002 no las
-- reemplazaron y quedaron con otras columnas. El síntoma era un 500 en /api/admin/dashboard/stats
-- ("no existe la columna fecha") y que el cobro al confirmar un servicio fallara al registrar el pago.
-- En una base nueva esta migración no cambia nada.

-- pagos: la tabla anterior (id_servicio, fecha_pago) se conserva como pagos_legacy y se crea la de la app.
DO $$
BEGIN
    IF to_regclass('public.pagos') IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'pagos' AND column_name = 'id_solicitud'
    ) THEN
        IF to_regclass('public.pagos_legacy') IS NOT NULL THEN
            RAISE EXCEPTION 'Existe pagos_legacy y pagos sin id_solicitud: revisa la base a mano antes de migrar.';
        END IF;
        ALTER TABLE pagos RENAME TO pagos_legacy;
        IF to_regclass('public.pagos_id_pago_seq') IS NOT NULL THEN
            ALTER SEQUENCE pagos_id_pago_seq RENAME TO pagos_legacy_id_pago_seq;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagos_pkey') THEN
            ALTER TABLE pagos_legacy RENAME CONSTRAINT pagos_pkey TO pagos_legacy_pkey;
        END IF;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS pagos (
    id_pago BIGSERIAL PRIMARY KEY,
    id_solicitud BIGINT NOT NULL UNIQUE REFERENCES solicitudes_servicio(id_solicitud) ON DELETE CASCADE,
    id_cliente INTEGER NOT NULL REFERENCES usuarios(id_usuario),
    id_metodo INTEGER,
    monto NUMERIC(19, 4) NOT NULL,
    moneda VARCHAR(3) NOT NULL DEFAULT 'MXN',
    estado VARCHAR(12) NOT NULL CHECK (estado IN ('PAGADO', 'FALLIDO', 'REEMBOLSADO')),
    modo VARCHAR(10) NOT NULL CHECK (modo IN ('CONEKTA', 'SANDBOX')),
    referencia VARCHAR(80),
    desglose JSONB NOT NULL DEFAULT '{}'::jsonb,
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS monto_reembolsado NUMERIC(19, 4) NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS pagos_estado_fecha_idx ON pagos (estado, fecha DESC);

-- direcciones: la tabla anterior usaba numero_exterior / numero_interior / codigo_postal y exigía estado.
-- Se agregan las columnas que usa la app y se relajan las obligatorias que la app no llena.
ALTER TABLE direcciones ADD COLUMN IF NOT EXISTS etiqueta VARCHAR(50);
ALTER TABLE direcciones ADD COLUMN IF NOT EXISTS numero VARCHAR(50);
ALTER TABLE direcciones ADD COLUMN IF NOT EXISTS interior VARCHAR(50);
ALTER TABLE direcciones ADD COLUMN IF NOT EXISTS cp VARCHAR(10);
DO $$
DECLARE col TEXT;
BEGIN
    FOREACH col IN ARRAY ARRAY['numero_exterior', 'codigo_postal', 'estado', 'ciudad', 'calle'] LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'direcciones' AND column_name = col AND is_nullable = 'NO'
        ) THEN
            EXECUTE format('ALTER TABLE direcciones ALTER COLUMN %I DROP NOT NULL', col);
        END IF;
    END LOOP;
END $$;
