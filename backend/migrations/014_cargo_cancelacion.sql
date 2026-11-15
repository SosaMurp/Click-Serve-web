-- Click & Serve: cargo por visita al cancelar sin motivo y vencimiento del pago del precio base.
-- Si el cliente cancela cuando el técnico ya salió (en camino a tiempo, en el domicilio o con un adicional),
-- se le retiene un cargo por visita de lo que tiene en custodia: el técnico recibe ese cargo (menos la comisión)
-- y el resto se devuelve. La custodia guarda el cargo y su monto queda en lo que se reembolsa.

ALTER TABLE custodias ADD COLUMN IF NOT EXISTS cargo_cancelacion NUMERIC(19, 4);
ALTER TABLE solicitudes_servicio ADD COLUMN IF NOT EXISTS cargo_cancelacion NUMERIC(10, 2);
