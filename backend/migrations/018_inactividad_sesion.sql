-- RNF-04: las sesiones de la app (cliente y técnico) se cierran tras 3 minutos sin actividad.
-- ultima_actividad se actualiza con cada petición de la persona (no con el latido automático del técnico).
ALTER TABLE sesiones_activas ADD COLUMN IF NOT EXISTS ultima_actividad TIMESTAMPTZ NOT NULL DEFAULT NOW();
