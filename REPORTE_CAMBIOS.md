# Reporte de cambios — 5 nov 2026

Auditoría del backend y del panel web, corrección de errores y conexión del backend a la base de datos en OVH.

## 1. Error del tablero (500 en `/api/admin/dashboard/stats`)
- **Causa:** la base tenía tablas heredadas del panel anterior (`pagos`, `direcciones`, `solicitudes_servicio`, `verificaciones_biometricas`) con columnas distintas. Las migraciones usan `CREATE TABLE IF NOT EXISTS` y no las reemplazaron.
- **Efecto:** fallaban el tablero, el cobro al confirmar servicios, la creación de solicitudes desde la app y la biometría.
- **Arreglo:** migraciones `007_tablas_heredadas` y `009_reconciliar_esquema_heredado`. Las tablas viejas se conservan como `*_legacy`, sin pérdida de datos; en una base nueva no hacen nada.
- El panel dejaba de repetir la consulta mientras falla (antes fueron 192 errores) y distingue "sin conexión" de "error del servidor".

## 2. Panel web
| Antes | Ahora |
|---|---|
| Recuperación de contraseña pedía 4 dígitos (el backend envía 6): nunca funcionaba | 6 dígitos, misma regla de contraseña que el backend; el código no se pierde si la contraseña es rechazada |
| Detalle de servicio con fotos, tareas y botones inventados | Datos reales (tareas, evidencias, calificaciones, pago, incidencias); única acción: cancelar sin cargo |
| Modal de "cambiar estado" con 4 opciones (3 siempre fallaban) | Modal de cancelación sin cargo |
| Cualquier 403 cerraba la sesión | Solo el 401 la cierra; el 403 se muestra como error |
| Logout solo local | Revoca la sesión en el servidor y limpia la caché |
| Sin cierre por inactividad | Cierra tras `VITE_SESSION_TIMEOUT` minutos |
| Token duplicado en `localStorage` | Una copia en `sessionStorage` |
| "Técnico aprobado" antes de la respuesta del servidor | Espera la respuesta y muestra el error si falla |
| 17 `alert()` | Avisos integrados (toasts) |
| Modales sin accesibilidad | `role="dialog"`, foco atrapado, Escape para cerrar |
| Bundle único de 1.1 MB | Carga por página: ~156 KB gzip iniciales |

- **Otros:** CSV sin inyección de fórmulas, mensaje claro cuando el backend está apagado (502/504), color de éxito sin definir corregido.
- **Eliminado:** página de Biometría, `LocationSelector`, `RescheduleModal`, `UpdateServiceStatusModal`, `sanitizer.ts`, assets sin uso y `puppeteer`.
- **Fuera de git** (siguen en disco): `.agents/`, `db_carpeta_provicional/`, `test-error.cjs` y `test-screenshot.png`.

## 3. Backend
- Durante el mantenimiento, el admin puede iniciar sesión en el panel para apagarlo.
- Códigos de un solo uso guardados como HMAC (migración `008_codigos_con_hash`).
- Los técnicos en revisión no ven solicitudes pendientes ajenas, ni en el detalle ni en la lista.
- `GET /api/admin/solicitudes/:id` devuelve el expediente completo del servicio.
- JSON limitado a 1 MB (25 MB solo en `/api/register`).
- CORS configurable con `CORS_ORIGINS`.
- HSTS fuera de desarrollo.
- Apagado ordenado (SIGTERM/SIGINT).
- El segundo paso del login del admin vuelve a revisar si la cuenta está suspendida.
- Dependencias: 0 vulnerabilidades en web y backend (`nodemailer` 10, `sharp` 0.35, `uuid` 11 forzado).
- Pruebas: **190/190**, con pruebas nuevas para lo anterior.

## 4. Conexión con OVH
- Servidor `148.113.238.36`, base `clickserve_unificado`, acceso por túnel SSH.
- **Scripts nuevos:**
  - `npm run tunel`: abre el túnel `127.0.0.1:15432` → servidor:5432; lee los datos de `.env`.
  - `npm run db:revisar`: revisión de solo lectura y comparación con el esquema de la app.
  - `scripts/copiar-usuarios.js`: copia usuarios de una base a otra (sin `--aplicar` solo simula).
  - `scripts/sql/permisos_app.sql`: hace dueño de los objetos al usuario de la app.
- `DB_AUTO_MIGRATE=false` evita que el arranque modifique la base.
- **Trabajo hecho en el servidor:**
  1. Se dio la propiedad de las 49 tablas a `admin_pro`; antes no tenía acceso.
  2. Respaldo completo previo en `backend/respaldos/` (no se sube a git).
  3. Ensayo completo en una copia local antes de tocar el servidor.
  4. Migraciones 005–009 aplicadas.
  5. Se copiaron 24 usuarios locales que no existían; los 16 repetidos se conservaron como estaban en OVH. Total: 42.
- **Resultado:** la base de OVH coincide con el esquema de la app (11 migraciones, sin diferencias).
- La configuración local anterior quedó en `backend/.env.local-db`, fuera de git.

## Para trabajar en local
En terminales separadas: `npm run tunel` (en `backend`), `npm run dev` o `npm start` (en `backend`) y `npm run dev` (en la raíz).

## Pendiente
- Decidir si se publica la web y el backend en OVH; así ya no haría falta el túnel.
- Cambiar la contraseña de `admin_pro` (6 caracteres).
- Borrar `/tmp/permisos_app.sql` en el servidor.
- Decidir qué hacer con la base `clickyserve_db` que también está en OVH.
- Pagos reales con Conekta (`customer` y `payment_source`, webhook) y conciliación de pagos en `PROCESANDO`.
- Límites de intentos compartidos si se usan varias instancias.
- Rol de superadmin.
- ESLint, pruebas y CI para la web.
