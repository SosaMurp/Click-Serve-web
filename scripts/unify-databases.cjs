const fs = require('fs');
const path = require('path');

const apSqlPath = 'c:/Users/Zequi/click-serve-admin-web/db_carpeta_provicional/ApSql';
const ap2SqlPath = 'c:/Users/Zequi/click-serve-admin-web/db_carpeta_provicional/ap2sq.sql';
const outputPath = 'c:/Users/Zequi/click-serve-admin-web/db_carpeta_provicional/clickserve_unificado.sql';

const apSql = fs.readFileSync(apSqlPath, 'utf8');
const ap2Sql = fs.readFileSync(ap2SqlPath, 'utf8');

console.log('Unifying databases...');

// Let's create the unified SQL
// We will build it section by section:
// 1. Header & Extensions
// 2. Lookup & Pre-data Tables (from ApSql)
// 3. Sequences (ApSql + ap2sq missing sequences)
// 4. Tables (ApSql enhanced + ap2sq missing tables)
// 5. Sequence ownership & defaults
// 6. Data (ApSql data + ap2sq data + merged usuarios)
// 7. Constraints (PKs, FKs, Checks, Uniques)
// 8. Indexes
// 9. Functions & Triggers
// 10. Sequence setval

let out = [];

out.push(`-- =============================================================================`);
out.push(`-- CLICK & SERVE - BASE DE DATOS UNIFICADA`);
out.push(`-- Generada a partir de ApSql (Base Principal) y ap2sq.sql (Módulos & Datos)`);
out.push(`-- Fecha de unificación: ${new Date().toISOString()}`);
out.push(`-- =============================================================================\n`);

out.push(`SET statement_timeout = 0;`);
out.push(`SET lock_timeout = 0;`);
out.push(`SET idle_in_transaction_session_timeout = 0;`);
out.push(`SET transaction_timeout = 0;`);
out.push(`SET client_encoding = 'UTF8';`);
out.push(`SET standard_conforming_strings = on;`);
out.push(`SELECT pg_catalog.set_config('search_path', '', false);`);
out.push(`SET check_function_bodies = false;`);
out.push(`SET xmloption = content;`);
out.push(`SET client_min_messages = warning;`);
out.push(`SET row_security = off;\n`);

out.push(`-- Extensiones requeridas (UUID, Hashing, Criptografía)`);
out.push(`CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;\n`);

// -----------------------------------------------------------------------------
// SEQUENCES
// -----------------------------------------------------------------------------
out.push(`-- =============================================================================`);
out.push(`-- SECUENCIAS`);
out.push(`-- =============================================================================\n`);

// Collect sequences from ApSql
const seqMatches = apSql.match(/CREATE SEQUENCE public\.[^\s;]+[\s\S]*?;/gi) || [];
const existingSeqNames = new Set();
for (const s of seqMatches) {
  const nameM = s.match(/CREATE SEQUENCE (public\.[^\s;]+)/i);
  if (nameM) existingSeqNames.add(nameM[1]);
  out.push(s);
}

// Missing sequences from ap2sq
const missingSequences = [
  'public.cotizaciones_id_cotizacion_seq',
  'public.disputas_id_disputa_seq',
  'public.expedientes_tecnicos_id_expediente_seq',
  'public.historial_estados_servicio_id_historial_seq',
  'public.resenas_id_resena_seq',
  'public.servicios_id_servicio_seq',
  'public.solicitudes_retiro_id_retiro_seq'
];

for (const ms of missingSequences) {
  if (!existingSeqNames.has(ms)) {
    out.push(`CREATE SEQUENCE ${ms}`);
    out.push(`    AS integer`);
    out.push(`    START WITH 1`);
    out.push(`    INCREMENT BY 1`);
    out.push(`    NO MINVALUE`);
    out.push(`    NO MAXVALUE`);
    out.push(`    CACHE 1;\n`);
    existingSeqNames.add(ms);
  }
}

// -----------------------------------------------------------------------------
// TABLES
// -----------------------------------------------------------------------------
out.push(`-- =============================================================================`);
out.push(`-- TABLAS`);
out.push(`-- =============================================================================\n`);

// Extract all tables from ApSql
const tableRegex = /CREATE TABLE (?:IF NOT EXISTS )?([^\s(]+)\s*\(([\s\S]*?)\);/gi;
let m;
const apSqlTables = {};
while ((m = tableRegex.exec(apSql)) !== null) {
  const name = m[1].replace(/"/g, '');
  apSqlTables[name] = m[0];
}

// Write ApSql tables, enhancing 'direcciones', 'pagos', 'solicitudes_servicio'
for (const [tName, tDef] of Object.entries(apSqlTables)) {
  if (tName === 'public.direcciones') {
    out.push(`-- Tabla: public.direcciones (Unificada)`);
    out.push(`CREATE TABLE public.direcciones (`);
    out.push(`    id_direccion integer NOT NULL,`);
    out.push(`    id_usuario integer NOT NULL,`);
    out.push(`    etiqueta character varying(50),`);
    out.push(`    calle character varying(255) NOT NULL,`);
    out.push(`    numero character varying(50),`);
    out.push(`    numero_exterior character varying(50),`);
    out.push(`    interior character varying(50),`);
    out.push(`    numero_interior character varying(50),`);
    out.push(`    colonia character varying(150),`);
    out.push(`    cp character varying(10),`);
    out.push(`    codigo_postal character varying(10),`);
    out.push(`    ciudad character varying(150) DEFAULT 'Lázaro Cárdenas'::character varying NOT NULL,`);
    out.push(`    estado character varying(150) DEFAULT 'Michoacán'::character varying NOT NULL,`);
    out.push(`    referencias text,`);
    out.push(`    latitud numeric(10,8),`);
    out.push(`    longitud numeric(11,8),`);
    out.push(`    predeterminada boolean DEFAULT false NOT NULL,`);
    out.push(`    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP`);
    out.push(`);\n`);
  } else if (tName === 'public.pagos') {
    out.push(`-- Tabla: public.pagos (Unificada para Web Admin y App Móvil)`);
    out.push(`CREATE TABLE public.pagos (`);
    out.push(`    id_pago bigint NOT NULL,`);
    out.push(`    id_solicitud bigint,`);
    out.push(`    id_servicio integer,`);
    out.push(`    id_cliente integer,`);
    out.push(`    id_metodo integer,`);
    out.push(`    monto numeric(19,4) NOT NULL,`);
    out.push(`    moneda character varying(3) DEFAULT 'MXN'::character varying NOT NULL,`);
    out.push(`    estado character varying(50) DEFAULT 'Confirmado'::character varying NOT NULL,`);
    out.push(`    modo character varying(10) DEFAULT 'SANDBOX'::character varying,`);
    out.push(`    referencia character varying(80),`);
    out.push(`    desglose jsonb DEFAULT '{}'::jsonb NOT NULL,`);
    out.push(`    fecha timestamp with time zone DEFAULT now() NOT NULL,`);
    out.push(`    fecha_pago timestamp with time zone DEFAULT now()`);
    out.push(`);\n`);
  } else if (tName === 'public.solicitudes_servicio') {
    out.push(`-- Tabla: public.solicitudes_servicio (Unificada)`);
    out.push(`CREATE TABLE public.solicitudes_servicio (`);
    out.push(`    id_solicitud bigint NOT NULL,`);
    out.push(`    folio character varying(24) NOT NULL,`);
    out.push(`    id_usuario integer NOT NULL,`);
    out.push(`    id_cliente integer,`);
    out.push(`    id_tecnico integer,`);
    out.push(`    id_direccion integer,`);
    out.push(`    titulo character varying(255),`);
    out.push(`    categoria character varying(100),`);
    out.push(`    descripcion text NOT NULL,`);
    out.push(`    direccion text NOT NULL,`);
    out.push(`    fecha_preferida date,`);
    out.push(`    hora_preferida time without time zone,`);
    out.push(`    estado character varying(50) DEFAULT 'PENDIENTE'::character varying NOT NULL,`);
    out.push(`    estado_actual character varying(50) DEFAULT 'Pendiente'::character varying,`);
    out.push(`    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,`);
    out.push(`    fecha_visita_esperada timestamp without time zone,`);
    out.push(`    calificacion smallint,`);
    out.push(`    comentario_calificacion text,`);
    out.push(`    estado_pago character varying(20) DEFAULT 'PENDIENTE'::character varying,`);
    out.push(`    calificacion_cliente integer,`);
    out.push(`    comentario_cliente text,`);
    out.push(`    evidencia_foto text,`);
    out.push(`    monto_cotizacion numeric(19,4),`);
    out.push(`    detalles_cotizacion text,`);
    out.push(`    id_cotizacion_aceptada integer,`);
    out.push(`    latitud numeric(10,7),`);
    out.push(`    longitud numeric(10,7),`);
    out.push(`    id_tecnico_propuesto integer,`);
    out.push(`    propuesto_hasta timestamp with time zone,`);
    out.push(`    fecha_asignacion timestamp with time zone,`);
    out.push(`    fecha_llegada timestamp with time zone,`);
    out.push(`    fecha_finalizacion timestamp with time zone,`);
    out.push(`    garantia_hasta date,`);
    out.push(`    motivo_cancelacion text,`);
    out.push(`    cancelado_por character varying(10),`);
    out.push(`    monto_total numeric(19,4),`);
    out.push(`    estado_previo character varying(20),`);
    out.push(`    alerta_sos boolean DEFAULT false NOT NULL,`);
    out.push(`    latitud_sos numeric(10,7),`);
    out.push(`    longitud_sos numeric(10,7),`);
    out.push(`    fecha_sos timestamp with time zone,`);
    out.push(`    referencias text`);
    out.push(`);\n`);
  } else {
    out.push(tDef + '\n');
  }
}

// Add the 8 missing tables from ap2sq
out.push(`-- =============================================================================`);
out.push(`-- TABLAS ADICIONALES DE GESTIÓN Y PANEL WEB (provenientes de ap2sq.sql)`);
out.push(`-- =============================================================================\n`);

out.push(`-- Tabla: public.configuracion_plataforma`);
out.push(`CREATE TABLE public.configuracion_plataforma (`);
out.push(`    id integer DEFAULT 1 NOT NULL,`);
out.push(`    comision_porcentaje numeric(5,2) DEFAULT 15.00,`);
out.push(`    monto_minimo_retiro numeric(10,2) DEFAULT 100.00,`);
out.push(`    radio_maximo_km integer DEFAULT 25,`);
out.push(`    tolerancia_minutos integer DEFAULT 15,`);
out.push(`    sensibilidad_ia character varying(20) DEFAULT 'Media'::character varying,`);
out.push(`    modo_mantenimiento boolean DEFAULT false,`);
out.push(`    mensaje_mantenimiento text DEFAULT 'El sistema se encuentra en mantenimiento programado.'::text,`);
out.push(`    actualizado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP`);
out.push(`);\n`);

out.push(`-- Tabla: public.servicios (Servicios del Panel de Administración Web)`);
out.push(`CREATE TABLE public.servicios (`);
out.push(`    id_servicio integer NOT NULL,`);
out.push(`    id_usuario integer,`);
out.push(`    id_cliente integer,`);
out.push(`    id_tecnico integer,`);
out.push(`    titulo character varying(150),`);
out.push(`    descripcion text,`);
out.push(`    estatus character varying(50) DEFAULT 'Pendiente'::character varying,`);
out.push(`    monto numeric(12,2) DEFAULT NULL::numeric,`);
out.push(`    latitud numeric(10,7) DEFAULT NULL::numeric,`);
out.push(`    longitud numeric(10,7) DEFAULT NULL::numeric,`);
out.push(`    direccion text,`);
out.push(`    fecha_creacion timestamp with time zone DEFAULT now(),`);
out.push(`    fecha_actualizacion timestamp with time zone DEFAULT now()`);
out.push(`);\n`);

out.push(`-- Tabla: public.expedientes_tecnicos`);
out.push(`CREATE TABLE public.expedientes_tecnicos (`);
out.push(`    id_expediente integer NOT NULL,`);
out.push(`    id_usuario integer,`);
out.push(`    especialidad character varying(100),`);
out.push(`    estatus character varying(50) DEFAULT 'En Revisión'::character varying,`);
out.push(`    fecha_solicitud timestamp without time zone DEFAULT CURRENT_TIMESTAMP,`);
out.push(`    fecha_resolucion timestamp without time zone,`);
out.push(`    motivo_rechazo text,`);
out.push(`    documentos jsonb DEFAULT '[]'::jsonb,`);
out.push(`    metricas jsonb DEFAULT '{"trabajos": 0, "efectividad": 100, "calificacion": 5.0}'::jsonb`);
out.push(`);\n`);

out.push(`-- Tabla: public.disputas`);
out.push(`CREATE TABLE public.disputas (`);
out.push(`    id_disputa integer NOT NULL,`);
out.push(`    folio_servicio character varying(50),`);
out.push(`    id_cliente integer,`);
out.push(`    id_tecnico integer,`);
out.push(`    categoria character varying(100),`);
out.push(`    prioridad character varying(20) DEFAULT 'Media'::character varying,`);
out.push(`    estado character varying(50) DEFAULT 'Abierta'::character varying,`);
out.push(`    monto_reembolso numeric(10,2) DEFAULT 0,`);
out.push(`    monto_multa numeric(10,2) DEFAULT 0,`);
out.push(`    observaciones text,`);
out.push(`    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,`);
out.push(`    fecha_resolucion timestamp without time zone`);
out.push(`);\n`);

out.push(`-- Tabla: public.solicitudes_retiro`);
out.push(`CREATE TABLE public.solicitudes_retiro (`);
out.push(`    id_retiro integer NOT NULL,`);
out.push(`    id_usuario integer,`);
out.push(`    monto numeric(10,2) NOT NULL,`);
out.push(`    clabe character varying(18) NOT NULL,`);
out.push(`    banco character varying(100),`);
out.push(`    estado character varying(50) DEFAULT 'Pendiente'::character varying,`);
out.push(`    folio_trx character varying(100),`);
out.push(`    fecha_solicitud timestamp without time zone DEFAULT CURRENT_TIMESTAMP,`);
out.push(`    fecha_procesado timestamp without time zone,`);
out.push(`    motivo_rechazo text`);
out.push(`);\n`);

out.push(`-- Tabla: public.cotizaciones`);
out.push(`CREATE TABLE public.cotizaciones (`);
out.push(`    id_cotizacion integer NOT NULL,`);
out.push(`    id_solicitud bigint NOT NULL,`);
out.push(`    id_tecnico integer NOT NULL,`);
out.push(`    monto numeric(10,2) NOT NULL,`);
out.push(`    descripcion_trabajo text NOT NULL,`);
out.push(`    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,`);
out.push(`    estado character varying(50) DEFAULT 'Pendiente'::character varying`);
out.push(`);\n`);

out.push(`-- Tabla: public.historial_estados_servicio`);
out.push(`CREATE TABLE public.historial_estados_servicio (`);
out.push(`    id_historial integer NOT NULL,`);
out.push(`    id_solicitud bigint NOT NULL,`);
out.push(`    estado character varying(50) NOT NULL,`);
out.push(`    comentario text,`);
out.push(`    id_usuario_modificador integer,`);
out.push(`    fecha_cambio timestamp without time zone DEFAULT CURRENT_TIMESTAMP`);
out.push(`);\n`);

out.push(`-- Tabla: public.resenas`);
out.push(`CREATE TABLE public.resenas (`);
out.push(`    id_resena integer NOT NULL,`);
out.push(`    id_solicitud bigint NOT NULL,`);
out.push(`    id_cliente integer NOT NULL,`);
out.push(`    id_tecnico integer NOT NULL,`);
out.push(`    calificacion integer NOT NULL,`);
out.push(`    comentario text,`);
out.push(`    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP`);
out.push(`);\n`);

// -----------------------------------------------------------------------------
// SEQUENCE OWNERSHIP & DEFAULTS
// -----------------------------------------------------------------------------
out.push(`-- =============================================================================`);
out.push(`-- ASOCIACIÓN DE SECUENCIAS Y VALORES POR DEFECTO`);
out.push(`-- =============================================================================\n`);

// ApSql sequence defaults
const alterSeqAp = apSql.match(/ALTER TABLE ONLY public\.[^\s]+ ALTER COLUMN [^\s]+ SET DEFAULT nextval[^\n]+;/gi) || [];
for (const a of alterSeqAp) out.push(a);

// Additional sequence defaults from ap2sq
const alterSeqAp2 = [
  "ALTER TABLE ONLY public.cotizaciones ALTER COLUMN id_cotizacion SET DEFAULT nextval('public.cotizaciones_id_cotizacion_seq'::regclass);",
  "ALTER TABLE ONLY public.disputas ALTER COLUMN id_disputa SET DEFAULT nextval('public.disputas_id_disputa_seq'::regclass);",
  "ALTER TABLE ONLY public.expedientes_tecnicos ALTER COLUMN id_expediente SET DEFAULT nextval('public.expedientes_tecnicos_id_expediente_seq'::regclass);",
  "ALTER TABLE ONLY public.historial_estados_servicio ALTER COLUMN id_historial SET DEFAULT nextval('public.historial_estados_servicio_id_historial_seq'::regclass);",
  "ALTER TABLE ONLY public.resenas ALTER COLUMN id_resena SET DEFAULT nextval('public.resenas_id_resena_seq'::regclass);",
  "ALTER TABLE ONLY public.servicios ALTER COLUMN id_servicio SET DEFAULT nextval('public.servicios_id_servicio_seq'::regclass);",
  "ALTER TABLE ONLY public.solicitudes_retiro ALTER COLUMN id_retiro SET DEFAULT nextval('public.solicitudes_retiro_id_retiro_seq'::regclass);"
];
for (const a of alterSeqAp2) {
  if (!alterSeqAp.some(x => x.includes(a.split(' ')[4]))) {
    out.push(a);
  }
}
out.push('');

// -----------------------------------------------------------------------------
// DATA INSERTS (COPY)
// -----------------------------------------------------------------------------
out.push(`-- =============================================================================`);
out.push(`-- DATOS INICIALES (COPY)`);
out.push(`-- =============================================================================\n`);

// Copy tables from ApSql (except usuarios, which we will merge)
const copyRegex = /COPY ([^\s(]+)\s*(?:\(([^)]+)\))?\s+FROM stdin;([\s\S]*?)\\\./gi;
let cm;
while ((cm = copyRegex.exec(apSql)) !== null) {
  const table = cm[1];
  if (table === 'public.usuarios') continue; // we handle usuarios merged
  out.push(cm[0] + '\n');
}

// Add configuracion_plataforma data from ap2sq
out.push(`COPY public.configuracion_plataforma (id, comision_porcentaje, monto_minimo_retiro, radio_maximo_km, tolerancia_minutos, sensibilidad_ia, modo_mantenimiento, mensaje_mantenimiento, actualizado_en) FROM stdin;`);
out.push(`1\t15.00\t100.00\t25\t15\tMedia\tf\tEl sistema se encuentra en mantenimiento programado.\t2026-09-21 15:39:26.775335`);
out.push(`\\.\n`);

// Merged usuarios data
// Columns: 39 cols of ApSql
out.push(`COPY public.usuarios (id_usuario, nombre, apellido, correo, contrasena, fecha_registro, estado_cuenta, fecha_nacimiento, telefono, url_ine_front, url_ine_rev, fecha_actualizacion_contrasena, "2FA_Activo", "2FA_Sem", id_rol, version_sesion, biometria_estado, fecha_actualizacion, referencia_facial, estado, identidad_verificada, verificado_sep, ine_frente, ine_reverso, foto_rostro, latitud, longitud, ultima_conexion, foto_perfil, push_token, disponible, ultimo_latido, preferencias, totp_secreto, totp_pendiente, foto_archivo, anonimizado, consentimiento_privacidad, bio) FROM stdin;`);

// Extract rows from ap2sq.usuarios
const ap2UsersM = ap2Sql.match(/COPY public\.usuarios\s*\(([^)]+)\)\s+FROM stdin;([\s\S]*?)\\\./i);
if (ap2UsersM) {
  const rows = ap2UsersM[2].trim().split('\n').filter(Boolean);
  for (const r of rows) {
    const parts = r.split('\t');
    const id = parseInt(parts[0], 10);
    const rol = parseInt(parts[14], 10);
    const isAdmin = rol === 3;
    const isTecnico = rol === 2;

    // Build the 23 extra columns for ApSql
    const extraCols = [
      isAdmin ? 'verificada' : (isTecnico ? 'verificada' : 'pendiente'), // biometria_estado
      '2026-10-28 07:51:05.781185-06',                                  // fecha_actualizacion
      '\\N',                                                            // referencia_facial
      'APROBADO',                                                       // estado
      (isAdmin || isTecnico) ? 't' : 'f',                               // identidad_verificada
      isAdmin ? 't' : 'f',                                              // verificado_sep
      '\\N',                                                            // ine_frente
      '\\N',                                                            // ine_reverso
      '\\N',                                                            // foto_rostro
      '\\N',                                                            // latitud
      '\\N',                                                            // longitud
      '2026-10-28 07:51:05.781185-06',                                  // ultima_conexion
      '\\N',                                                            // foto_perfil
      '\\N',                                                            // push_token
      'f',                                                              // disponible
      '\\N',                                                            // ultimo_latido
      '{}',                                                             // preferencias
      '\\N',                                                            // totp_secreto
      '\\N',                                                            // totp_pendiente
      '\\N',                                                            // foto_archivo
      'f',                                                              // anonimizado
      '\\N',                                                            // consentimiento_privacidad
      '\\N'                                                             // bio
    ];

    out.push(parts.join('\t') + '\t' + extraCols.join('\t'));
  }
}

// Add the 2 test accounts from ApSql with IDs 101 and 102
out.push(`101\tCliente\tPrueba\tcliente.prueba@clickserve.test\t$2b$10$KJp9zmdOISJ2UIyAiwZJ7eD3sl/E8W9gnFndUUgamMsJ1ARGB613C\t2026-10-28 07:51:05.781185\tActivo\t1995-01-01\t2220000001\t\\N\t\\N\t2026-10-28 07:51:05.781185\tf\t\\N\t1\t1\tverificada\t2026-10-28 07:51:05.781185-06\t\\N\tAPROBADO\tt\tf\t\\N\t\\N\t\\N\t\\N\t\\N\t2026-10-28 07:51:05.781185-06\t\\N\t\\N\tf\t\\N\t{}\t\\N\t\\N\t\\N\tf\t\\N\t\\N`);
out.push(`102\tTecnico\tPrueba\ttecnico.prueba@clickserve.test\t$2b$10$0MUOcIxXbp0XsEg//flfse6LTOApG7kc6dSC0Piy9nlowpMFPYHRq\t2026-10-28 07:51:05.781185\tActivo\t1990-01-01\t2220000002\t\\N\t\\N\t2026-10-28 07:51:05.781185\tf\t\\N\t2\t1\tverificada\t2026-10-28 07:51:05.781185-06\t\\N\tAPROBADO\tt\tt\t\\N\t\\N\t\\N\t\\N\t\\N\t2026-10-28 07:51:05.781185-06\t\\N\t\\N\tf\t\\N\t{}\t\\N\t\\N\t\\N\tf\t\\N\t\\N`);
out.push(`\\.\n`);

// Sesiones activas data from ap2sq
const sesM = ap2Sql.match(/COPY public\.sesiones_activas\s*\(([^)]+)\)\s+FROM stdin;([\s\S]*?)\\\./i);
if (sesM) {
  out.push(sesM[0] + '\n');
}

// Tokens temporales data from ap2sq
const tokM = ap2Sql.match(/COPY public\.tokens_temporales\s*\(([^)]+)\)\s+FROM stdin;([\s\S]*?)\\\./i);
if (tokM) {
  out.push(`COPY public.tokens_temporales (id_token, token, tipo_accion, fecha_creacion, fecha_expiracion, estado_uso, id_usuario, canal, reset_token, fecha_verificacion, intentos) FROM stdin;`);
  const rows = tokM[2].trim().split('\n').filter(Boolean);
  for (const r of rows) {
    out.push(r + `\tEMAIL\t\\N\t\\N\t0`);
  }
  out.push(`\\.\n`);
}

// -----------------------------------------------------------------------------
// PRIMARY KEYS & UNIQUE CONSTRAINTS
// -----------------------------------------------------------------------------
out.push(`-- =============================================================================`);
out.push(`-- LLAVES PRIMARIAS Y RESTRICCIONES UNIQUE / CHECK`);
out.push(`-- =============================================================================\n`);

const pkRegex = /ALTER TABLE ONLY ([^\s]+)\s+ADD CONSTRAINT ([^\s]+)\s+(PRIMARY KEY|UNIQUE|CHECK)[^;]+;/gi;
const existingConstraints = new Set();
while ((m = pkRegex.exec(apSql)) !== null) {
  const cName = m[2];
  // Filter out the old pagos check constraints to allow web admin Confirmado/Pendiente status
  if (cName === 'pagos_estado_check') {
    out.push(`ALTER TABLE ONLY public.pagos ADD CONSTRAINT pagos_estado_check CHECK (((estado)::text = ANY ((ARRAY['PAGADO'::character varying, 'FALLIDO'::character varying, 'REEMBOLSADO'::character varying, 'Confirmado'::character varying, 'Pendiente'::character varying])::text[]));`);
    existingConstraints.add(cName);
  } else if (cName === 'pagos_modo_check') {
    out.push(`ALTER TABLE ONLY public.pagos ADD CONSTRAINT pagos_modo_check CHECK (((modo)::text = ANY ((ARRAY['CONEKTA'::character varying, 'SANDBOX'::character varying, 'STRIPE'::character varying, 'EFECTIVO'::character varying])::text[])));`);
    existingConstraints.add(cName);
  } else {
    out.push(m[0]);
    existingConstraints.add(cName);
  }
}

// Additional constraints from ap2sq
const additionalConstraints = [
  "ALTER TABLE ONLY public.configuracion_plataforma ADD CONSTRAINT configuracion_plataforma_pkey PRIMARY KEY (id);",
  "ALTER TABLE ONLY public.servicios ADD CONSTRAINT servicios_pkey PRIMARY KEY (id_servicio);",
  "ALTER TABLE ONLY public.expedientes_tecnicos ADD CONSTRAINT expedientes_tecnicos_pkey PRIMARY KEY (id_expediente);",
  "ALTER TABLE ONLY public.expedientes_tecnicos ADD CONSTRAINT expedientes_tecnicos_id_usuario_key UNIQUE (id_usuario);",
  "ALTER TABLE ONLY public.disputas ADD CONSTRAINT disputas_pkey PRIMARY KEY (id_disputa);",
  "ALTER TABLE ONLY public.solicitudes_retiro ADD CONSTRAINT solicitudes_retiro_pkey PRIMARY KEY (id_retiro);",
  "ALTER TABLE ONLY public.cotizaciones ADD CONSTRAINT cotizaciones_pkey PRIMARY KEY (id_cotizacion);",
  "ALTER TABLE ONLY public.historial_estados_servicio ADD CONSTRAINT historial_estados_servicio_pkey PRIMARY KEY (id_historial);",
  "ALTER TABLE ONLY public.resenas ADD CONSTRAINT resenas_pkey PRIMARY KEY (id_resena);",
  "ALTER TABLE ONLY public.resenas ADD CONSTRAINT resenas_id_solicitud_key UNIQUE (id_solicitud);",
  "ALTER TABLE ONLY public.resenas ADD CONSTRAINT resenas_calificacion_check CHECK (((calificacion >= 1) AND (calificacion <= 5)));"
];

for (const c of additionalConstraints) {
  const cNameM = c.match(/ADD CONSTRAINT ([^\s]+)/);
  if (cNameM && !existingConstraints.has(cNameM[1])) {
    out.push(c);
    existingConstraints.add(cNameM[1]);
  }
}
out.push('');

// -----------------------------------------------------------------------------
// INDEXES
// -----------------------------------------------------------------------------
out.push(`-- =============================================================================`);
out.push(`-- ÍNDICES DE RENDIMIENTO`);
out.push(`-- =============================================================================\n`);

const idxMatches = apSql.match(/CREATE (?:UNIQUE )?INDEX [^;]+;/gi) || [];
const existingIndexes = new Set();
for (const idx of idxMatches) {
  out.push(idx);
  const idxNameM = idx.match(/CREATE (?:UNIQUE )?INDEX ([^\s]+)/i);
  if (idxNameM) existingIndexes.add(idxNameM[1]);
}

// Add helpful indexes for the admin panel tables
const newIndexes = [
  "CREATE INDEX IF NOT EXISTS idx_servicios_estatus ON public.servicios (estatus);",
  "CREATE INDEX IF NOT EXISTS idx_servicios_id_usuario ON public.servicios (id_usuario);",
  "CREATE INDEX IF NOT EXISTS idx_servicios_id_tecnico ON public.servicios (id_tecnico);",
  "CREATE INDEX IF NOT EXISTS idx_servicios_fecha ON public.servicios (fecha_creacion);",
  "CREATE INDEX IF NOT EXISTS idx_disputas_estado ON public.disputas (estado);",
  "CREATE INDEX IF NOT EXISTS idx_expedientes_estatus ON public.expedientes_tecnicos (estatus);",
  "CREATE INDEX IF NOT EXISTS idx_solicitudes_retiro_estado ON public.solicitudes_retiro (estado);",
  "CREATE INDEX IF NOT EXISTS idx_pagos_id_servicio ON public.pagos (id_servicio);"
];
for (const idx of newIndexes) {
  out.push(idx);
}
out.push('');

// -----------------------------------------------------------------------------
// FOREIGN KEYS
// -----------------------------------------------------------------------------
out.push(`-- =============================================================================`);
out.push(`-- LLAVES FORÁNEAS (RELACIONES)`);
out.push(`-- =============================================================================\n`);

const fkRegex = /ALTER TABLE ONLY ([^\s]+)\s+ADD CONSTRAINT ([^\s]+)\s+FOREIGN KEY[^;]+;/gi;
while ((m = fkRegex.exec(apSql)) !== null) {
  const cName = m[2];
  out.push(m[0]);
  existingConstraints.add(cName);
}

// Additional foreign keys from ap2sq
const additionalFks = [
  "ALTER TABLE ONLY public.servicios ADD CONSTRAINT servicios_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;",
  "ALTER TABLE ONLY public.servicios ADD CONSTRAINT servicios_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;",
  "ALTER TABLE ONLY public.servicios ADD CONSTRAINT servicios_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;",
  "ALTER TABLE ONLY public.expedientes_tecnicos ADD CONSTRAINT expedientes_tecnicos_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;",
  "ALTER TABLE ONLY public.disputas ADD CONSTRAINT disputas_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;",
  "ALTER TABLE ONLY public.disputas ADD CONSTRAINT disputas_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;",
  "ALTER TABLE ONLY public.solicitudes_retiro ADD CONSTRAINT solicitudes_retiro_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;",
  "ALTER TABLE ONLY public.cotizaciones ADD CONSTRAINT fk_cotizacion_solicitud FOREIGN KEY (id_solicitud) REFERENCES public.solicitudes_servicio(id_solicitud) ON DELETE CASCADE;",
  "ALTER TABLE ONLY public.cotizaciones ADD CONSTRAINT fk_cotizacion_tecnico FOREIGN KEY (id_tecnico) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;",
  "ALTER TABLE ONLY public.historial_estados_servicio ADD CONSTRAINT fk_historial_solicitud FOREIGN KEY (id_solicitud) REFERENCES public.solicitudes_servicio(id_solicitud) ON DELETE CASCADE;",
  "ALTER TABLE ONLY public.historial_estados_servicio ADD CONSTRAINT fk_historial_usuario FOREIGN KEY (id_usuario_modificador) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;",
  "ALTER TABLE ONLY public.resenas ADD CONSTRAINT fk_resena_solicitud FOREIGN KEY (id_solicitud) REFERENCES public.solicitudes_servicio(id_solicitud) ON DELETE CASCADE;",
  "ALTER TABLE ONLY public.resenas ADD CONSTRAINT fk_resena_cliente FOREIGN KEY (id_cliente) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;",
  "ALTER TABLE ONLY public.resenas ADD CONSTRAINT fk_resena_tecnico FOREIGN KEY (id_tecnico) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;",
  "ALTER TABLE ONLY public.pagos ADD CONSTRAINT pagos_id_servicio_fkey FOREIGN KEY (id_servicio) REFERENCES public.servicios(id_servicio) ON DELETE SET NULL;"
];

for (const fk of additionalFks) {
  const fkNameM = fk.match(/ADD CONSTRAINT ([^\s]+)/);
  if (fkNameM && !existingConstraints.has(fkNameM[1])) {
    out.push(fk);
    existingConstraints.add(fkNameM[1]);
  }
}
out.push('');

// -----------------------------------------------------------------------------
// FUNCTIONS & TRIGGERS
// -----------------------------------------------------------------------------
out.push(`-- =============================================================================`);
out.push(`-- FUNCIONES Y DISPARADORES`);
out.push(`-- =============================================================================\n`);

const funcRegex = /CREATE FUNCTION public\.[^\s(]+\([\s\S]*?\$\$;/gi;
while ((m = funcRegex.exec(apSql)) !== null) {
  out.push(m[0] + '\n');
}

// -----------------------------------------------------------------------------
// SEQUENCE SETVAL
// -----------------------------------------------------------------------------
out.push(`-- =============================================================================`);
out.push(`-- SINCRONIZACIÓN DE SECUENCIAS (setval)`);
out.push(`-- =============================================================================\n`);

const setvalMap = {
  'public.archivos_id_archivo_seq': '1, false',
  'public.auditoria_id_auditoria_seq': '1, false',
  'public.billetera_tecnico_id_billetera_seq': '1, false',
  'public.calificaciones_servicio_id_calificacion_seq': '1, false',
  'public.categorias_servicio_id_categoria_seq': '14, true',
  'public.conceptos_cotizacion_id_concepto_seq': '1, false',
  'public.cotizaciones_id_cotizacion_seq': '1, false',
  'public.cotizaciones_servicio_id_cotizacion_seq': '1, false',
  'public.direcciones_id_direccion_seq': '1, false',
  'public.disputas_id_disputa_seq': '1, false',
  'public.documentos_usuario_id_documento_seq': '1, false',
  'public.especialidades_tecnico_id_especialidad_seq': '1, false',
  'public.evidencias_servicio_id_evidencia_seq': '1, false',
  'public.expedientes_tecnicos_id_expediente_seq': '1, false',
  'public.historial_estados_servicio_id_historial_seq': '1, false',
  'public.incidencias_id_incidencia_seq': '1, false',
  'public.mensajes_chat_id_seq': '1, false',
  'public.metodos_pago_id_metodo_seq': '1, false',
  'public.pagos_id_pago_seq': '1, false',
  'public.permiso_id_permiso_seq': '1, false',
  'public.portafolio_tecnico_id_item_seq': '1, false',
  'public.reprogramaciones_id_reprogramacion_seq': '1, false',
  'public.resenas_id_resena_seq': '1, false',
  'public.rol_id_rol_seq': '3, true',
  'public.rol_permiso_id_rol_permiso_seq': '1, false',
  'public.servicios_id_servicio_seq': '1, false',
  'public.solicitud_imagenes_id_imagen_seq': '1, false',
  'public.solicitudes_descartadas_id_descarte_seq': '1, false',
  'public.solicitudes_retiro_id_retiro_seq': '1, false',
  'public.solicitudes_servicio_id_solicitud_seq': '1, false',
  'public.soporte_mensajes_id_mensaje_seq': '1, false',
  'public.soporte_tickets_id_ticket_seq': '1, false',
  'public.tareas_servicio_id_tarea_seq': '1, false',
  'public.tokens_temporales_id_token_seq': '85, true',
  'public.transacciones_id_transaccion_seq': '1, false',
  'public.usuario_direcciones_id_direccion_seq': '1, false',
  'public.usuario_metodos_pago_id_metodo_seq': '1, false',
  'public.usuarios_id_usuario_seq': '105, true',
  'public.verificaciones_ine_id_verificacion_ine_seq': '1, false'
};

for (const [sName, sVal] of Object.entries(setvalMap)) {
  out.push(`SELECT pg_catalog.setval('${sName}', ${sVal});`);
}

const finalSql = out.join('\n');
fs.writeFileSync(outputPath, finalSql, 'utf8');

console.log('Unification complete!');
console.log('Output file:', outputPath);
console.log('Output size:', (finalSql.length / 1024).toFixed(2), 'KB');
console.log('Output lines:', finalSql.split('\n').length);

