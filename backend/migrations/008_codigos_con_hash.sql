-- Los códigos de un solo uso (registro, recuperación, acceso al panel) se guardan como HMAC-SHA256 en hex
-- (64 caracteres) en lugar del código en claro: quien lea la base ya no puede usarlos.
ALTER TABLE tokens_temporales ALTER COLUMN token TYPE VARCHAR(64);

-- Los códigos vigentes guardados en claro dejan de servir; basta con pedir uno nuevo.
UPDATE tokens_temporales SET estado_uso = 'expirado'
WHERE estado_uso IN ('sin usar', 'verificado') AND length(token) < 64;
