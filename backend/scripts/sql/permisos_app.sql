-- Hace al usuario de la app dueño de los objetos del esquema public, para que pueda leer, escribir
-- y aplicar migraciones (ALTER TABLE solo lo puede hacer el dueño). Se ejecuta como superusuario:
--
--   sudo -u postgres psql -d clickserve_unificado -v app_user=admin_pro -f permisos_app.sql
--
-- No borra ni modifica datos: solo cambia dueños y permisos. Se puede ejecutar varias veces.
\set ON_ERROR_STOP on

BEGIN;

SELECT format('GRANT CONNECT, TEMPORARY ON DATABASE %I TO %I', current_database(), :'app_user') \gexec
SELECT format('ALTER SCHEMA public OWNER TO %I', :'app_user') \gexec

-- Tablas (también cambia el dueño de las secuencias de sus columnas serial/identity)
SELECT format('ALTER TABLE public.%I OWNER TO %I', c.relname, :'app_user')
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e') \gexec

-- Vistas y vistas materializadas
SELECT format('ALTER %s public.%I OWNER TO %I', CASE c.relkind WHEN 'm' THEN 'MATERIALIZED VIEW' ELSE 'VIEW' END, c.relname, :'app_user')
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
  AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e') \gexec

-- Secuencias sueltas (las ligadas a una columna ya cambiaron con su tabla)
SELECT format('ALTER SEQUENCE public.%I OWNER TO %I', c.relname, :'app_user')
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'S'
  AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype IN ('a', 'i', 'e')) \gexec

-- Funciones propias (p. ej. cs_liquidacion), sin tocar las que pertenecen a extensiones
SELECT format('ALTER ROUTINE %s OWNER TO %I', p.oid::regprocedure, :'app_user')
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e') \gexec

-- Tipos propios (enums y dominios), si los hay
SELECT format('ALTER TYPE public.%I OWNER TO %I', t.typname, :'app_user')
FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' AND t.typtype IN ('e', 'd')
  AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = t.oid AND d.deptype = 'e') \gexec

COMMIT;

-- Comprobación: cuántas tablas puede leer y escribir el usuario de la app
SELECT :'app_user' AS usuario,
       count(*) AS tablas,
       count(*) FILTER (WHERE has_table_privilege(:'app_user', format('public.%I', tablename), 'SELECT,INSERT,UPDATE,DELETE')) AS con_acceso_completo
FROM pg_tables WHERE schemaname = 'public';
