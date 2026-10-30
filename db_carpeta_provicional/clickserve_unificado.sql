-- =============================================================================
-- CLICK & SERVE - BASE DE DATOS UNIFICADA
-- Generada a partir de ApSql (Base Principal) y ap2sq.sql (Módulos & Datos)
-- Fecha de unificación: 2026-10-28T16:14:27.442Z
-- =============================================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Extensiones requeridas (UUID, Hashing, Criptografía)
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;

-- =============================================================================
-- SECUENCIAS
-- =============================================================================

CREATE SEQUENCE public.archivos_id_archivo_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.auditoria_id_auditoria_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.billetera_tecnico_id_billetera_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.calificaciones_servicio_id_calificacion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.categorias_servicio_id_categoria_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.conceptos_cotizacion_id_concepto_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.cotizaciones_servicio_id_cotizacion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.direcciones_id_direccion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.documentos_usuario_id_documento_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.especialidades_tecnico_id_especialidad_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.evidencias_servicio_id_evidencia_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.incidencias_id_incidencia_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.mensajes_chat_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.metodos_pago_id_metodo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.pagos_id_pago_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.permiso_id_permiso_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.portafolio_tecnico_id_item_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.reprogramaciones_id_reprogramacion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.rol_id_rol_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.rol_permiso_id_rol_permiso_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.solicitud_imagenes_id_imagen_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.solicitudes_servicio_id_solicitud_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.soporte_mensajes_id_mensaje_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.soporte_tickets_id_ticket_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.tareas_servicio_id_tarea_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.tokens_temporales_id_token_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.transacciones_id_transaccion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.usuario_direcciones_id_direccion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.usuario_metodos_pago_id_metodo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.usuarios_id_usuario_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.verificaciones_ine_id_verificacion_ine_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE public.cotizaciones_id_cotizacion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.disputas_id_disputa_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.expedientes_tecnicos_id_expediente_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.historial_estados_servicio_id_historial_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.resenas_id_resena_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.servicios_id_servicio_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.solicitudes_retiro_id_retiro_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- =============================================================================
-- TABLAS
-- =============================================================================

CREATE TABLE public.archivos (
    id_archivo bigint NOT NULL,
    id_propietario integer,
    categoria character varying(30) NOT NULL,
    nombre character varying(255) NOT NULL,
    tipo_mime character varying(100) NOT NULL,
    tamano integer NOT NULL,
    contenido bytea NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.auditoria (
    id_auditoria bigint NOT NULL,
    id_usuario integer,
    accion character varying(60) NOT NULL,
    entidad character varying(40),
    id_entidad character varying(60),
    ip character varying(64),
    user_agent text,
    detalle jsonb,
    fecha timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.billetera_tecnico (
    id_billetera integer NOT NULL,
    id_usuario integer NOT NULL,
    saldo_actual numeric(19,4) DEFAULT 0.00,
    clabe_interbancaria character varying(18) DEFAULT NULL::character varying,
    fecha_actualizacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    banco character varying(60)
);

CREATE TABLE public.calificaciones_servicio (
    id_calificacion integer NOT NULL,
    id_solicitud bigint NOT NULL,
    id_cliente integer NOT NULL,
    id_tecnico integer,
    puntuacion_tecnico smallint,
    comentario_cliente text,
    puntuacion_cliente smallint,
    comentario_tecnico text,
    fecha_calificacion timestamp with time zone DEFAULT now(),
    CONSTRAINT calificaciones_servicio_puntuacion_cliente_check CHECK (((puntuacion_cliente >= 1) AND (puntuacion_cliente <= 5))),
    CONSTRAINT calificaciones_servicio_puntuacion_tecnico_check CHECK (((puntuacion_tecnico >= 1) AND (puntuacion_tecnico <= 5)))
);

CREATE TABLE public.categorias_servicio (
    id_categoria integer NOT NULL,
    codigo character varying(40) NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text,
    icono character varying(50),
    tarifa_base numeric(10,2) DEFAULT 0.00,
    orden smallint DEFAULT 50
);

CREATE TABLE public.conceptos_cotizacion (
    id_concepto bigint NOT NULL,
    id_solicitud bigint NOT NULL,
    id_cotizacion integer,
    tipo character varying(12) NOT NULL,
    descripcion character varying(200) NOT NULL,
    monto numeric(19,4) NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conceptos_cotizacion_monto_check CHECK ((monto > (0)::numeric)),
    CONSTRAINT conceptos_cotizacion_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['MANO_OBRA'::character varying, 'MATERIAL'::character varying, 'EXTRA'::character varying])::text[])))
);

CREATE TABLE public.cotizaciones_servicio (
    id_cotizacion integer NOT NULL,
    id_solicitud bigint NOT NULL,
    id_tecnico integer NOT NULL,
    monto_mano_obra numeric(19,4) DEFAULT 0.00 NOT NULL,
    monto_materiales numeric(19,4) DEFAULT 0.00 NOT NULL,
    monto_total numeric(19,4) NOT NULL,
    detalles text,
    tiempo_estimado_minutos integer,
    estado character varying(20) DEFAULT 'ENVIADA'::character varying,
    fecha_creacion timestamp with time zone DEFAULT now(),
    fecha_respuesta timestamp with time zone
);

-- Tabla: public.direcciones (Unificada)
CREATE TABLE public.direcciones (
    id_direccion integer NOT NULL,
    id_usuario integer NOT NULL,
    etiqueta character varying(50),
    calle character varying(255) NOT NULL,
    numero character varying(50),
    numero_exterior character varying(50),
    interior character varying(50),
    numero_interior character varying(50),
    colonia character varying(150),
    cp character varying(10),
    codigo_postal character varying(10),
    ciudad character varying(150) DEFAULT 'Lázaro Cárdenas'::character varying NOT NULL,
    estado character varying(150) DEFAULT 'Michoacán'::character varying NOT NULL,
    referencias text,
    latitud numeric(10,8),
    longitud numeric(11,8),
    predeterminada boolean DEFAULT false NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.documentos_usuario (
    id_documento bigint NOT NULL,
    id_usuario integer NOT NULL,
    tipo character varying(25) NOT NULL,
    id_archivo bigint,
    numero character varying(40),
    descripcion character varying(150),
    estado character varying(12) DEFAULT 'EN_REVISION'::character varying NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT documentos_usuario_estado_check CHECK (((estado)::text = ANY ((ARRAY['EN_REVISION'::character varying, 'APROBADO'::character varying, 'RECHAZADO'::character varying])::text[]))),
    CONSTRAINT documentos_usuario_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['INE_FRENTE'::character varying, 'INE_REVERSO'::character varying, 'ROSTRO'::character varying, 'CEDULA'::character varying, 'CERTIFICACION'::character varying, 'COMPROBANTE_DOMICILIO'::character varying, 'ANTECEDENTES'::character varying])::text[])))
);

CREATE TABLE public.especialidades_tecnico (
    id_especialidad integer NOT NULL,
    id_usuario integer NOT NULL,
    nombre character varying(100) NOT NULL,
    estado character varying(30) DEFAULT 'VERIFICADO'::character varying NOT NULL,
    activa boolean DEFAULT true,
    fecha_creacion timestamp with time zone DEFAULT now(),
    categoria character varying(40)
);

CREATE TABLE public.estados_cuenta (
    codigo character varying(20) NOT NULL,
    descripcion character varying(100) NOT NULL
);

CREATE TABLE public.estados_pago (
    codigo character varying(20) NOT NULL,
    descripcion character varying(100) NOT NULL
);

CREATE TABLE public.estados_solicitud (
    id_estado character varying(20) NOT NULL,
    nombre character varying(50) NOT NULL,
    descripcion character varying(255),
    orden_flujo smallint DEFAULT 0
);

CREATE TABLE public.evidencias_servicio (
    id_evidencia integer NOT NULL,
    id_solicitud bigint NOT NULL,
    id_tecnico integer NOT NULL,
    tipo_evidencia character varying(20) DEFAULT 'POST_TRABAJO'::character varying,
    url_foto text,
    descripcion text,
    fecha_subida timestamp with time zone DEFAULT now(),
    id_archivo bigint
);

CREATE TABLE public.idempotencia (
    clave uuid NOT NULL,
    id_usuario integer NOT NULL,
    alcance character varying(60) NOT NULL,
    status integer,
    cuerpo jsonb,
    creado timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.incidencias (
    id_incidencia bigint NOT NULL,
    folio character varying(20) NOT NULL,
    id_solicitud bigint,
    id_usuario integer NOT NULL,
    tipo character varying(20) NOT NULL,
    descripcion text NOT NULL,
    prioridad character varying(5) DEFAULT 'MEDIA'::character varying NOT NULL,
    estado character varying(10) DEFAULT 'ABIERTA'::character varying NOT NULL,
    resolucion character varying(12),
    estado_previo character varying(20),
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    fecha_resolucion timestamp with time zone,
    CONSTRAINT incidencias_estado_check CHECK (((estado)::text = ANY ((ARRAY['ABIERTA'::character varying, 'RESUELTA'::character varying])::text[]))),
    CONSTRAINT incidencias_prioridad_check CHECK (((prioridad)::text = ANY ((ARRAY['BAJA'::character varying, 'MEDIA'::character varying, 'ALTA'::character varying])::text[]))),
    CONSTRAINT incidencias_resolucion_check CHECK (((resolucion)::text = ANY ((ARRAY['REASIGNAR'::character varying, 'CANCELAR'::character varying, 'CONTINUAR'::character varying])::text[]))),
    CONSTRAINT incidencias_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['NO_SE_PRESENTO'::character varying, 'COBRO_INDEBIDO'::character varying, 'MALA_CALIDAD'::character varying, 'DANOS'::character varying, 'SEGURIDAD'::character varying, 'GARANTIA'::character varying, 'OTRO'::character varying])::text[])))
);

CREATE TABLE public.mensajes_chat (
    id bigint NOT NULL,
    id_solicitud bigint NOT NULL,
    id_emisor integer NOT NULL,
    mensaje text,
    fecha_envio timestamp with time zone DEFAULT now() NOT NULL,
    id_archivo bigint
);

CREATE TABLE public.metodos_pago (
    id_metodo integer NOT NULL,
    id_usuario integer,
    titular character varying(100),
    ultimos_4 character varying(4),
    expiracion character varying(10),
    token text,
    marca character varying(20),
    predeterminada boolean DEFAULT false NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL
);

-- Tabla: public.pagos (Unificada para Web Admin y App Móvil)
CREATE TABLE public.pagos (
    id_pago bigint NOT NULL,
    id_solicitud bigint,
    id_servicio integer,
    id_cliente integer,
    id_metodo integer,
    monto numeric(19,4) NOT NULL,
    moneda character varying(3) DEFAULT 'MXN'::character varying NOT NULL,
    estado character varying(50) DEFAULT 'Confirmado'::character varying NOT NULL,
    modo character varying(10) DEFAULT 'SANDBOX'::character varying,
    referencia character varying(80),
    desglose jsonb DEFAULT '{}'::jsonb NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    fecha_pago timestamp with time zone DEFAULT now()
);

CREATE TABLE public.permiso (
    id_permiso integer NOT NULL,
    clave_permiso character varying(50) NOT NULL,
    descripcion text
);

CREATE TABLE public.portafolio_tecnico (
    id_item bigint NOT NULL,
    id_usuario integer NOT NULL,
    id_archivo bigint NOT NULL,
    titulo character varying(120) NOT NULL,
    descripcion text,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.reprogramaciones (
    id_reprogramacion bigint NOT NULL,
    id_solicitud bigint NOT NULL,
    propuesta_por integer NOT NULL,
    fecha date NOT NULL,
    hora time without time zone NOT NULL,
    motivo text,
    estado character varying(10) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    id_anterior bigint,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    fecha_respuesta timestamp with time zone,
    CONSTRAINT reprogramaciones_estado_check CHECK (((estado)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'ACEPTADA'::character varying, 'RECHAZADA'::character varying, 'CANCELADA'::character varying])::text[])))
);

CREATE TABLE public.retos_2fa (
    id_reto uuid DEFAULT gen_random_uuid() NOT NULL,
    id_usuario integer NOT NULL,
    intentos smallint DEFAULT 0 NOT NULL,
    usado boolean DEFAULT false NOT NULL,
    expira timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    codigo_hash text
);

CREATE TABLE public.rol (
    id_rol integer NOT NULL,
    nombre_rol character varying(50) NOT NULL
);

CREATE TABLE public.rol_permiso (
    id_rol_permiso integer NOT NULL,
    id_rol integer,
    id_permiso integer
);

CREATE TABLE public.roles (
    id_rol smallint NOT NULL,
    nombre character varying(50) NOT NULL,
    descripcion character varying(255)
);

CREATE TABLE public.schema_migraciones (
    id character varying(80) NOT NULL,
    aplicada timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.sesiones_activas (
    id_sesion uuid DEFAULT gen_random_uuid() NOT NULL,
    id_usuario integer,
    dispositivo character varying(255),
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    estado character varying(20) DEFAULT 'activa'::character varying,
    id_rol integer
);

CREATE TABLE public.solicitud_imagenes (
    id_imagen bigint NOT NULL,
    id_solicitud bigint NOT NULL,
    nombre character varying(255) NOT NULL,
    tipo_mime character varying(100) NOT NULL,
    contenido bytea NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.solicitudes_descartadas (
    id_solicitud bigint NOT NULL,
    id_tecnico integer NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL
);

-- Tabla: public.solicitudes_servicio (Unificada)
CREATE TABLE public.solicitudes_servicio (
    id_solicitud bigint NOT NULL,
    folio character varying(24) NOT NULL,
    id_usuario integer NOT NULL,
    id_cliente integer,
    id_tecnico integer,
    id_direccion integer,
    titulo character varying(255),
    categoria character varying(100),
    descripcion text NOT NULL,
    direccion text NOT NULL,
    fecha_preferida date,
    hora_preferida time without time zone,
    estado character varying(50) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    estado_actual character varying(50) DEFAULT 'Pendiente'::character varying,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    fecha_visita_esperada timestamp without time zone,
    calificacion smallint,
    comentario_calificacion text,
    estado_pago character varying(20) DEFAULT 'PENDIENTE'::character varying,
    calificacion_cliente integer,
    comentario_cliente text,
    evidencia_foto text,
    monto_cotizacion numeric(19,4),
    detalles_cotizacion text,
    id_cotizacion_aceptada integer,
    latitud numeric(10,7),
    longitud numeric(10,7),
    id_tecnico_propuesto integer,
    propuesto_hasta timestamp with time zone,
    fecha_asignacion timestamp with time zone,
    fecha_llegada timestamp with time zone,
    fecha_finalizacion timestamp with time zone,
    garantia_hasta date,
    motivo_cancelacion text,
    cancelado_por character varying(10),
    monto_total numeric(19,4),
    estado_previo character varying(20),
    alerta_sos boolean DEFAULT false NOT NULL,
    latitud_sos numeric(10,7),
    longitud_sos numeric(10,7),
    fecha_sos timestamp with time zone,
    referencias text
);

CREATE TABLE public.soporte_mensajes (
    id_mensaje bigint NOT NULL,
    id_ticket bigint NOT NULL,
    id_emisor integer,
    es_asesor boolean DEFAULT false NOT NULL,
    mensaje text,
    id_archivo bigint,
    fecha_envio timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.soporte_tickets (
    id_ticket bigint NOT NULL,
    folio character varying(20) NOT NULL,
    id_usuario integer NOT NULL,
    id_solicitud bigint,
    asunto character varying(150) NOT NULL,
    categoria character varying(15) DEFAULT 'OTRO'::character varying NOT NULL,
    prioridad character varying(5) DEFAULT 'MEDIA'::character varying NOT NULL,
    estado character varying(12) DEFAULT 'ABIERTO'::character varying NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    fecha_actualizacion timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT soporte_tickets_categoria_check CHECK (((categoria)::text = ANY ((ARRAY['PAGOS'::character varying, 'SERVICIO'::character varying, 'CUENTA'::character varying, 'SEGURIDAD'::character varying, 'OTRO'::character varying])::text[]))),
    CONSTRAINT soporte_tickets_estado_check CHECK (((estado)::text = ANY ((ARRAY['ABIERTO'::character varying, 'EN_ATENCION'::character varying, 'ESCALADO'::character varying, 'CERRADO'::character varying])::text[]))),
    CONSTRAINT soporte_tickets_prioridad_check CHECK (((prioridad)::text = ANY ((ARRAY['BAJA'::character varying, 'MEDIA'::character varying, 'ALTA'::character varying])::text[])))
);

CREATE TABLE public.tareas_servicio (
    id_tarea bigint NOT NULL,
    id_solicitud bigint NOT NULL,
    descripcion character varying(200) NOT NULL,
    origen character varying(12) DEFAULT 'TECNICO'::character varying NOT NULL,
    norma character varying(40),
    completada boolean DEFAULT false NOT NULL,
    fecha_completada timestamp with time zone,
    orden smallint DEFAULT 0 NOT NULL,
    CONSTRAINT tareas_servicio_origen_check CHECK (((origen)::text = ANY ((ARRAY['PLANTILLA'::character varying, 'TECNICO'::character varying])::text[])))
);

CREATE TABLE public.tokens_temporales (
    id_token integer NOT NULL,
    token character varying(10) NOT NULL,
    tipo_accion character varying(50) NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion timestamp without time zone DEFAULT (CURRENT_TIMESTAMP + '00:15:00'::interval),
    estado_uso character varying(20) DEFAULT 'sin usar'::character varying,
    id_usuario integer NOT NULL,
    canal character varying(10) DEFAULT 'EMAIL'::character varying,
    reset_token uuid,
    fecha_verificacion timestamp with time zone,
    intentos smallint DEFAULT 0 NOT NULL
);

CREATE TABLE public.transacciones (
    id_transaccion integer NOT NULL,
    id_billetera integer NOT NULL,
    monto numeric(19,4) NOT NULL,
    tipo character varying(20) NOT NULL,
    estado character varying(20) DEFAULT 'COMPLETADO'::character varying,
    fecha timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    folio character varying(24),
    concepto character varying(20) DEFAULT 'SERVICIO'::character varying,
    id_solicitud bigint,
    desglose jsonb,
    clabe_destino character varying(30),
    banco_destino character varying(60),
    CONSTRAINT transacciones_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['INGRESO'::character varying, 'RETIRO'::character varying])::text[])))
);

CREATE TABLE public.usuario_direcciones (
    id_direccion integer NOT NULL,
    id_usuario integer NOT NULL,
    etiqueta character varying(50) DEFAULT 'Casa'::character varying,
    calle character varying(255) NOT NULL,
    numero_exterior character varying(50),
    numero_interior character varying(50),
    colonia character varying(100),
    codigo_postal character varying(10),
    ciudad character varying(100) DEFAULT 'Puebla'::character varying,
    estado character varying(100) DEFAULT 'Puebla'::character varying,
    pais character varying(50) DEFAULT 'México'::character varying,
    latitud numeric(10,7),
    longitud numeric(10,7),
    es_predeterminada boolean DEFAULT false,
    creado_en timestamp with time zone DEFAULT now()
);

CREATE TABLE public.usuario_metodos_pago (
    id_metodo integer NOT NULL,
    id_usuario integer NOT NULL,
    titular character varying(150) NOT NULL,
    ultimos_4 character varying(4) NOT NULL,
    marca_tarjeta character varying(30) DEFAULT 'VISA'::character varying,
    expiracion character varying(10) NOT NULL,
    token_pasarela text,
    es_predeterminado boolean DEFAULT false,
    creado_en timestamp with time zone DEFAULT now()
);

CREATE TABLE public.usuarios (
    id_usuario integer NOT NULL,
    nombre character varying(100) NOT NULL,
    apellido character varying(100) NOT NULL,
    correo character varying(150) NOT NULL,
    contrasena character varying(255) NOT NULL,
    fecha_registro timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    estado_cuenta character varying(20) DEFAULT 'Activo'::character varying,
    fecha_nacimiento date,
    telefono character varying(15),
    url_ine_front text,
    url_ine_rev text,
    fecha_actualizacion_contrasena timestamp without time zone,
    "2FA_Activo" boolean DEFAULT false,
    "2FA_Sem" character varying(255),
    id_rol integer,
    version_sesion integer DEFAULT 1,
    biometria_estado character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    fecha_actualizacion timestamp with time zone DEFAULT now() NOT NULL,
    referencia_facial bytea,
    estado character varying(30) DEFAULT 'pendiente'::character varying,
    identidad_verificada boolean DEFAULT false,
    verificado_sep boolean DEFAULT false,
    ine_frente text,
    ine_reverso text,
    foto_rostro text,
    latitud numeric(10,7),
    longitud numeric(10,7),
    ultima_conexion timestamp with time zone DEFAULT now(),
    foto_perfil text,
    push_token text,
    disponible boolean DEFAULT false NOT NULL,
    ultimo_latido timestamp with time zone,
    preferencias jsonb DEFAULT '{}'::jsonb NOT NULL,
    totp_secreto text,
    totp_pendiente text,
    foto_archivo bigint,
    anonimizado boolean DEFAULT false NOT NULL,
    consentimiento_privacidad timestamp with time zone,
    bio text
);

CREATE TABLE public.verificaciones_biometricas (
    id_verificacion uuid DEFAULT gen_random_uuid() NOT NULL,
    id_usuario integer NOT NULL,
    desafio character varying(128) NOT NULL,
    proveedor character varying(40) DEFAULT 'opencv'::character varying NOT NULL,
    estado character varying(30) DEFAULT 'solicitada'::character varying NOT NULL,
    resultado jsonb,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    fecha_expiracion timestamp with time zone DEFAULT (now() + '00:10:00'::interval) NOT NULL,
    fecha_resolucion timestamp with time zone,
    CONSTRAINT verificaciones_estado_ck CHECK (((estado)::text = ANY ((ARRAY['solicitada'::character varying, 'procesando'::character varying, 'APROBADO'::character varying, 'RECHAZADO'::character varying, 'expirada'::character varying])::text[])))
);

CREATE TABLE public.verificaciones_ine (
    id_verificacion_ine integer NOT NULL,
    id_usuario integer NOT NULL,
    lado character varying(10) NOT NULL,
    curp character varying(18),
    comprobaciones jsonb NOT NULL,
    hash_imagen character(64) NOT NULL,
    proveedor character varying(30) DEFAULT 'propio'::character varying NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT verificaciones_ine_lado_check CHECK (((lado)::text = ANY ((ARRAY['frente'::character varying, 'reverso'::character varying])::text[])))
);

-- =============================================================================
-- TABLAS ADICIONALES DE GESTIÓN Y PANEL WEB (provenientes de ap2sq.sql)
-- =============================================================================

-- Tabla: public.configuracion_plataforma
CREATE TABLE public.configuracion_plataforma (
    id integer DEFAULT 1 NOT NULL,
    comision_porcentaje numeric(5,2) DEFAULT 15.00,
    monto_minimo_retiro numeric(10,2) DEFAULT 100.00,
    radio_maximo_km integer DEFAULT 25,
    tolerancia_minutos integer DEFAULT 15,
    sensibilidad_ia character varying(20) DEFAULT 'Media'::character varying,
    modo_mantenimiento boolean DEFAULT false,
    mensaje_mantenimiento text DEFAULT 'El sistema se encuentra en mantenimiento programado.'::text,
    actualizado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: public.servicios (Servicios del Panel de Administración Web)
CREATE TABLE public.servicios (
    id_servicio integer NOT NULL,
    id_usuario integer,
    id_cliente integer,
    id_tecnico integer,
    titulo character varying(150),
    descripcion text,
    estatus character varying(50) DEFAULT 'Pendiente'::character varying,
    monto numeric(12,2) DEFAULT NULL::numeric,
    latitud numeric(10,7) DEFAULT NULL::numeric,
    longitud numeric(10,7) DEFAULT NULL::numeric,
    direccion text,
    fecha_creacion timestamp with time zone DEFAULT now(),
    fecha_actualizacion timestamp with time zone DEFAULT now()
);

-- Tabla: public.expedientes_tecnicos
CREATE TABLE public.expedientes_tecnicos (
    id_expediente integer NOT NULL,
    id_usuario integer,
    especialidad character varying(100),
    estatus character varying(50) DEFAULT 'En Revisión'::character varying,
    fecha_solicitud timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_resolucion timestamp without time zone,
    motivo_rechazo text,
    documentos jsonb DEFAULT '[]'::jsonb,
    metricas jsonb DEFAULT '{"trabajos": 0, "efectividad": 100, "calificacion": 5.0}'::jsonb
);

-- Tabla: public.disputas
CREATE TABLE public.disputas (
    id_disputa integer NOT NULL,
    folio_servicio character varying(50),
    id_cliente integer,
    id_tecnico integer,
    categoria character varying(100),
    prioridad character varying(20) DEFAULT 'Media'::character varying,
    estado character varying(50) DEFAULT 'Abierta'::character varying,
    monto_reembolso numeric(10,2) DEFAULT 0,
    monto_multa numeric(10,2) DEFAULT 0,
    observaciones text,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_resolucion timestamp without time zone
);

-- Tabla: public.solicitudes_retiro
CREATE TABLE public.solicitudes_retiro (
    id_retiro integer NOT NULL,
    id_usuario integer,
    monto numeric(10,2) NOT NULL,
    clabe character varying(18) NOT NULL,
    banco character varying(100),
    estado character varying(50) DEFAULT 'Pendiente'::character varying,
    folio_trx character varying(100),
    fecha_solicitud timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_procesado timestamp without time zone,
    motivo_rechazo text
);

-- Tabla: public.cotizaciones
CREATE TABLE public.cotizaciones (
    id_cotizacion integer NOT NULL,
    id_solicitud bigint NOT NULL,
    id_tecnico integer NOT NULL,
    monto numeric(10,2) NOT NULL,
    descripcion_trabajo text NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    estado character varying(50) DEFAULT 'Pendiente'::character varying
);

-- Tabla: public.historial_estados_servicio
CREATE TABLE public.historial_estados_servicio (
    id_historial integer NOT NULL,
    id_solicitud bigint NOT NULL,
    estado character varying(50) NOT NULL,
    comentario text,
    id_usuario_modificador integer,
    fecha_cambio timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: public.resenas
CREATE TABLE public.resenas (
    id_resena integer NOT NULL,
    id_solicitud bigint NOT NULL,
    id_cliente integer NOT NULL,
    id_tecnico integer NOT NULL,
    calificacion integer NOT NULL,
    comentario text,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- ASOCIACIÓN DE SECUENCIAS Y VALORES POR DEFECTO
-- =============================================================================

ALTER TABLE ONLY public.archivos ALTER COLUMN id_archivo SET DEFAULT nextval('public.archivos_id_archivo_seq'::regclass);
ALTER TABLE ONLY public.auditoria ALTER COLUMN id_auditoria SET DEFAULT nextval('public.auditoria_id_auditoria_seq'::regclass);
ALTER TABLE ONLY public.billetera_tecnico ALTER COLUMN id_billetera SET DEFAULT nextval('public.billetera_tecnico_id_billetera_seq'::regclass);
ALTER TABLE ONLY public.calificaciones_servicio ALTER COLUMN id_calificacion SET DEFAULT nextval('public.calificaciones_servicio_id_calificacion_seq'::regclass);
ALTER TABLE ONLY public.categorias_servicio ALTER COLUMN id_categoria SET DEFAULT nextval('public.categorias_servicio_id_categoria_seq'::regclass);
ALTER TABLE ONLY public.conceptos_cotizacion ALTER COLUMN id_concepto SET DEFAULT nextval('public.conceptos_cotizacion_id_concepto_seq'::regclass);
ALTER TABLE ONLY public.cotizaciones_servicio ALTER COLUMN id_cotizacion SET DEFAULT nextval('public.cotizaciones_servicio_id_cotizacion_seq'::regclass);
ALTER TABLE ONLY public.direcciones ALTER COLUMN id_direccion SET DEFAULT nextval('public.direcciones_id_direccion_seq'::regclass);
ALTER TABLE ONLY public.documentos_usuario ALTER COLUMN id_documento SET DEFAULT nextval('public.documentos_usuario_id_documento_seq'::regclass);
ALTER TABLE ONLY public.especialidades_tecnico ALTER COLUMN id_especialidad SET DEFAULT nextval('public.especialidades_tecnico_id_especialidad_seq'::regclass);
ALTER TABLE ONLY public.evidencias_servicio ALTER COLUMN id_evidencia SET DEFAULT nextval('public.evidencias_servicio_id_evidencia_seq'::regclass);
ALTER TABLE ONLY public.incidencias ALTER COLUMN id_incidencia SET DEFAULT nextval('public.incidencias_id_incidencia_seq'::regclass);
ALTER TABLE ONLY public.mensajes_chat ALTER COLUMN id SET DEFAULT nextval('public.mensajes_chat_id_seq'::regclass);
ALTER TABLE ONLY public.metodos_pago ALTER COLUMN id_metodo SET DEFAULT nextval('public.metodos_pago_id_metodo_seq'::regclass);
ALTER TABLE ONLY public.pagos ALTER COLUMN id_pago SET DEFAULT nextval('public.pagos_id_pago_seq'::regclass);
ALTER TABLE ONLY public.permiso ALTER COLUMN id_permiso SET DEFAULT nextval('public.permiso_id_permiso_seq'::regclass);
ALTER TABLE ONLY public.portafolio_tecnico ALTER COLUMN id_item SET DEFAULT nextval('public.portafolio_tecnico_id_item_seq'::regclass);
ALTER TABLE ONLY public.reprogramaciones ALTER COLUMN id_reprogramacion SET DEFAULT nextval('public.reprogramaciones_id_reprogramacion_seq'::regclass);
ALTER TABLE ONLY public.rol ALTER COLUMN id_rol SET DEFAULT nextval('public.rol_id_rol_seq'::regclass);
ALTER TABLE ONLY public.rol_permiso ALTER COLUMN id_rol_permiso SET DEFAULT nextval('public.rol_permiso_id_rol_permiso_seq'::regclass);
ALTER TABLE ONLY public.solicitud_imagenes ALTER COLUMN id_imagen SET DEFAULT nextval('public.solicitud_imagenes_id_imagen_seq'::regclass);
ALTER TABLE ONLY public.solicitudes_servicio ALTER COLUMN id_solicitud SET DEFAULT nextval('public.solicitudes_servicio_id_solicitud_seq'::regclass);
ALTER TABLE ONLY public.soporte_mensajes ALTER COLUMN id_mensaje SET DEFAULT nextval('public.soporte_mensajes_id_mensaje_seq'::regclass);
ALTER TABLE ONLY public.soporte_tickets ALTER COLUMN id_ticket SET DEFAULT nextval('public.soporte_tickets_id_ticket_seq'::regclass);
ALTER TABLE ONLY public.tareas_servicio ALTER COLUMN id_tarea SET DEFAULT nextval('public.tareas_servicio_id_tarea_seq'::regclass);
ALTER TABLE ONLY public.tokens_temporales ALTER COLUMN id_token SET DEFAULT nextval('public.tokens_temporales_id_token_seq'::regclass);
ALTER TABLE ONLY public.transacciones ALTER COLUMN id_transaccion SET DEFAULT nextval('public.transacciones_id_transaccion_seq'::regclass);
ALTER TABLE ONLY public.usuario_direcciones ALTER COLUMN id_direccion SET DEFAULT nextval('public.usuario_direcciones_id_direccion_seq'::regclass);
ALTER TABLE ONLY public.usuario_metodos_pago ALTER COLUMN id_metodo SET DEFAULT nextval('public.usuario_metodos_pago_id_metodo_seq'::regclass);
ALTER TABLE ONLY public.usuarios ALTER COLUMN id_usuario SET DEFAULT nextval('public.usuarios_id_usuario_seq'::regclass);
ALTER TABLE ONLY public.verificaciones_ine ALTER COLUMN id_verificacion_ine SET DEFAULT nextval('public.verificaciones_ine_id_verificacion_ine_seq'::regclass);

-- =============================================================================
-- DATOS INICIALES (COPY)
-- =============================================================================

COPY public.archivos (id_archivo, id_propietario, categoria, nombre, tipo_mime, tamano, contenido, fecha_creacion) FROM stdin;
\.

COPY public.auditoria (id_auditoria, id_usuario, accion, entidad, id_entidad, ip, user_agent, detalle, fecha) FROM stdin;
\.

COPY public.billetera_tecnico (id_billetera, id_usuario, saldo_actual, clabe_interbancaria, fecha_actualizacion, banco) FROM stdin;
\.

COPY public.calificaciones_servicio (id_calificacion, id_solicitud, id_cliente, id_tecnico, puntuacion_tecnico, comentario_cliente, puntuacion_cliente, comentario_tecnico, fecha_calificacion) FROM stdin;
\.

COPY public.categorias_servicio (id_categoria, codigo, nombre, descripcion, icono, tarifa_base, orden) FROM stdin;
7	COMPUTO	Cómputo y redes	Soporte, hardware, redes domésticas y equipo de oficina	monitor	0.00	1
2	ELECTRICIDAD	Electricidad	Instalaciones, contactos, luminarias y fallas eléctricas (NOM-001-SEDE)	zap	0.00	2
1	PLOMERIA	Plomería	Fugas, tuberías, sanitarios, calentadores e instalaciones de gas	droplet	0.00	3
3	CERRAJERIA	Cerrajería	Apertura, cambio de chapas y duplicados	key	0.00	6
4	LINEA_BLANCA	Línea blanca	Refrigeradores, lavadoras, secadoras y estufas	box	0.00	5
5	CLIMATIZACION	Climatización	Instalación y mantenimiento de aire acondicionado	wind	0.00	4
6	PINTURA	Pintura e impermeabilización	Pintura interior, exterior e impermeabilizado	edit-3	0.00	7
14	MECANICA	Mecánica automotriz	Diagnóstico, afinación y reparaciones a domicilio	truck	0.00	8
\.

COPY public.conceptos_cotizacion (id_concepto, id_solicitud, id_cotizacion, tipo, descripcion, monto, fecha_creacion) FROM stdin;
\.

COPY public.cotizaciones_servicio (id_cotizacion, id_solicitud, id_tecnico, monto_mano_obra, monto_materiales, monto_total, detalles, tiempo_estimado_minutos, estado, fecha_creacion, fecha_respuesta) FROM stdin;
\.

COPY public.direcciones (id_direccion, id_usuario, etiqueta, calle, numero, interior, colonia, cp, latitud, longitud, referencias, ciudad, predeterminada) FROM stdin;
\.

COPY public.documentos_usuario (id_documento, id_usuario, tipo, id_archivo, numero, descripcion, estado, fecha_creacion) FROM stdin;
\.

COPY public.especialidades_tecnico (id_especialidad, id_usuario, nombre, estado, activa, fecha_creacion, categoria) FROM stdin;
\.

COPY public.estados_cuenta (codigo, descripcion) FROM stdin;
Activo	Cuenta verificada y activa
Pendiente	Pendiente de confirmación o verificación
Suspendido	Cuenta temporal o definitivamente inactiva
\.

COPY public.estados_pago (codigo, descripcion) FROM stdin;
PENDIENTE	Pago no procesado o en espera
PAGADO	Pago acreditado satisfactoriamente
REEMBOLSADO	Monto reintegrado al cliente
FALLIDO	Intento de cobro denegado
NO_APLICA	Servicio cancelado sin cargo
PROCESANDO	Cobro enviado a la pasarela, pendiente de registrar
\.

COPY public.estados_solicitud (id_estado, nombre, descripcion, orden_flujo) FROM stdin;
PENDIENTE	Buscando técnico	La solicitud espera a que un técnico la acepte	1
ASIGNADA	Técnico asignado	Un técnico aceptó la solicitud	2
EN_CAMINO	Técnico en camino	El técnico se dirige al domicilio	3
EN_SITIO	Técnico en sitio	El técnico llegó al domicilio	4
ESPERANDO_APROBACION	Cotización enviada	El cliente debe aprobar la cotización	5
EN_PROCESO	Trabajo en proceso	El técnico realiza el trabajo	6
POR_CONFIRMAR	Por confirmar	El técnico terminó; el cliente confirma y paga	7
FINALIZADA	Servicio finalizado	Servicio confirmado y pagado	8
SUSPENDIDA	Orden suspendida	Orden detenida por una incidencia	90
CANCELADA	Cancelada	Servicio cancelado	99
\.

COPY public.evidencias_servicio (id_evidencia, id_solicitud, id_tecnico, tipo_evidencia, url_foto, descripcion, fecha_subida, id_archivo) FROM stdin;
\.

COPY public.idempotencia (clave, id_usuario, alcance, status, cuerpo, creado) FROM stdin;
\.

COPY public.incidencias (id_incidencia, folio, id_solicitud, id_usuario, tipo, descripcion, prioridad, estado, resolucion, estado_previo, fecha_creacion, fecha_resolucion) FROM stdin;
\.

COPY public.mensajes_chat (id, id_solicitud, id_emisor, mensaje, fecha_envio, id_archivo) FROM stdin;
\.

COPY public.metodos_pago (id_metodo, id_usuario, titular, ultimos_4, expiracion, token, marca, predeterminada, fecha_creacion) FROM stdin;
\.

COPY public.pagos (id_pago, id_solicitud, id_cliente, id_metodo, monto, moneda, estado, modo, referencia, desglose, fecha) FROM stdin;
\.

COPY public.permiso (id_permiso, clave_permiso, descripcion) FROM stdin;
\.

COPY public.portafolio_tecnico (id_item, id_usuario, id_archivo, titulo, descripcion, fecha_creacion) FROM stdin;
\.

COPY public.reprogramaciones (id_reprogramacion, id_solicitud, propuesta_por, fecha, hora, motivo, estado, id_anterior, fecha_creacion, fecha_respuesta) FROM stdin;
\.

COPY public.retos_2fa (id_reto, id_usuario, intentos, usado, expira, fecha_creacion, codigo_hash) FROM stdin;
\.

COPY public.rol (id_rol, nombre_rol) FROM stdin;
1	CLIENTE
2	TECNICO
3	ADMIN
\.

COPY public.rol_permiso (id_rol_permiso, id_rol, id_permiso) FROM stdin;
\.

COPY public.roles (id_rol, nombre, descripcion) FROM stdin;
1	CLIENTE	Usuario solicitante de servicios para hogar o negocio
2	TECNICO	Profesional prestador de servicios técnicos especializados
3	ADMIN	Administrador de plataforma y soporte central
\.

COPY public.schema_migraciones (id, aplicada) FROM stdin;
000_base	2026-10-28 07:51:03.665431-06
001_columnas_runtime	2026-10-28 07:51:03.757785-06
001b_normalizacion_3nf	2026-10-28 07:51:04.177437-06
002_requisitos_moviles	2026-10-28 07:51:04.58017-06
003_cobro_en_proceso	2026-10-28 07:51:05.041405-06
004_verificaciones_ine	2026-10-28 07:51:05.411215-06
\.

COPY public.sesiones_activas (id_sesion, id_usuario, dispositivo, fecha_creacion, estado, id_rol) FROM stdin;
\.

COPY public.solicitud_imagenes (id_imagen, id_solicitud, nombre, tipo_mime, contenido, fecha_creacion) FROM stdin;
\.

COPY public.solicitudes_descartadas (id_solicitud, id_tecnico, fecha) FROM stdin;
\.

COPY public.solicitudes_servicio (id_solicitud, folio, id_usuario, id_tecnico, categoria, descripcion, direccion, fecha_preferida, hora_preferida, estado, fecha_creacion, calificacion, comentario_calificacion, estado_pago, calificacion_cliente, comentario_cliente, evidencia_foto, monto_cotizacion, detalles_cotizacion, latitud, longitud, id_tecnico_propuesto, propuesto_hasta, fecha_asignacion, fecha_llegada, fecha_finalizacion, garantia_hasta, motivo_cancelacion, cancelado_por, monto_total, estado_previo, alerta_sos, latitud_sos, longitud_sos, fecha_sos, referencias) FROM stdin;
\.

COPY public.soporte_mensajes (id_mensaje, id_ticket, id_emisor, es_asesor, mensaje, id_archivo, fecha_envio) FROM stdin;
\.

COPY public.soporte_tickets (id_ticket, folio, id_usuario, id_solicitud, asunto, categoria, prioridad, estado, fecha_creacion, fecha_actualizacion) FROM stdin;
\.

COPY public.tareas_servicio (id_tarea, id_solicitud, descripcion, origen, norma, completada, fecha_completada, orden) FROM stdin;
\.

COPY public.tokens_temporales (id_token, token, tipo_accion, fecha_creacion, fecha_expiracion, estado_uso, id_usuario, canal, reset_token, fecha_verificacion, intentos) FROM stdin;
\.

COPY public.transacciones (id_transaccion, id_billetera, monto, tipo, estado, fecha, folio, concepto, id_solicitud, desglose, clabe_destino, banco_destino) FROM stdin;
\.

COPY public.usuario_direcciones (id_direccion, id_usuario, etiqueta, calle, numero_exterior, numero_interior, colonia, codigo_postal, ciudad, estado, pais, latitud, longitud, es_predeterminada, creado_en) FROM stdin;
\.

COPY public.usuario_metodos_pago (id_metodo, id_usuario, titular, ultimos_4, marca_tarjeta, expiracion, token_pasarela, es_predeterminado, creado_en) FROM stdin;
\.

COPY public.verificaciones_biometricas (id_verificacion, id_usuario, desafio, proveedor, estado, resultado, fecha_creacion, fecha_expiracion, fecha_resolucion) FROM stdin;
\.

COPY public.verificaciones_ine (id_verificacion_ine, id_usuario, lado, curp, comprobaciones, hash_imagen, proveedor, fecha) FROM stdin;
\.

COPY public.configuracion_plataforma (id, comision_porcentaje, monto_minimo_retiro, radio_maximo_km, tolerancia_minutos, sensibilidad_ia, modo_mantenimiento, mensaje_mantenimiento, actualizado_en) FROM stdin;
1	15.00	100.00	25	15	Media	f	El sistema se encuentra en mantenimiento programado.	2026-09-21 15:39:26.775335
\.

COPY public.usuarios (id_usuario, nombre, apellido, correo, contrasena, fecha_registro, estado_cuenta, fecha_nacimiento, telefono, url_ine_front, url_ine_rev, fecha_actualizacion_contrasena, "2FA_Activo", "2FA_Sem", id_rol, version_sesion, biometria_estado, fecha_actualizacion, referencia_facial, estado, identidad_verificada, verificado_sep, ine_frente, ine_reverso, foto_rostro, latitud, longitud, ultima_conexion, foto_perfil, push_token, disponible, ultimo_latido, preferencias, totp_secreto, totp_pendiente, foto_archivo, anonimizado, consentimiento_privacidad, bio) FROM stdin;
1	Paolo	Benitez	Paolo@correo.com	$2b$10$vun7NvU6LCld9wiqiKxyk.CEW8rRP/pS/dQD4e6icmE18JOO0v8je	2026-05-11 11:46:33.117458	Activo	2000-05-11	0123456789	\N	\N	\N	f	\N	1	1	pendiente	2026-10-28 07:51:05.781185-06	\N	APROBADO	f	f	\N	\N	\N	\N	\N	2026-10-28 07:51:05.781185-06	\N	\N	f	\N	{}	\N	\N	\N	f	\N	\N
2	Paola	Perez	Paola@correo.com	$2b$10$0DKx9InT/.gB3lcCUZXn.ucINJyFYaqsVW7WUYGCoFOmiN8xyv3Ti	2026-05-11 11:51:14.8175	Activo	2000-05-12	1234567890	\N	\N	\N	f	\N	2	1	verificada	2026-10-28 07:51:05.781185-06	\N	APROBADO	t	f	\N	\N	\N	\N	\N	2026-10-28 07:51:05.781185-06	\N	\N	f	\N	{}	\N	\N	\N	f	\N	\N
3	Juan	Perez	Juan@corre.com	$2b$10$64YKIVF8vUSZknhTWEi/EeMtBlqiCHTruQ9k.D.r.0HMWSByr/raC	2026-05-11 12:33:07.595834	Activo	2010-05-11	9876543210	\N	\N	\N	f	\N	1	1	pendiente	2026-10-28 07:51:05.781185-06	\N	APROBADO	f	f	\N	\N	\N	\N	\N	2026-10-28 07:51:05.781185-06	\N	\N	f	\N	{}	\N	\N	\N	f	\N	\N
4	Pedro	Perez	Pedro@correo.com	$2b$10$FRRAcT5n1LQ1EcVgKtcrxeCbXFNqAwleT0BKRxdm1EBW/Spv3ul/.	2026-05-11 12:34:23.654299	Activo	1985-02-06	1234567890	\N	\N	\N	f	\N	2	1	verificada	2026-10-28 07:51:05.781185-06	\N	APROBADO	t	f	\N	\N	\N	\N	\N	2026-10-28 07:51:05.781185-06	\N	\N	f	\N	{}	\N	\N	\N	f	\N	\N
5	Arnoldo	Paez	Paez@correoreal.com	$2b$10$VgmAJJRFzvjREK9eWf6Bren17hf/jeDWT.xu8coVAdecqcCvYf.oO	2026-05-15 18:58:35.754522	Activo	2007-05-16	124567890	\N	\N	\N	f	\N	1	1	pendiente	2026-10-28 07:51:05.781185-06	\N	APROBADO	f	f	\N	\N	\N	\N	\N	2026-10-28 07:51:05.781185-06	\N	\N	f	\N	{}	\N	\N	\N	f	\N	\N
19	X	D	sincorreo@sincorreo.com	$2b$10$HLv3flTJ0WmIhywqm9WITutLPU7u1pT.wo.Un2DgTR1bJ.U4DRqoC	2026-05-17 15:28:03.520326	No verificado	2002-07-22	1234567890	\N	\N	\N	f	\N	1	1	pendiente	2026-10-28 07:51:05.781185-06	\N	APROBADO	f	f	\N	\N	\N	\N	\N	2026-10-28 07:51:05.781185-06	\N	\N	f	\N	{}	\N	\N	\N	f	\N	\N
20	juan	perez	correo.com	$2b$10$t4ebSZVwIzva8oZFKZvHZu9SonEtOtW0uo4KmoiBi1nc6aAAT2LW.	2026-05-17 15:29:04.777502	No verificado	2007-05-05	1289374650	\N	\N	\N	f	\N	1	1	pendiente	2026-10-28 07:51:05.781185-06	\N	APROBADO	f	f	\N	\N	\N	\N	\N	2026-10-28 07:51:05.781185-06	\N	\N	f	\N	{}	\N	\N	\N	f	\N	\N
21	Gerardo	Perez	correo@correo.com	$2b$10$0XLfvpA8g.436VQli5bxq.6J5ZCPIBl4xZ3KC4GK8JfroGlz/gyha	2026-05-17 15:30:32.430106	No verificado	2007-05-05	1289374650	\N	\N	\N	f	\N	1	1	pendiente	2026-10-28 07:51:05.781185-06	\N	APROBADO	f	f	\N	\N	\N	\N	\N	2026-10-28 07:51:05.781185-06	\N	\N	f	\N	{}	\N	\N	\N	f	\N	\N
22	xavi	Perre	nuevocorreo@nuevocorreo.com	$2b$10$s8v9r/Zd9/twqcUVK7Y1eeXxnyoTp9AObMXIz7GFTIIYaIjwjs8CC	2026-05-17 15:41:52.835834	No verificado	2003-07-26	1234567890	\N	\N	\N	f	\N	1	1	pendiente	2026-10-28 07:51:05.781185-06	\N	APROBADO	f	f	\N	\N	\N	\N	\N	2026-10-28 07:51:05.781185-06	\N	\N	f	\N	{}	\N	\N	\N	f	\N	\N
23	xavi	Perre	paolo@correo.com	$2b$10$HHRNgyimvlL2b82XO.shG.4OwBXgzV69uVN3/O4IfMoJGVzRU4EXy	2026-05-17 15:42:43.25087	No verificado	2003-07-26	1234567890	\N	\N	\N	f	\N	1	1	pendiente	2026-10-28 07:51:05.781185-06	\N	APROBADO	f	f	\N	\N	\N	\N	\N	2026-10-28 07:51:05.781185-06	\N	\N	f	\N	{}	\N	\N	\N	f	\N	\N
30	Artemio	Mora	ezequiel_artemio@hotmail.com	$2b$10$UhspKX4IpQLQEH3BDxuptO.b8OS2C0SVAf0Wt3yks3lv7/wbNvxRu	2026-05-19 02:59:23.072737	Activo	1998-09-17	1234567890	\N	\N	\N	f	\N	1	1	pendiente	2026-10-28 07:51:05.781185-06	\N	APROBADO	f	f	\N	\N	\N	\N	\N	2026-10-28 07:51:05.781185-06	\N	\N	f	\N	{}	\N	\N	\N	f	\N	\N
18	Ezequiel	Vazquez	zequivz@outlook.com	$2b$10$nrwE5wMtX3eSXOSqtIkTrOffX83X2toCkTw1fuZDrHxDeBbujmODa	2026-05-17 15:23:26.201844	Activo	2003-05-28	1234567890	\N	\N	\N	f	\N	2	6	verificada	2026-10-28 07:51:05.781185-06	\N	APROBADO	t	f	\N	\N	\N	\N	\N	2026-10-28 07:51:05.781185-06	\N	\N	f	\N	{}	\N	\N	\N	f	\N	\N
27	Ezequiel	Sosa	zequivz@hotmail.com	$2b$10$Qc0tbX9iTFGPneaufqn1.O7Q08/T2KaAwHOiTF6Z.Scshuj5Vl3Be	2026-05-19 02:17:01.604553	Activo	2003-05-28	7531538556	\N	\N	\N	f	\N	1	11	pendiente	2026-10-28 07:51:05.781185-06	\N	APROBADO	f	f	\N	\N	\N	\N	\N	2026-10-28 07:51:05.781185-06	\N	\N	f	\N	{}	\N	\N	\N	f	\N	\N
33	Juan	Perez	psg.project@outlook.es	$2b$10$o2nN0vEG6BgAvRThBOBNCepyf5ZCj7bySRUHtmKQkJ4mL5j2Ay5hC	2026-06-03 12:46:55.793648	No verificado	2003-05-28	1234567890	\N	\N	\N	f	\N	1	1	pendiente	2026-10-28 07:51:05.781185-06	\N	APROBADO	f	f	\N	\N	\N	\N	\N	2026-10-28 07:51:05.781185-06	\N	\N	f	\N	{}	\N	\N	\N	f	\N	\N
26	Alejandro	Ramírez	zequivz@gmail.com	$2a$10$9Z.zfR46V01OEnGeb3tym.mfQb.tK.BzRREJXOJsOlZp9tTXw0nGi	2026-05-18 23:32:35.315884	Activo	1990-01-01	7894561230	\N	\N	\N	f	\N	3	1	verificada	2026-10-28 07:51:05.781185-06	\N	APROBADO	t	t	\N	\N	\N	\N	\N	2026-10-28 07:51:05.781185-06	\N	\N	f	\N	{}	\N	\N	\N	f	\N	\N
36	Elba	Vazquez	clickand2serve@gmail.com	$2b$10$pGoWg95F4UNIdL3spXx3WumEMkUIbx6RnNVog9dgNwGKnBFYegu.G	2026-10-02 03:53:47.242934	Activo	2007-09-29	7531538556	\N	\N	\N	f	\N	3	1	verificada	2026-10-28 07:51:05.781185-06	\N	APROBADO	t	t	\N	\N	\N	\N	\N	2026-10-28 07:51:05.781185-06	\N	\N	f	\N	{}	\N	\N	\N	f	\N	\N
101	Cliente	Prueba	cliente.prueba@clickserve.test	$2b$10$KJp9zmdOISJ2UIyAiwZJ7eD3sl/E8W9gnFndUUgamMsJ1ARGB613C	2026-10-28 07:51:05.781185	Activo	1995-01-01	2220000001	\N	\N	2026-10-28 07:51:05.781185	f	\N	1	1	verificada	2026-10-28 07:51:05.781185-06	\N	APROBADO	t	f	\N	\N	\N	\N	\N	2026-10-28 07:51:05.781185-06	\N	\N	f	\N	{}	\N	\N	\N	f	\N	\N
102	Tecnico	Prueba	tecnico.prueba@clickserve.test	$2b$10$0MUOcIxXbp0XsEg//flfse6LTOApG7kc6dSC0Piy9nlowpMFPYHRq	2026-10-28 07:51:05.781185	Activo	1990-01-01	2220000002	\N	\N	2026-10-28 07:51:05.781185	f	\N	2	1	verificada	2026-10-28 07:51:05.781185-06	\N	APROBADO	t	t	\N	\N	\N	\N	\N	2026-10-28 07:51:05.781185-06	\N	\N	f	\N	{}	\N	\N	\N	f	\N	\N
\.

COPY public.sesiones_activas (id_sesion, id_usuario, dispositivo, fecha_creacion, estado, id_rol) FROM stdin;
644a9ad2-4c34-4aca-a913-1dad519a7425	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 OPR/131.0.0.0	2026-06-01 12:47:57.435178	revocada	3
95ef7368-8be4-405c-bdac-8c5f8b829476	18	Expo/1017756 CFNetwork/3860.500.112 Darwin/25.4.0	2026-05-18 20:53:44.529459	activa	\N
b11074d3-d43d-4930-ade9-cbd7ca2e4a98	18	okhttp/4.12.0	2026-05-18 20:54:03.434927	activa	\N
55438b78-86ea-40e3-8f21-d6b1c64985c4	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 OPR/131.0.0.0	2026-05-18 23:56:39.0152	revocada	3
976a8195-1365-4d9d-9d97-0dbff106db7b	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 OPR/131.0.0.0	2026-05-19 00:03:26.941403	revocada	3
b8d405aa-5d73-4db9-9982-14c63938fc12	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 OPR/131.0.0.0	2026-05-19 00:08:06.299857	revocada	3
8fb5518b-20ab-4cc1-ab51-3b837f4f8b66	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 OPR/131.0.0.0	2026-05-19 00:14:19.579115	revocada	3
ff6cf0bf-fa48-432a-99fd-383034ca2efe	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 OPR/131.0.0.0	2026-05-18 23:36:21.68738	revocada	3
7bab587b-c58c-4a16-ad73-2b7c3059d778	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 OPR/131.0.0.0	2026-05-18 23:34:06.761815	revocada	3
ebdf1b16-aa6b-4807-88b9-2ff5cff24079	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 OPR/131.0.0.0	2026-05-19 00:15:12.735941	revocada	3
90780dba-520c-4327-a280-1ba31849234a	18	Expo/1017756 CFNetwork/3860.500.112 Darwin/25.4.0	2026-05-18 22:13:38.658114	revocada	2
e31a9dc8-e32a-44a4-b520-4bceae76b181	27	Expo/1017756 CFNetwork/3860.500.112 Darwin/25.4.0	2026-05-19 02:24:30.310803	revocada	1
cc40a9b0-f1c1-4ccf-91bb-d7625bb0032a	27	okhttp/4.12.0	2026-05-19 02:28:09.551935	revocada	1
401e3c5d-7fc1-4571-9e3f-b4a0cc458103	27	okhttp/4.12.0	2026-05-19 02:39:01.212115	revocada	1
a4dcdb15-9396-41c3-9a88-1a2e3389352b	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 OPR/131.0.0.0	2026-05-19 03:06:08.705522	revocada	3
715c3e55-a807-4dca-b0a5-e6b683a9f463	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 OPR/131.0.0.0	2026-05-19 00:24:59.851608	revocada	3
4a120f8e-3d35-4d49-a7d6-9b9201868961	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 OPR/131.0.0.0	2026-05-19 00:42:36.291788	revocada	3
1affb3e1-e008-443f-b1da-4549440a3fb0	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 OPR/131.0.0.0	2026-05-19 00:43:10.896514	revocada	3
b8686668-4852-4ddb-a3f9-86fd8a923737	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 OPR/131.0.0.0	2026-05-19 00:43:45.73489	revocada	3
3a380d9d-e1ab-4816-9044-c3005d112cb9	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 OPR/131.0.0.0	2026-05-19 03:07:44.003448	revocada	3
ab2bbc58-4321-4b46-83ad-978760ffb91f	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 OPR/131.0.0.0	2026-06-01 11:35:42.981227	revocada	3
cfcbce23-dc15-40f0-a528-93592bde5f87	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 OPR/131.0.0.0	2026-06-01 11:36:29.350509	revocada	3
c17395d5-f78f-4a8b-a0a1-ea50f2d1322e	27	Expo/1017756 CFNetwork/3860.300.31 Darwin/25.2.0	2026-06-02 08:24:21.1335	revocada	1
12a51840-9993-4a84-b220-cf4ec844873a	27	Expo/1017756 CFNetwork/3860.300.31 Darwin/25.2.0	2026-06-02 08:33:00.103789	revocada	1
0bde94d6-948a-473d-afe1-7fa9068cd6fc	27	Expo/1017756 CFNetwork/3860.500.112 Darwin/25.4.0	2026-05-19 02:35:32.184164	revocada	1
1fffa1c7-42a8-4943-9847-d877026b1be3	27	Expo/1017756 CFNetwork/3860.600.12 Darwin/25.5.0	2026-06-01 19:44:21.612927	revocada	1
57fbab20-fb11-4134-9f1a-f99daa35405f	27	Expo/1017756 CFNetwork/3860.600.12 Darwin/25.5.0	2026-06-01 19:47:20.465609	revocada	1
b45be04e-55cf-46ec-bc42-82ceccdd0257	27	Expo/1017756 CFNetwork/3860.600.12 Darwin/25.5.0	2026-06-01 19:49:54.947065	revocada	1
fdd89d25-af74-4ac4-b9a6-a3069e790461	27	Expo/1017756 CFNetwork/3860.600.12 Darwin/25.5.0	2026-06-02 08:36:23.542236	revocada	1
f44b8fc4-5eb0-47f2-a3a4-2b280a13e214	27	Expo/1017756 CFNetwork/3860.600.12 Darwin/25.5.0	2026-06-02 21:58:11.747123	revocada	1
3b129e40-d96a-4726-8be3-45d61dbdc015	27	Expo/1017756 CFNetwork/3860.600.12 Darwin/25.5.0	2026-06-02 22:16:03.714527	revocada	1
9d25512c-9438-4148-a00e-daec4b76678b	18	Expo/1017756 CFNetwork/3860.500.112 Darwin/25.4.0	2026-05-19 02:22:13.845868	revocada	2
319118c7-f19b-49fd-a07b-80f6abc14c15	18	Expo/1017756 CFNetwork/3860.600.12 Darwin/25.5.0	2026-06-01 19:45:31.339181	revocada	2
4fcdb39f-e66b-4712-8d96-5dd6c64cb775	18	Expo/1017756 CFNetwork/3860.600.12 Darwin/25.5.0	2026-06-01 19:51:11.200828	revocada	2
a784b970-a7eb-41f7-8740-7c4297c2e131	18	Expo/1017756 CFNetwork/3860.300.31 Darwin/25.2.0	2026-06-02 08:31:33.769929	revocada	2
3ae73b9e-052f-4ff9-b772-db6ef2cb4399	18	Expo/1017756 CFNetwork/3860.600.12 Darwin/25.5.0	2026-06-02 21:56:36.729366	revocada	2
a6cdd1e6-cb38-4d27-b070-506101ecc36f	27	Expo/1017756 CFNetwork/3860.600.12 Darwin/25.5.0	2026-06-03 07:22:58.167114	revocada	1
324631cc-f959-44c0-aad8-63f9eab7a04e	27	Expo/1017756 CFNetwork/3860.600.12 Darwin/25.5.0	2026-06-03 08:58:39.938798	revocada	1
5edc24ac-74c5-4555-ba5a-c7dabde15d24	27	Expo/1017756 CFNetwork/3860.300.31 Darwin/25.2.0	2026-06-03 10:53:18.279414	revocada	1
11f7c943-bdec-4bd8-bfa4-e00abf40a072	27	Expo/1017756 CFNetwork/3860.300.31 Darwin/25.2.0	2026-06-03 10:55:11.593552	revocada	1
06f8d168-1b0e-4e47-9e0b-bbcb8d6461cd	27	Expo/1017756 CFNetwork/3860.300.31 Darwin/25.2.0	2026-06-03 11:01:19.965608	revocada	1
9c21f8b9-1ba7-4ed8-9366-c9a0adcf66d8	27	Expo/1017756 CFNetwork/3860.300.31 Darwin/25.2.0	2026-06-03 11:07:36.165469	revocada	1
ba6bbc2e-b2d0-4211-a22b-5d73c0bb39a1	27	Expo/1017756 CFNetwork/3860.300.31 Darwin/25.2.0	2026-06-03 11:08:59.65552	revocada	1
8c5a337c-3c70-45b3-9b97-1c04968ffbe0	18	Expo/1017756 CFNetwork/3860.600.12 Darwin/25.5.0	2026-06-03 07:23:41.24053	revocada	2
e6109666-dc78-4b58-9b6c-e62a51045a18	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 OPR/131.0.0.0	2026-06-03 08:03:31.853607	revocada	3
72337b11-2063-4120-b6cb-a0d1d578a3c7	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 OPR/131.0.0.0	2026-06-01 12:57:48.845702	revocada	3
bef03483-b87d-4f58-adc8-c5886b0d4923	27	Expo/1017756 CFNetwork/3860.600.12 Darwin/25.5.0	2026-06-03 11:46:24.126575	revocada	1
663f7f62-7dce-4260-9ebe-f395c84c4514	27	Expo/1017756 CFNetwork/3860.300.31 Darwin/25.2.0	2026-06-03 11:47:20.144855	revocada	1
c5b2c37d-918d-4cf3-bc2c-04c59f5ec1ca	27	Expo/1017756 CFNetwork/3860.600.12 Darwin/25.5.0	2026-06-03 11:48:40.982314	revocada	1
b4f1a3ac-d0ab-4bcf-af9d-f5ff8a163e94	27	Expo/1017756 CFNetwork/3860.300.31 Darwin/25.2.0	2026-06-03 11:48:43.675631	revocada	1
490d9c1d-37ee-42b0-b5d1-2d9de55e1a58	27	Expo/1017756 CFNetwork/3860.300.31 Darwin/25.2.0	2026-06-03 12:42:32.361508	revocada	1
8ee9e254-89b2-4e45-aec0-96de98ee70ef	27	Expo/1017756 CFNetwork/3860.600.12 Darwin/25.5.0	2026-06-03 12:43:31.319983	revocada	1
a2013f63-94fe-4584-bb04-a1001619e995	18	Expo/1017756 CFNetwork/3860.600.12 Darwin/25.5.0	2026-06-03 12:45:00.078653	revocada	2
432c9e56-106d-4ba8-bc8d-96c4e8be65b0	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 OPR/131.0.0.0	2026-06-03 11:33:55.336289	revocada	3
b459dfe9-4668-4f17-9ad8-d7e00c9acb59	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 OPR/131.0.0.0	2026-06-03 08:05:06.785198	revocada	3
8d270246-5bfe-49a9-9699-faa0ebf6ce72	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 OPR/131.0.0.0	2026-06-03 08:05:54.38323	revocada	3
df427a81-5ae4-440c-87d1-14a82c121d92	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 OPR/131.0.0.0	2026-06-03 08:06:21.512584	revocada	3
55a43621-18df-461d-a8b3-a5f7093210a8	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 OPR/131.0.0.0	2026-06-03 08:06:44.519398	revocada	3
47a9ee82-f575-476b-9f26-3291dadda77a	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 OPR/136.0.0.0	2026-10-02 03:15:23.625364	activa	3
1cc463cc-a69a-4144-be5f-2467f17729aa	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 OPR/135.0.0.0	2026-09-21 15:41:18.814329	revocada	3
3234adbf-808f-4ee7-8927-49c3d5158e86	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 OPR/135.0.0.0	2026-09-21 10:22:39.398706	revocada	3
3f2ea23f-59c0-4d58-ad54-95259de8b2cf	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 OPR/135.0.0.0	2026-09-21 09:42:56.736894	revocada	3
56b07c5e-03db-4998-9fc0-cc87f409ac7a	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 OPR/134.0.0.0	2026-08-27 10:13:55.263286	revocada	3
5e9ffb03-73e1-458f-8500-a873f16cc979	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 OPR/131.0.0.0	2026-06-03 12:45:06.565787	revocada	3
9e9a658c-4e58-4c8b-94df-c27a8e1c3fa8	36	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 OPR/136.0.0.0	2026-10-02 03:55:40.96384	activa	3
fb07173f-3521-42a9-99c1-762defd6888f	36	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 OPR/136.0.0.0	2026-10-02 10:06:26.043379	activa	3
bd12c6ab-a812-4fc9-b4e1-3e382943febc	36	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 OPR/136.0.0.0	2026-10-02 10:25:08.553627	activa	3
9c4872d4-0ca8-4e5d-9e7c-840f0c307f3f	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 OPR/136.0.0.0	2026-10-20 02:19:58.619113	activa	3
362ab54c-839f-475e-81b7-2e461b2e0c24	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 OPR/136.0.0.0	2026-10-20 09:27:24.630757	activa	3
93d7bc07-0920-4929-9a4f-e4033beb605b	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 OPR/136.0.0.0	2026-10-20 09:50:02.398012	activa	3
d7965770-cc50-47dc-9c97-64c2eee7618e	26	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 OPR/136.0.0.0	2026-10-20 10:08:37.613118	activa	3
\.

COPY public.tokens_temporales (id_token, token, tipo_accion, fecha_creacion, fecha_expiracion, estado_uso, id_usuario, canal, reset_token, fecha_verificacion, intentos) FROM stdin;
48	8283	recuperacion	2026-06-02 22:14:53.208983	2026-06-02 22:29:53.208983	expirado	27	EMAIL	\N	\N	0
49	6948	recuperacion	2026-06-02 22:16:17.5951	2026-06-02 22:31:17.5951	expirado	27	EMAIL	\N	\N	0
12	4491	registro	2026-05-17 15:23:26.217377	2026-05-17 15:38:26.217377	expirado	18	EMAIL	\N	\N	0
13	2976	registro	2026-05-17 15:23:47.265311	2026-05-17 15:38:47.265311	usado	18	EMAIL	\N	\N	0
14	8975	registro	2026-05-17 15:28:03.523948	2026-05-17 15:43:03.523948	sin usar	19	EMAIL	\N	\N	0
15	2680	registro	2026-05-17 15:29:04.783824	2026-05-17 15:44:04.783824	sin usar	20	EMAIL	\N	\N	0
16	4707	registro	2026-05-17 15:30:32.435119	2026-05-17 15:45:32.435119	sin usar	21	EMAIL	\N	\N	0
17	5253	registro	2026-05-17 15:41:52.854866	2026-05-17 15:56:52.854866	sin usar	22	EMAIL	\N	\N	0
18	6752	registro	2026-05-17 15:42:43.256436	2026-05-17 15:57:43.256436	sin usar	23	EMAIL	\N	\N	0
50	1689	recuperacion	2026-06-02 22:17:13.185875	2026-06-02 22:32:13.185875	usado	27	EMAIL	\N	\N	0
51	4004	recuperacion	2026-06-03 07:24:47.324324	2026-06-03 07:39:47.324324	expirado	27	EMAIL	\N	\N	0
19	5479	recuperacion	2026-05-17 19:40:21.092217	2026-05-17 19:55:21.092217	usado	18	EMAIL	\N	\N	0
75	966242	login_admin	2026-10-02 10:24:47.859312	2026-10-02 10:39:47.859312	usado	36	EMAIL	\N	\N	0
52	3176	recuperacion	2026-06-03 07:28:05.912107	2026-06-03 07:43:05.912107	usado	27	EMAIL	\N	\N	0
25	724568	login_admin	2026-05-19 00:19:15.161735	2026-05-19 00:34:15.161735	expirado	26	EMAIL	\N	\N	0
26	544397	login_admin	2026-05-19 00:24:28.077455	2026-05-19 00:39:28.077455	usado	26	EMAIL	\N	\N	0
27	239435	login_admin	2026-05-19 00:41:59.440539	2026-05-19 00:56:59.440539	usado	26	EMAIL	\N	\N	0
28	934648	login_admin	2026-05-19 00:42:57.034185	2026-05-19 00:57:57.034185	usado	26	EMAIL	\N	\N	0
29	630801	login_admin	2026-05-19 00:43:32.50569	2026-05-19 00:58:32.50569	usado	26	EMAIL	\N	\N	0
30	9140	registro	2026-05-19 02:17:01.609068	2026-05-19 02:32:01.609068	usado	27	EMAIL	\N	\N	0
32	1763	recuperacion	2026-05-19 02:21:26.089451	2026-05-19 02:36:26.089451	verificado	18	EMAIL	\N	\N	0
20	7931	recuperacion	2026-05-17 19:42:34.750471	2026-05-17 19:57:34.750471	usado	18	EMAIL	\N	\N	0
53	375023	login_admin	2026-06-03 07:56:45.166174	2026-06-03 08:11:45.166174	expirado	26	EMAIL	\N	\N	0
35	4638	registro	2026-05-19 02:59:23.076076	2026-05-19 03:14:23.076076	expirado	30	EMAIL	\N	\N	0
36	4606	registro	2026-05-19 02:59:48.581664	2026-05-19 03:14:48.581664	usado	30	EMAIL	\N	\N	0
37	830614	login_admin	2026-05-19 03:05:38.335998	2026-05-19 03:20:38.335998	usado	26	EMAIL	\N	\N	0
38	883972	login_admin	2026-05-19 03:07:13.754927	2026-05-19 03:22:13.754927	usado	26	EMAIL	\N	\N	0
39	296344	login_admin	2026-06-01 11:35:13.324436	2026-06-01 11:50:13.324436	usado	26	EMAIL	\N	\N	0
40	978058	login_admin	2026-06-01 11:36:09.681662	2026-06-01 11:51:09.681662	usado	26	EMAIL	\N	\N	0
41	571624	login_admin	2026-06-01 12:47:43.495172	2026-06-01 13:02:43.495172	usado	26	EMAIL	\N	\N	0
42	828262	login_admin	2026-06-01 12:57:13.707998	2026-06-01 13:12:13.707998	usado	26	EMAIL	\N	\N	0
43	2084	recuperacion	2026-06-01 19:38:50.107856	2026-06-01 19:53:50.107856	usado	27	EMAIL	\N	\N	0
44	7676	recuperacion	2026-06-01 19:44:48.468922	2026-06-01 19:59:48.468922	verificado	18	EMAIL	\N	\N	0
21	7421	recuperacion	2026-05-17 19:54:17.959719	2026-05-17 20:09:17.959719	usado	18	EMAIL	\N	\N	0
54	894920	login_admin	2026-06-03 07:58:11.05306	2026-06-03 08:13:11.05306	expirado	26	EMAIL	\N	\N	0
47	1770	recuperacion	2026-06-02 21:57:02.880424	2026-06-02 22:12:02.880424	usado	27	EMAIL	\N	\N	0
45	1051	recuperacion	2026-06-02 21:54:45.368604	2026-06-02 22:09:45.368604	expirado	27	EMAIL	\N	\N	0
46	3240	recuperacion	2026-06-02 21:55:48.086897	2026-06-02 22:10:48.086897	expirado	27	EMAIL	\N	\N	0
55	912786	login_admin	2026-06-03 08:03:17.83997	2026-06-03 08:18:17.83997	usado	26	EMAIL	\N	\N	0
56	363938	login_admin	2026-06-03 08:04:53.912765	2026-06-03 08:19:53.912765	usado	26	EMAIL	\N	\N	0
57	897990	login_admin	2026-06-03 08:05:41.38358	2026-06-03 08:20:41.38358	usado	26	EMAIL	\N	\N	0
58	472235	login_admin	2026-06-03 08:06:08.976762	2026-06-03 08:21:08.976762	usado	26	EMAIL	\N	\N	0
59	449879	login_admin	2026-06-03 08:06:32.219386	2026-06-03 08:21:32.219386	usado	26	EMAIL	\N	\N	0
60	2382	recuperacion	2026-06-03 10:55:40.179021	2026-06-03 11:10:40.179021	expirado	27	EMAIL	\N	\N	0
61	2821	recuperacion	2026-06-03 11:10:05.926644	2026-06-03 11:25:05.926644	usado	27	EMAIL	\N	\N	0
62	413315	login_admin	2026-06-03 11:33:26.443824	2026-06-03 11:48:26.443824	usado	26	EMAIL	\N	\N	0
63	450872	login_admin	2026-06-03 12:40:53.546656	2026-06-03 12:55:53.546656	usado	26	EMAIL	\N	\N	0
64	1805	registro	2026-06-03 12:46:55.843071	2026-06-03 13:01:55.843071	expirado	33	EMAIL	\N	\N	0
65	4844	registro	2026-06-03 12:47:42.329605	2026-06-03 13:02:42.329605	sin usar	33	EMAIL	\N	\N	0
66	687461	login_admin	2026-08-27 10:13:15.507476	2026-08-27 10:28:15.507476	usado	26	EMAIL	\N	\N	0
67	962826	login_admin	2026-09-21 09:42:35.12417	2026-09-21 09:57:35.12417	usado	26	EMAIL	\N	\N	0
68	800759	login_admin	2026-09-21 10:22:19.583206	2026-09-21 10:37:19.583206	usado	26	EMAIL	\N	\N	0
69	706316	login_admin	2026-09-21 15:41:04.80968	2026-09-21 15:56:04.80968	usado	26	EMAIL	\N	\N	0
70	317084	login_admin	2026-10-02 03:15:05.900776	2026-10-02 03:30:05.900776	usado	26	EMAIL	\N	\N	0
72	9152	registro	2026-10-02 03:53:47.250626	2026-10-02 04:08:47.250626	usado	36	EMAIL	\N	\N	0
73	636689	login_admin	2026-10-02 03:55:18.026803	2026-10-02 04:10:18.026803	usado	36	EMAIL	\N	\N	0
74	199211	login_admin	2026-10-02 10:06:04.964245	2026-10-02 10:21:04.964245	usado	36	EMAIL	\N	\N	0
76	288848	login_admin	2026-10-20 02:19:42.068842	2026-10-20 02:34:42.068842	usado	26	EMAIL	\N	\N	0
77	241537	login_admin	2026-10-20 09:26:56.216861	2026-10-20 09:41:56.216861	usado	26	EMAIL	\N	\N	0
31	9505	recuperacion	2026-05-19 02:21:03.244371	2026-05-19 02:36:03.244371	expirado	18	EMAIL	\N	\N	0
78	2452	recuperacion	2026-10-20 09:35:52.520271	2026-10-20 09:50:52.520271	sin usar	18	EMAIL	\N	\N	0
79	809187	login_admin	2026-10-20 09:48:16.117046	2026-10-20 10:03:16.117046	usado	26	EMAIL	\N	\N	0
80	452166	login_admin	2026-10-20 10:08:15.330593	2026-10-20 10:23:15.330593	usado	26	EMAIL	\N	\N	0
\.

-- =============================================================================
-- LLAVES PRIMARIAS Y RESTRICCIONES UNIQUE / CHECK
-- =============================================================================

ALTER TABLE ONLY public.archivos
    ADD CONSTRAINT archivos_pkey PRIMARY KEY (id_archivo);
ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id_auditoria);
ALTER TABLE ONLY public.billetera_tecnico
    ADD CONSTRAINT billetera_tecnico_id_usuario_key UNIQUE (id_usuario);
ALTER TABLE ONLY public.billetera_tecnico
    ADD CONSTRAINT billetera_tecnico_pkey PRIMARY KEY (id_billetera);
ALTER TABLE ONLY public.calificaciones_servicio
    ADD CONSTRAINT calificaciones_servicio_id_solicitud_key UNIQUE (id_solicitud);
ALTER TABLE ONLY public.calificaciones_servicio
    ADD CONSTRAINT calificaciones_servicio_pkey PRIMARY KEY (id_calificacion);
ALTER TABLE ONLY public.categorias_servicio
    ADD CONSTRAINT categorias_servicio_codigo_key UNIQUE (codigo);
ALTER TABLE ONLY public.categorias_servicio
    ADD CONSTRAINT categorias_servicio_pkey PRIMARY KEY (id_categoria);
ALTER TABLE ONLY public.conceptos_cotizacion
    ADD CONSTRAINT conceptos_cotizacion_pkey PRIMARY KEY (id_concepto);
ALTER TABLE ONLY public.cotizaciones_servicio
    ADD CONSTRAINT cotizaciones_servicio_pkey PRIMARY KEY (id_cotizacion);
ALTER TABLE ONLY public.direcciones
    ADD CONSTRAINT direcciones_pkey PRIMARY KEY (id_direccion);
ALTER TABLE ONLY public.documentos_usuario
    ADD CONSTRAINT documentos_usuario_pkey PRIMARY KEY (id_documento);
ALTER TABLE ONLY public.especialidades_tecnico
    ADD CONSTRAINT especialidades_tecnico_pkey PRIMARY KEY (id_especialidad);
ALTER TABLE ONLY public.estados_cuenta
    ADD CONSTRAINT estados_cuenta_pkey PRIMARY KEY (codigo);
ALTER TABLE ONLY public.estados_pago
    ADD CONSTRAINT estados_pago_pkey PRIMARY KEY (codigo);
ALTER TABLE ONLY public.estados_solicitud
    ADD CONSTRAINT estados_solicitud_pkey PRIMARY KEY (id_estado);
ALTER TABLE ONLY public.evidencias_servicio
    ADD CONSTRAINT evidencias_servicio_pkey PRIMARY KEY (id_evidencia);
ALTER TABLE ONLY public.idempotencia
    ADD CONSTRAINT idempotencia_pkey PRIMARY KEY (clave, id_usuario);
ALTER TABLE ONLY public.incidencias
    ADD CONSTRAINT incidencias_folio_key UNIQUE (folio);
ALTER TABLE ONLY public.incidencias
    ADD CONSTRAINT incidencias_pkey PRIMARY KEY (id_incidencia);
ALTER TABLE ONLY public.mensajes_chat
    ADD CONSTRAINT mensajes_chat_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.metodos_pago
    ADD CONSTRAINT metodos_pago_pkey PRIMARY KEY (id_metodo);
ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_id_solicitud_key UNIQUE (id_solicitud);
ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_pkey PRIMARY KEY (id_pago);
ALTER TABLE ONLY public.permiso
    ADD CONSTRAINT permiso_clave_permiso_key UNIQUE (clave_permiso);
ALTER TABLE ONLY public.permiso
    ADD CONSTRAINT permiso_pkey PRIMARY KEY (id_permiso);
ALTER TABLE ONLY public.portafolio_tecnico
    ADD CONSTRAINT portafolio_tecnico_pkey PRIMARY KEY (id_item);
ALTER TABLE ONLY public.reprogramaciones
    ADD CONSTRAINT reprogramaciones_pkey PRIMARY KEY (id_reprogramacion);
ALTER TABLE ONLY public.retos_2fa
    ADD CONSTRAINT retos_2fa_pkey PRIMARY KEY (id_reto);
ALTER TABLE ONLY public.rol_permiso
    ADD CONSTRAINT rol_permiso_pkey PRIMARY KEY (id_rol_permiso);
ALTER TABLE ONLY public.rol
    ADD CONSTRAINT rol_pkey PRIMARY KEY (id_rol);
ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_key UNIQUE (nombre);
ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id_rol);
ALTER TABLE ONLY public.schema_migraciones
    ADD CONSTRAINT schema_migraciones_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.sesiones_activas
    ADD CONSTRAINT sesiones_activas_pkey PRIMARY KEY (id_sesion);
ALTER TABLE ONLY public.solicitud_imagenes
    ADD CONSTRAINT solicitud_imagenes_pkey PRIMARY KEY (id_imagen);
ALTER TABLE ONLY public.solicitudes_descartadas
    ADD CONSTRAINT solicitudes_descartadas_pkey PRIMARY KEY (id_solicitud, id_tecnico);
ALTER TABLE ONLY public.solicitudes_servicio
    ADD CONSTRAINT solicitudes_servicio_folio_key UNIQUE (folio);
ALTER TABLE ONLY public.solicitudes_servicio
    ADD CONSTRAINT solicitudes_servicio_pkey PRIMARY KEY (id_solicitud);
ALTER TABLE ONLY public.soporte_mensajes
    ADD CONSTRAINT soporte_mensajes_pkey PRIMARY KEY (id_mensaje);
ALTER TABLE ONLY public.soporte_tickets
    ADD CONSTRAINT soporte_tickets_folio_key UNIQUE (folio);
ALTER TABLE ONLY public.soporte_tickets
    ADD CONSTRAINT soporte_tickets_pkey PRIMARY KEY (id_ticket);
ALTER TABLE ONLY public.tareas_servicio
    ADD CONSTRAINT tareas_servicio_pkey PRIMARY KEY (id_tarea);
ALTER TABLE ONLY public.tokens_temporales
    ADD CONSTRAINT tokens_temporales_pkey PRIMARY KEY (id_token);
ALTER TABLE ONLY public.transacciones
    ADD CONSTRAINT transacciones_pkey PRIMARY KEY (id_transaccion);
ALTER TABLE ONLY public.especialidades_tecnico
    ADD CONSTRAINT uq_usuario_especialidad UNIQUE (id_usuario, nombre);
ALTER TABLE ONLY public.usuario_direcciones
    ADD CONSTRAINT usuario_direcciones_pkey PRIMARY KEY (id_direccion);
ALTER TABLE ONLY public.usuario_metodos_pago
    ADD CONSTRAINT usuario_metodos_pago_pkey PRIMARY KEY (id_metodo);
ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_correo_key UNIQUE (correo);
ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id_usuario);
ALTER TABLE ONLY public.verificaciones_biometricas
    ADD CONSTRAINT verificaciones_biometricas_desafio_key UNIQUE (desafio);
ALTER TABLE ONLY public.verificaciones_biometricas
    ADD CONSTRAINT verificaciones_biometricas_pkey PRIMARY KEY (id_verificacion);
ALTER TABLE ONLY public.verificaciones_ine
    ADD CONSTRAINT verificaciones_ine_pkey PRIMARY KEY (id_verificacion_ine);
ALTER TABLE ONLY public.configuracion_plataforma ADD CONSTRAINT configuracion_plataforma_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.servicios ADD CONSTRAINT servicios_pkey PRIMARY KEY (id_servicio);
ALTER TABLE ONLY public.expedientes_tecnicos ADD CONSTRAINT expedientes_tecnicos_pkey PRIMARY KEY (id_expediente);
ALTER TABLE ONLY public.expedientes_tecnicos ADD CONSTRAINT expedientes_tecnicos_id_usuario_key UNIQUE (id_usuario);
ALTER TABLE ONLY public.disputas ADD CONSTRAINT disputas_pkey PRIMARY KEY (id_disputa);
ALTER TABLE ONLY public.solicitudes_retiro ADD CONSTRAINT solicitudes_retiro_pkey PRIMARY KEY (id_retiro);
ALTER TABLE ONLY public.cotizaciones ADD CONSTRAINT cotizaciones_pkey PRIMARY KEY (id_cotizacion);
ALTER TABLE ONLY public.historial_estados_servicio ADD CONSTRAINT historial_estados_servicio_pkey PRIMARY KEY (id_historial);
ALTER TABLE ONLY public.resenas ADD CONSTRAINT resenas_pkey PRIMARY KEY (id_resena);
ALTER TABLE ONLY public.resenas ADD CONSTRAINT resenas_id_solicitud_key UNIQUE (id_solicitud);
ALTER TABLE ONLY public.resenas ADD CONSTRAINT resenas_calificacion_check CHECK (((calificacion >= 1) AND (calificacion <= 5)));

-- =============================================================================
-- ÍNDICES DE RENDIMIENTO
-- =============================================================================

CREATE INDEX auditoria_usuario_fecha_idx ON public.auditoria USING btree (id_usuario, fecha DESC);
CREATE INDEX conceptos_solicitud_idx ON public.conceptos_cotizacion USING btree (id_solicitud);
CREATE INDEX idempotencia_creado_idx ON public.idempotencia USING btree (creado);
CREATE INDEX idx_calificaciones_tecnico ON public.calificaciones_servicio USING btree (id_tecnico);
CREATE INDEX idx_cotizaciones_solicitud ON public.cotizaciones_servicio USING btree (id_solicitud);
CREATE INDEX idx_evidencias_solicitud ON public.evidencias_servicio USING btree (id_solicitud);
CREATE INDEX idx_usuario_direcciones_usuario ON public.usuario_direcciones USING btree (id_usuario);
CREATE INDEX idx_usuario_metodos_pago_usuario ON public.usuario_metodos_pago USING btree (id_usuario);
CREATE INDEX mensajes_chat_solicitud_fecha_idx ON public.mensajes_chat USING btree (id_solicitud, fecha_envio);
CREATE INDEX sesiones_usuario_estado_idx ON public.sesiones_activas USING btree (id_usuario, estado);
CREATE INDEX solicitudes_estado_idx ON public.solicitudes_servicio USING btree (estado);
CREATE INDEX solicitudes_tecnico_idx ON public.solicitudes_servicio USING btree (id_tecnico, estado);
CREATE INDEX solicitudes_usuario_fecha_idx ON public.solicitudes_servicio USING btree (id_usuario, fecha_creacion DESC);
CREATE INDEX soporte_mensajes_ticket_idx ON public.soporte_mensajes USING btree (id_ticket, fecha_envio);
CREATE INDEX tareas_solicitud_idx ON public.tareas_servicio USING btree (id_solicitud);
CREATE INDEX tokens_usuario_tipo_idx ON public.tokens_temporales USING btree (id_usuario, tipo_accion, estado_uso);
CREATE UNIQUE INDEX transacciones_folio_uq ON public.transacciones USING btree (folio) WHERE (folio IS NOT NULL);
CREATE INDEX verificaciones_ine_usuario_idx ON public.verificaciones_ine USING btree (id_usuario);
CREATE INDEX verificaciones_usuario_estado_idx ON public.verificaciones_biometricas USING btree (id_usuario, estado);
CREATE INDEX IF NOT EXISTS idx_servicios_estatus ON public.servicios (estatus);
CREATE INDEX IF NOT EXISTS idx_servicios_id_usuario ON public.servicios (id_usuario);
CREATE INDEX IF NOT EXISTS idx_servicios_id_tecnico ON public.servicios (id_tecnico);
CREATE INDEX IF NOT EXISTS idx_servicios_fecha ON public.servicios (fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_disputas_estado ON public.disputas (estado);
CREATE INDEX IF NOT EXISTS idx_expedientes_estatus ON public.expedientes_tecnicos (estatus);
CREATE INDEX IF NOT EXISTS idx_solicitudes_retiro_estado ON public.solicitudes_retiro (estado);
CREATE INDEX IF NOT EXISTS idx_pagos_id_servicio ON public.pagos (id_servicio);

-- =============================================================================
-- LLAVES FORÁNEAS (RELACIONES)
-- =============================================================================

ALTER TABLE ONLY public.archivos
    ADD CONSTRAINT archivos_id_propietario_fkey FOREIGN KEY (id_propietario) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;
ALTER TABLE ONLY public.billetera_tecnico
    ADD CONSTRAINT billetera_tecnico_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;
ALTER TABLE ONLY public.calificaciones_servicio
    ADD CONSTRAINT calificaciones_servicio_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.usuarios(id_usuario);
ALTER TABLE ONLY public.calificaciones_servicio
    ADD CONSTRAINT calificaciones_servicio_id_solicitud_fkey FOREIGN KEY (id_solicitud) REFERENCES public.solicitudes_servicio(id_solicitud) ON DELETE CASCADE;
ALTER TABLE ONLY public.calificaciones_servicio
    ADD CONSTRAINT calificaciones_servicio_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES public.usuarios(id_usuario);
ALTER TABLE ONLY public.conceptos_cotizacion
    ADD CONSTRAINT conceptos_cotizacion_id_cotizacion_fkey FOREIGN KEY (id_cotizacion) REFERENCES public.cotizaciones_servicio(id_cotizacion) ON DELETE CASCADE;
ALTER TABLE ONLY public.conceptos_cotizacion
    ADD CONSTRAINT conceptos_cotizacion_id_solicitud_fkey FOREIGN KEY (id_solicitud) REFERENCES public.solicitudes_servicio(id_solicitud) ON DELETE CASCADE;
ALTER TABLE ONLY public.cotizaciones_servicio
    ADD CONSTRAINT cotizaciones_servicio_id_solicitud_fkey FOREIGN KEY (id_solicitud) REFERENCES public.solicitudes_servicio(id_solicitud) ON DELETE CASCADE;
ALTER TABLE ONLY public.cotizaciones_servicio
    ADD CONSTRAINT cotizaciones_servicio_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;
ALTER TABLE ONLY public.documentos_usuario
    ADD CONSTRAINT documentos_usuario_id_archivo_fkey FOREIGN KEY (id_archivo) REFERENCES public.archivos(id_archivo) ON DELETE SET NULL;
ALTER TABLE ONLY public.documentos_usuario
    ADD CONSTRAINT documentos_usuario_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;
ALTER TABLE ONLY public.especialidades_tecnico
    ADD CONSTRAINT especialidades_tecnico_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;
ALTER TABLE ONLY public.evidencias_servicio
    ADD CONSTRAINT evidencias_servicio_id_archivo_fkey FOREIGN KEY (id_archivo) REFERENCES public.archivos(id_archivo) ON DELETE SET NULL;
ALTER TABLE ONLY public.evidencias_servicio
    ADD CONSTRAINT evidencias_servicio_id_solicitud_fkey FOREIGN KEY (id_solicitud) REFERENCES public.solicitudes_servicio(id_solicitud) ON DELETE CASCADE;
ALTER TABLE ONLY public.evidencias_servicio
    ADD CONSTRAINT evidencias_servicio_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES public.usuarios(id_usuario);
ALTER TABLE ONLY public.solicitudes_servicio
    ADD CONSTRAINT fk_solicitudes_estado FOREIGN KEY (estado) REFERENCES public.estados_solicitud(id_estado) ON UPDATE CASCADE;
ALTER TABLE ONLY public.solicitudes_servicio
    ADD CONSTRAINT fk_solicitudes_estado_pago FOREIGN KEY (estado_pago) REFERENCES public.estados_pago(codigo) ON UPDATE CASCADE;
ALTER TABLE ONLY public.tokens_temporales
    ADD CONSTRAINT fk_usuario FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario);
ALTER TABLE ONLY public.incidencias
    ADD CONSTRAINT incidencias_id_solicitud_fkey FOREIGN KEY (id_solicitud) REFERENCES public.solicitudes_servicio(id_solicitud) ON DELETE CASCADE;
ALTER TABLE ONLY public.incidencias
    ADD CONSTRAINT incidencias_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;
ALTER TABLE ONLY public.mensajes_chat
    ADD CONSTRAINT mensajes_chat_id_archivo_fkey FOREIGN KEY (id_archivo) REFERENCES public.archivos(id_archivo) ON DELETE SET NULL;
ALTER TABLE ONLY public.mensajes_chat
    ADD CONSTRAINT mensajes_chat_id_emisor_fkey FOREIGN KEY (id_emisor) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;
ALTER TABLE ONLY public.mensajes_chat
    ADD CONSTRAINT mensajes_chat_id_solicitud_fkey FOREIGN KEY (id_solicitud) REFERENCES public.solicitudes_servicio(id_solicitud) ON DELETE CASCADE;
ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.usuarios(id_usuario);
ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_id_solicitud_fkey FOREIGN KEY (id_solicitud) REFERENCES public.solicitudes_servicio(id_solicitud) ON DELETE CASCADE;
ALTER TABLE ONLY public.portafolio_tecnico
    ADD CONSTRAINT portafolio_tecnico_id_archivo_fkey FOREIGN KEY (id_archivo) REFERENCES public.archivos(id_archivo) ON DELETE CASCADE;
ALTER TABLE ONLY public.portafolio_tecnico
    ADD CONSTRAINT portafolio_tecnico_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;
ALTER TABLE ONLY public.reprogramaciones
    ADD CONSTRAINT reprogramaciones_id_anterior_fkey FOREIGN KEY (id_anterior) REFERENCES public.reprogramaciones(id_reprogramacion) ON DELETE SET NULL;
ALTER TABLE ONLY public.reprogramaciones
    ADD CONSTRAINT reprogramaciones_id_solicitud_fkey FOREIGN KEY (id_solicitud) REFERENCES public.solicitudes_servicio(id_solicitud) ON DELETE CASCADE;
ALTER TABLE ONLY public.reprogramaciones
    ADD CONSTRAINT reprogramaciones_propuesta_por_fkey FOREIGN KEY (propuesta_por) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;
ALTER TABLE ONLY public.retos_2fa
    ADD CONSTRAINT retos_2fa_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;
ALTER TABLE ONLY public.rol_permiso
    ADD CONSTRAINT rol_permiso_id_permiso_fkey FOREIGN KEY (id_permiso) REFERENCES public.permiso(id_permiso);
ALTER TABLE ONLY public.rol_permiso
    ADD CONSTRAINT rol_permiso_id_rol_fkey FOREIGN KEY (id_rol) REFERENCES public.rol(id_rol);
ALTER TABLE ONLY public.sesiones_activas
    ADD CONSTRAINT sesiones_activas_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario);
ALTER TABLE ONLY public.solicitud_imagenes
    ADD CONSTRAINT solicitud_imagenes_id_solicitud_fkey FOREIGN KEY (id_solicitud) REFERENCES public.solicitudes_servicio(id_solicitud) ON DELETE CASCADE;
ALTER TABLE ONLY public.solicitudes_descartadas
    ADD CONSTRAINT solicitudes_descartadas_id_solicitud_fkey FOREIGN KEY (id_solicitud) REFERENCES public.solicitudes_servicio(id_solicitud) ON DELETE CASCADE;
ALTER TABLE ONLY public.solicitudes_descartadas
    ADD CONSTRAINT solicitudes_descartadas_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;
ALTER TABLE ONLY public.solicitudes_servicio
    ADD CONSTRAINT solicitudes_servicio_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;
ALTER TABLE ONLY public.solicitudes_servicio
    ADD CONSTRAINT solicitudes_servicio_id_tecnico_propuesto_fkey FOREIGN KEY (id_tecnico_propuesto) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;
ALTER TABLE ONLY public.solicitudes_servicio
    ADD CONSTRAINT solicitudes_servicio_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;
ALTER TABLE ONLY public.soporte_mensajes
    ADD CONSTRAINT soporte_mensajes_id_archivo_fkey FOREIGN KEY (id_archivo) REFERENCES public.archivos(id_archivo) ON DELETE SET NULL;
ALTER TABLE ONLY public.soporte_mensajes
    ADD CONSTRAINT soporte_mensajes_id_emisor_fkey FOREIGN KEY (id_emisor) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;
ALTER TABLE ONLY public.soporte_mensajes
    ADD CONSTRAINT soporte_mensajes_id_ticket_fkey FOREIGN KEY (id_ticket) REFERENCES public.soporte_tickets(id_ticket) ON DELETE CASCADE;
ALTER TABLE ONLY public.soporte_tickets
    ADD CONSTRAINT soporte_tickets_id_solicitud_fkey FOREIGN KEY (id_solicitud) REFERENCES public.solicitudes_servicio(id_solicitud) ON DELETE SET NULL;
ALTER TABLE ONLY public.soporte_tickets
    ADD CONSTRAINT soporte_tickets_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;
ALTER TABLE ONLY public.tareas_servicio
    ADD CONSTRAINT tareas_servicio_id_solicitud_fkey FOREIGN KEY (id_solicitud) REFERENCES public.solicitudes_servicio(id_solicitud) ON DELETE CASCADE;
ALTER TABLE ONLY public.transacciones
    ADD CONSTRAINT transacciones_id_billetera_fkey FOREIGN KEY (id_billetera) REFERENCES public.billetera_tecnico(id_billetera) ON DELETE CASCADE;
ALTER TABLE ONLY public.transacciones
    ADD CONSTRAINT transacciones_id_solicitud_fkey FOREIGN KEY (id_solicitud) REFERENCES public.solicitudes_servicio(id_solicitud) ON DELETE SET NULL;
ALTER TABLE ONLY public.usuario_direcciones
    ADD CONSTRAINT usuario_direcciones_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;
ALTER TABLE ONLY public.usuario_metodos_pago
    ADD CONSTRAINT usuario_metodos_pago_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;
ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_id_rol_fkey FOREIGN KEY (id_rol) REFERENCES public.rol(id_rol);
ALTER TABLE ONLY public.verificaciones_biometricas
    ADD CONSTRAINT verificaciones_biometricas_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;
ALTER TABLE ONLY public.verificaciones_ine
    ADD CONSTRAINT verificaciones_ine_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;
ALTER TABLE ONLY public.servicios ADD CONSTRAINT servicios_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;
ALTER TABLE ONLY public.servicios ADD CONSTRAINT servicios_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;
ALTER TABLE ONLY public.servicios ADD CONSTRAINT servicios_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;
ALTER TABLE ONLY public.expedientes_tecnicos ADD CONSTRAINT expedientes_tecnicos_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;
ALTER TABLE ONLY public.disputas ADD CONSTRAINT disputas_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;
ALTER TABLE ONLY public.disputas ADD CONSTRAINT disputas_id_tecnico_fkey FOREIGN KEY (id_tecnico) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;
ALTER TABLE ONLY public.solicitudes_retiro ADD CONSTRAINT solicitudes_retiro_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;
ALTER TABLE ONLY public.cotizaciones ADD CONSTRAINT fk_cotizacion_solicitud FOREIGN KEY (id_solicitud) REFERENCES public.solicitudes_servicio(id_solicitud) ON DELETE CASCADE;
ALTER TABLE ONLY public.cotizaciones ADD CONSTRAINT fk_cotizacion_tecnico FOREIGN KEY (id_tecnico) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;
ALTER TABLE ONLY public.historial_estados_servicio ADD CONSTRAINT fk_historial_solicitud FOREIGN KEY (id_solicitud) REFERENCES public.solicitudes_servicio(id_solicitud) ON DELETE CASCADE;
ALTER TABLE ONLY public.historial_estados_servicio ADD CONSTRAINT fk_historial_usuario FOREIGN KEY (id_usuario_modificador) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;
ALTER TABLE ONLY public.resenas ADD CONSTRAINT fk_resena_solicitud FOREIGN KEY (id_solicitud) REFERENCES public.solicitudes_servicio(id_solicitud) ON DELETE CASCADE;
ALTER TABLE ONLY public.resenas ADD CONSTRAINT fk_resena_cliente FOREIGN KEY (id_cliente) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;
ALTER TABLE ONLY public.resenas ADD CONSTRAINT fk_resena_tecnico FOREIGN KEY (id_tecnico) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;
ALTER TABLE ONLY public.pagos ADD CONSTRAINT pagos_id_servicio_fkey FOREIGN KEY (id_servicio) REFERENCES public.servicios(id_servicio) ON DELETE SET NULL;

-- =============================================================================
-- FUNCIONES Y DISPARADORES
-- =============================================================================

CREATE FUNCTION public.cs_liquidacion(p_total numeric) RETURNS TABLE(total numeric, comision numeric, base numeric, retencion_isr numeric, retencion_iva numeric, neto_tecnico numeric)
    LANGUAGE sql IMMUTABLE
    AS $$
    WITH v AS (SELECT ROUND(p_total, 2) AS t, ROUND(ROUND(p_total, 2) / 1.16, 2) AS b)
    SELECT t, ROUND(t * 0.10, 2), b, ROUND(b * 0.021, 2), ROUND(b * 0.08, 2),
           t - ROUND(t * 0.10, 2) - ROUND(b * 0.021, 2) - ROUND(b * 0.08, 2)
    FROM v
$$;

-- =============================================================================
-- SINCRONIZACIÓN DE SECUENCIAS (setval)
-- =============================================================================

SELECT pg_catalog.setval('public.archivos_id_archivo_seq', 1, false);
SELECT pg_catalog.setval('public.auditoria_id_auditoria_seq', 1, false);
SELECT pg_catalog.setval('public.billetera_tecnico_id_billetera_seq', 1, false);
SELECT pg_catalog.setval('public.calificaciones_servicio_id_calificacion_seq', 1, false);
SELECT pg_catalog.setval('public.categorias_servicio_id_categoria_seq', 14, true);
SELECT pg_catalog.setval('public.conceptos_cotizacion_id_concepto_seq', 1, false);
SELECT pg_catalog.setval('public.cotizaciones_id_cotizacion_seq', 1, false);
SELECT pg_catalog.setval('public.cotizaciones_servicio_id_cotizacion_seq', 1, false);
SELECT pg_catalog.setval('public.direcciones_id_direccion_seq', 1, false);
SELECT pg_catalog.setval('public.disputas_id_disputa_seq', 1, false);
SELECT pg_catalog.setval('public.documentos_usuario_id_documento_seq', 1, false);
SELECT pg_catalog.setval('public.especialidades_tecnico_id_especialidad_seq', 1, false);
SELECT pg_catalog.setval('public.evidencias_servicio_id_evidencia_seq', 1, false);
SELECT pg_catalog.setval('public.expedientes_tecnicos_id_expediente_seq', 1, false);
SELECT pg_catalog.setval('public.historial_estados_servicio_id_historial_seq', 1, false);
SELECT pg_catalog.setval('public.incidencias_id_incidencia_seq', 1, false);
SELECT pg_catalog.setval('public.mensajes_chat_id_seq', 1, false);
SELECT pg_catalog.setval('public.metodos_pago_id_metodo_seq', 1, false);
SELECT pg_catalog.setval('public.pagos_id_pago_seq', 1, false);
SELECT pg_catalog.setval('public.permiso_id_permiso_seq', 1, false);
SELECT pg_catalog.setval('public.portafolio_tecnico_id_item_seq', 1, false);
SELECT pg_catalog.setval('public.reprogramaciones_id_reprogramacion_seq', 1, false);
SELECT pg_catalog.setval('public.resenas_id_resena_seq', 1, false);
SELECT pg_catalog.setval('public.rol_id_rol_seq', 3, true);
SELECT pg_catalog.setval('public.rol_permiso_id_rol_permiso_seq', 1, false);
SELECT pg_catalog.setval('public.servicios_id_servicio_seq', 1, false);
SELECT pg_catalog.setval('public.solicitud_imagenes_id_imagen_seq', 1, false);
SELECT pg_catalog.setval('public.solicitudes_descartadas_id_descarte_seq', 1, false);
SELECT pg_catalog.setval('public.solicitudes_retiro_id_retiro_seq', 1, false);
SELECT pg_catalog.setval('public.solicitudes_servicio_id_solicitud_seq', 1, false);
SELECT pg_catalog.setval('public.soporte_mensajes_id_mensaje_seq', 1, false);
SELECT pg_catalog.setval('public.soporte_tickets_id_ticket_seq', 1, false);
SELECT pg_catalog.setval('public.tareas_servicio_id_tarea_seq', 1, false);
SELECT pg_catalog.setval('public.tokens_temporales_id_token_seq', 85, true);
SELECT pg_catalog.setval('public.transacciones_id_transaccion_seq', 1, false);
SELECT pg_catalog.setval('public.usuario_direcciones_id_direccion_seq', 1, false);
SELECT pg_catalog.setval('public.usuario_metodos_pago_id_metodo_seq', 1, false);
SELECT pg_catalog.setval('public.usuarios_id_usuario_seq', 105, true);
SELECT pg_catalog.setval('public.verificaciones_ine_id_verificacion_ine_seq', 1, false);