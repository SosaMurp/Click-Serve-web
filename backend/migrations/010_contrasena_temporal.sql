-- Contraseña temporal de los coadministradores: se genera al darlos de alta y se envía por correo.
--   debe_cambiar_contrasena     → hasta que la persona defina la suya, la sesión solo puede cambiar la contraseña.
--   contrasena_temporal_expira  → mientras tenga fecha, la contraseña temporal sirve para el primer acceso;
--                                 al completarlo (con el código del correo) se borra y ya no se puede reutilizar.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS debe_cambiar_contrasena BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS contrasena_temporal_expira TIMESTAMPTZ;
