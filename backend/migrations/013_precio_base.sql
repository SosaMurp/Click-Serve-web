-- Click & Serve: precio base por servicio, pagado en custodia al aceptar (anti-evasión).
-- Click & Serve fija un rango por categoría (precio_min – precio_max, IVA incluido) y un precio sugerido
-- (tarifa_base). Cada técnico fija su precio base dentro del rango para cada especialidad. Al aceptar una
-- solicitud se congela ese precio en la orden y el cliente lo paga en custodia antes de ver el chat y de
-- que el técnico vea la dirección. Lo adicional se cotiza dentro de la app y se paga como diferencia.

ALTER TABLE categorias_servicio ADD COLUMN IF NOT EXISTS precio_min NUMERIC(10, 2);
ALTER TABLE categorias_servicio ADD COLUMN IF NOT EXISTS precio_max NUMERIC(10, 2);

UPDATE categorias_servicio c SET precio_min = v.min, precio_max = v.max,
       tarifa_base = CASE WHEN COALESCE(c.tarifa_base, 0) > 0 THEN c.tarifa_base ELSE v.sug END
FROM (VALUES
    ('COMPUTO', 150, 600, 250),
    ('ELECTRICIDAD', 200, 800, 300),
    ('PLOMERIA', 200, 800, 300),
    ('CLIMATIZACION', 300, 1200, 450),
    ('LINEA_BLANCA', 250, 1000, 400),
    ('CERRAJERIA', 200, 800, 300),
    ('PINTURA', 300, 1500, 500),
    ('MECANICA', 250, 1200, 400)
) AS v(codigo, min, max, sug)
WHERE c.codigo = v.codigo AND (c.precio_min IS NULL OR c.precio_max IS NULL);

-- Categorías nuevas sin rango: uno genérico para que nunca falte precio.
UPDATE categorias_servicio SET precio_min = 150 WHERE precio_min IS NULL;
UPDATE categorias_servicio SET precio_max = GREATEST(precio_min * 4, 800) WHERE precio_max IS NULL;
UPDATE categorias_servicio SET tarifa_base = precio_min WHERE COALESCE(tarifa_base, 0) <= 0;

ALTER TABLE especialidades_tecnico ADD COLUMN IF NOT EXISTS precio_base NUMERIC(10, 2);
ALTER TABLE solicitudes_servicio ADD COLUMN IF NOT EXISTS precio_base NUMERIC(10, 2);
