-- Click & Serve: liquidación de conflictos desde el panel (RF-82, RF-83).
-- El administrador define cuánto se devuelve al cliente y la multa operativa al técnico; el sistema
-- registra el movimiento contable y ajusta la billetera del técnico.

-- La billetera registra también cargos del administrador (concepto MULTA o REEMBOLSO).
DO $$
DECLARE c text;
BEGIN
    FOR c IN SELECT conname FROM pg_constraint
             WHERE conrelid = 'transacciones'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%tipo%'
    LOOP
        EXECUTE format('ALTER TABLE transacciones DROP CONSTRAINT %I', c);
    END LOOP;
END $$;
ALTER TABLE transacciones ADD CONSTRAINT transacciones_tipo_check CHECK (tipo IN ('INGRESO', 'RETIRO', 'AJUSTE'));

-- Lo devuelto al cliente sobre el cobro original (parcial o total).
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS monto_reembolsado NUMERIC(19, 4) NOT NULL DEFAULT 0;

-- Qué se decidió en cada caso. Una incidencia se liquida una sola vez.
ALTER TABLE incidencias ADD COLUMN IF NOT EXISTS monto_reembolso NUMERIC(19, 4);
ALTER TABLE incidencias ADD COLUMN IF NOT EXISTS multa NUMERIC(19, 4);
ALTER TABLE incidencias ADD COLUMN IF NOT EXISTS reembolso_a_cargo_tecnico BOOLEAN;
ALTER TABLE incidencias ADD COLUMN IF NOT EXISTS fecha_liquidacion TIMESTAMPTZ;

-- Multa operativa estándar que el panel sugiere al liquidar (ej. $100.00 por violación de T&C).
ALTER TABLE configuracion_plataforma ADD COLUMN IF NOT EXISTS multa_operativa NUMERIC(10, 2) NOT NULL DEFAULT 100.00;

-- ───────────────────────── Comunicados del administrador (RF-116, RF-117) ─────────────────────────
-- Mensajes personalizados que el administrador envía a un cliente o técnico por APP PUSH o EMAIL.
CREATE TABLE IF NOT EXISTS comunicados_admin (
    id_comunicado BIGSERIAL PRIMARY KEY,
    id_admin INT NOT NULL REFERENCES usuarios(id_usuario),
    id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    canal VARCHAR(5) NOT NULL CHECK (canal IN ('PUSH', 'EMAIL')),
    asunto VARCHAR(80) NOT NULL,
    mensaje VARCHAR(500) NOT NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS comunicados_admin_usuario_idx ON comunicados_admin (id_usuario, fecha DESC);
