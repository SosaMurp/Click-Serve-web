-- Click & Serve: pasarela de pagos Stripe.
-- Las tarjetas se guardan con Setup Intents (Stripe Checkout en modo "setup"): Click & Serve solo guarda el
-- PaymentMethod (pm_...), el Customer de Stripe (cus_...), la marca y los últimos 4 dígitos. Los cobros son
-- PaymentIntents fuera de sesión y los reembolsos de custodia se hacen con la API de Refunds.

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(40);
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_stripe_customer_uq ON usuarios (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

ALTER TABLE metodos_pago ADD COLUMN IF NOT EXISTS proveedor VARCHAR(10);
ALTER TABLE metodos_pago ADD COLUMN IF NOT EXISTS cliente_externo VARCHAR(40);
-- La misma tarjeta (PaymentMethod) no se guarda dos veces: el retorno de Checkout y el webhook pueden llegar ambos.
CREATE UNIQUE INDEX IF NOT EXISTS metodos_pago_stripe_uq ON metodos_pago (id_usuario, token) WHERE proveedor = 'STRIPE';

ALTER TABLE custodias DROP CONSTRAINT IF EXISTS custodias_modo_check;
ALTER TABLE custodias ADD CONSTRAINT custodias_modo_check CHECK (modo IN ('CONEKTA', 'SANDBOX', 'STRIPE'));
ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_modo_check;
ALTER TABLE pagos ADD CONSTRAINT pagos_modo_check CHECK (modo IN ('CONEKTA', 'SANDBOX', 'STRIPE'));
