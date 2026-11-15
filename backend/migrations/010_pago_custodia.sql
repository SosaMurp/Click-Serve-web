-- Click & Serve: pago en custodia (escrow de plataforma) y dirección oculta hasta pagar.
-- El cliente aprueba la cotización pagándola: el cargo queda RETENIDO en Click & Serve y la dirección exacta
-- se libera al técnico. Al confirmar el trabajo la custodia pasa a LIBERADO y el neto llega a la billetera del
-- técnico. Si la orden se cancela o se reasigna, la custodia queda en REEMBOLSO_PENDIENTE para soporte.

INSERT INTO estados_pago (codigo, descripcion) VALUES
    ('EN_CUSTODIA', 'Pagado por el cliente y retenido por Click & Serve hasta confirmar el trabajo'),
    ('REEMBOLSO_PENDIENTE', 'Hay un cargo en custodia por devolver al cliente')
ON CONFLICT (codigo) DO NOTHING;

ALTER TABLE solicitudes_servicio ADD COLUMN IF NOT EXISTS direccion_liberada BOOLEAN NOT NULL DEFAULT false;

-- Las órdenes que ya tenían técnico antes de este cambio conservan la dirección visible.
UPDATE solicitudes_servicio SET direccion_liberada = true
WHERE id_tecnico IS NOT NULL AND estado <> 'PENDIENTE' AND direccion_liberada = false;

CREATE TABLE IF NOT EXISTS custodias (
    id_custodia BIGSERIAL PRIMARY KEY,
    id_solicitud BIGINT NOT NULL REFERENCES solicitudes_servicio(id_solicitud) ON DELETE CASCADE,
    id_cliente INTEGER NOT NULL REFERENCES usuarios(id_usuario),
    id_metodo INTEGER,
    monto NUMERIC(19, 4) NOT NULL CHECK (monto > 0),
    modo VARCHAR(10) NOT NULL CHECK (modo IN ('CONEKTA', 'SANDBOX')),
    referencia VARCHAR(80),
    estado VARCHAR(20) NOT NULL CHECK (estado IN ('RETENIDO', 'LIBERADO', 'REEMBOLSO_PENDIENTE', 'REEMBOLSADO')),
    referencia_reembolso VARCHAR(80),
    fecha_cobro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_cierre TIMESTAMPTZ
);

-- A lo más una custodia retenida por orden.
CREATE UNIQUE INDEX IF NOT EXISTS custodias_retenida_unica ON custodias (id_solicitud) WHERE estado = 'RETENIDO';
CREATE INDEX IF NOT EXISTS custodias_estado_idx ON custodias (estado, fecha_cobro);
