const express = require('express');
const ExcelJS = require('exceljs');
const { getPool } = require('../db/pool');
const { auth } = require('../middleware/auth');
const { ROL, requireRole } = require('../middleware/roles');
const { fail } = require('../lib/http');
const { audit } = require('../lib/audit');

// Reportes del panel (RF-93, RF-95, RF-96): alcance temporal, dimensiones y formato.
// CSV se envía por partes (RNF-15) para no armar todo el archivo en memoria; Excel lleva una hoja por dimensión;
// JSON alimenta la vista imprimible del panel (PDF desde el navegador).
const router = express.Router();
const db = () => getPool();
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TZ = 'America/Mexico_City';

// Devuelve [desde, hasta) como fechas de México en texto ISO.
function rango(q) {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  const sumar = (iso, dias) => {
    const d = new Date(`${iso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
  };
  switch (q.alcance) {
    case 'today': return { desde: hoy, hasta: sumar(hoy, 1), etiqueta: 'Hoy' };
    case 'month': return { desde: `${hoy.slice(0, 7)}-01`, hasta: sumar(hoy, 1), etiqueta: 'Este mes' };
    case 'custom': {
      if (!ISO.test(q.desde || '') || !ISO.test(q.hasta || '') || q.desde > q.hasta) return null;
      if ((new Date(q.hasta) - new Date(q.desde)) / 86400000 > 366) return null;
      return { desde: q.desde, hasta: sumar(q.hasta, 1), etiqueta: `${q.desde} a ${q.hasta}` };
    }
    default: return { desde: sumar(hoy, -6), hasta: sumar(hoy, 1), etiqueta: 'Últimos 7 días' };
  }
}

// Cada dimensión: hojas con columnas [clave, título] y su consulta acotada por fecha (en hora de México).
const EN_RANGO = (col) => `(${col} AT TIME ZONE '${TZ}')::date >= $1::date AND (${col} AT TIME ZONE '${TZ}')::date < $2::date`;
const DIMENSIONES = {
  servicios: [{
    hoja: 'Servicios',
    columnas: [['folio', 'Folio'], ['fecha', 'Fecha'], ['categoria', 'Categoría'], ['estado', 'Estado'], ['estado_pago', 'Pago'],
      ['monto', 'Monto (MXN)'], ['cliente', 'Cliente'], ['tecnico', 'Técnico'], ['cancelado_por', 'Cancelado por']],
    sql: `SELECT s.folio, to_char(s.fecha_creacion AT TIME ZONE '${TZ}', 'YYYY-MM-DD HH24:MI') AS fecha,
                 COALESCE(c.nombre, s.categoria) AS categoria, s.estado, s.estado_pago,
                 COALESCE(s.monto_total, s.monto_cotizacion) AS monto,
                 CONCAT(cl.nombre, ' ', cl.apellido) AS cliente, NULLIF(CONCAT(t.nombre, ' ', t.apellido), ' ') AS tecnico, s.cancelado_por
          FROM solicitudes_servicio s
          LEFT JOIN categorias_servicio c ON c.codigo = s.categoria
          LEFT JOIN usuarios cl ON cl.id_usuario = s.id_usuario
          LEFT JOIN usuarios t ON t.id_usuario = s.id_tecnico
          WHERE ${EN_RANGO('s.fecha_creacion')} ORDER BY s.fecha_creacion`,
  }],
  finanzas: [{
    hoja: 'Cobros a clientes',
    columnas: [['folio', 'Orden'], ['fecha', 'Fecha'], ['monto', 'Monto (MXN)'], ['estado', 'Estado'], ['modo', 'Modo'], ['referencia', 'Referencia']],
    sql: `SELECT s.folio, to_char(p.fecha AT TIME ZONE '${TZ}', 'YYYY-MM-DD HH24:MI') AS fecha, p.monto, p.estado, p.modo, p.referencia
          FROM pagos p LEFT JOIN solicitudes_servicio s ON s.id_solicitud = p.id_solicitud
          WHERE ${EN_RANGO('p.fecha')} ORDER BY p.fecha`,
  }, {
    hoja: 'Billeteras de técnicos',
    columnas: [['folio', 'Folio'], ['fecha', 'Fecha'], ['tipo', 'Tipo'], ['concepto', 'Concepto'], ['monto', 'Monto (MXN)'], ['estado', 'Estado'],
      ['tecnico', 'Técnico'], ['cuenta', 'Cuenta destino'], ['motivo_rechazo', 'Motivo de rechazo']],
    sql: `SELECT t.folio, to_char(t.fecha AT TIME ZONE '${TZ}', 'YYYY-MM-DD HH24:MI') AS fecha, t.tipo, t.concepto, t.monto, t.estado,
                 CONCAT(u.nombre, ' ', u.apellido) AS tecnico, t.clabe_destino AS cuenta, t.motivo_rechazo
          FROM transacciones t JOIN billetera_tecnico b ON b.id_billetera = t.id_billetera JOIN usuarios u ON u.id_usuario = b.id_usuario
          WHERE ${EN_RANGO('t.fecha')} ORDER BY t.fecha`,
  }],
  identidad: [{
    hoja: 'Auditoría de identidad',
    columnas: [['id_usuario', 'ID'], ['nombre', 'Técnico'], ['correo', 'Correo'], ['registro', 'Registro'], ['estado_cuenta', 'Estado'],
      ['identidad_verificada', 'Identidad verificada'], ['verificado_sep', 'Cédula SEP'], ['documentos_pendientes', 'Documentos por revisar'],
      ['revision', 'Revisado'], ['motivo_rechazo', 'Motivo de rechazo']],
    sql: `SELECT u.id_usuario, CONCAT(u.nombre, ' ', u.apellido) AS nombre, u.correo,
                 to_char(u.fecha_registro, 'YYYY-MM-DD') AS registro, u.estado_cuenta,
                 CASE WHEN u.identidad_verificada THEN 'Sí' ELSE 'No' END AS identidad_verificada,
                 CASE WHEN COALESCE(u.verificado_sep, false) THEN 'Sí' ELSE 'No' END AS verificado_sep,
                 (SELECT COUNT(*)::int FROM documentos_usuario d WHERE d.id_usuario = u.id_usuario AND d.estado = 'EN_REVISION') AS documentos_pendientes,
                 to_char(u.fecha_revision AT TIME ZONE '${TZ}', 'YYYY-MM-DD') AS revision, u.motivo_rechazo
          FROM usuarios u
          WHERE u.id_rol = 2 AND u.anonimizado = false AND u.fecha_registro::date >= $1::date AND u.fecha_registro::date < $2::date
          ORDER BY u.fecha_registro`,
  }],
};

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Evita que Excel interprete el texto como fórmula (inyección CSV).
  const safe = /^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

router.get('/api/admin/reportes', auth, requireRole(ROL.ADMIN), async (req, res) => {
  const r = rango(req.query);
  if (!r) return fail(res, 400, 'VALIDATION_ERROR', 'Rango de fechas no válido (máximo un año).', { field: 'desde' });
  const dims = String(req.query.dimensiones || 'servicios').split(',').map((d) => d.trim()).filter((d) => DIMENSIONES[d]);
  if (dims.length === 0) return fail(res, 400, 'VALIDATION_ERROR', 'Elige al menos una dimensión.', { field: 'dimensiones' });
  const formato = ['csv', 'xlsx', 'json'].includes(req.query.formato) ? req.query.formato : 'csv';
  const hojas = dims.flatMap((d) => DIMENSIONES[d]);
  const nombre = `Reporte_ClickServe_${r.desde}_${r.hasta}`;
  audit(req, 'REPORTE_EXPORTADO', 'reporte', null, { dims, formato, desde: r.desde, hasta: r.hasta });

  if (formato === 'json') {
    const datos = [];
    for (const h of hojas) {
      const { rows } = await db().query(h.sql, [r.desde, r.hasta]);
      datos.push({ hoja: h.hoja, columnas: h.columnas.map(([, t]) => t), filas: rows.map((row) => h.columnas.map(([k]) => row[k] ?? null)) });
    }
    return res.json({ alcance: r.etiqueta, desde: r.desde, generado: new Date().toISOString(), hojas: datos });
  }

  if (formato === 'xlsx') {
    const libro = new ExcelJS.Workbook();
    libro.creator = 'Click & Serve';
    for (const h of hojas) {
      const hoja = libro.addWorksheet(h.hoja.slice(0, 31));
      hoja.columns = h.columnas.map(([key, header]) => ({ key, header, width: Math.max(12, header.length + 4) }));
      hoja.getRow(1).font = { bold: true };
      const { rows } = await db().query(h.sql, [r.desde, r.hasta]);
      for (const row of rows) hoja.addRow(Object.fromEntries(h.columnas.map(([k]) => [k, k === 'monto' && row[k] != null ? Number(row[k]) : row[k]])));
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}.xlsx"`);
    await libro.xlsx.write(res);
    return res.end();
  }

  // CSV por partes: BOM para que Excel respete los acentos y una sección por hoja.
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}.csv"`);
  res.write('﻿');
  res.write(`${csvCell(`Reporte Click & Serve · ${r.etiqueta}`)}\n`);
  for (const h of hojas) {
    res.write(`\n${csvCell(h.hoja)}\n${h.columnas.map(([, t]) => csvCell(t)).join(',')}\n`);
    const { rows } = await db().query(h.sql, [r.desde, r.hasta]);
    for (let i = 0; i < rows.length; i += 500) {
      res.write(rows.slice(i, i + 500).map((row) => h.columnas.map(([k]) => csvCell(row[k])).join(',')).join('\n') + '\n');
    }
  }
  return res.end();
});

// RF-80: expediente de una incidencia (datos, orden, cotización y evidencias) para imprimir o guardar en PDF.
router.get('/api/admin/incidencias/:id/expediente', auth, requireRole(ROL.ADMIN), async (req, res) => {
  const inc = (await db().query(
    `SELECT i.*, s.folio AS folio_solicitud, s.estado AS estado_solicitud, s.estado_pago, s.descripcion AS descripcion_solicitud,
            s.direccion, s.fecha_creacion AS fecha_solicitud, s.fecha_asignacion, s.fecha_llegada, s.fecha_finalizacion,
            COALESCE(s.monto_total, s.monto_cotizacion) AS monto, COALESCE(c.nombre, s.categoria) AS categoria,
            CONCAT(cl.nombre, ' ', cl.apellido) AS cliente, cl.correo AS cliente_correo,
            CONCAT(t.nombre, ' ', t.apellido) AS tecnico, t.correo AS tecnico_correo,
            CONCAT(r.nombre, ' ', r.apellido) AS reporta, CONCAT(a.nombre, ' ', a.apellido) AS atendio
     FROM incidencias i
     LEFT JOIN solicitudes_servicio s ON s.id_solicitud = i.id_solicitud
     LEFT JOIN categorias_servicio c ON c.codigo = s.categoria
     LEFT JOIN usuarios cl ON cl.id_usuario = s.id_usuario
     LEFT JOIN usuarios t ON t.id_usuario = s.id_tecnico
     LEFT JOIN usuarios r ON r.id_usuario = i.id_usuario
     LEFT JOIN usuarios a ON a.id_usuario = i.id_admin
     WHERE i.id_incidencia = $1`,
    [req.params.id]
  )).rows[0];
  if (!inc) return fail(res, 404, 'NOT_FOUND', 'Incidencia no encontrada.');
  const [conceptos, evidencias, chat] = await Promise.all([
    db().query('SELECT tipo, descripcion, monto FROM conceptos_cotizacion WHERE id_solicitud = $1 ORDER BY id_concepto', [inc.id_solicitud]),
    db().query('SELECT tipo_evidencia AS tipo, descripcion, fecha_subida AS fecha FROM evidencias_servicio WHERE id_solicitud = $1 ORDER BY fecha_subida', [inc.id_solicitud]),
    db().query(
      `SELECT m.mensaje, m.fecha_envio, CONCAT(u.nombre, ' ', u.apellido) AS emisor FROM mensajes_chat m
       LEFT JOIN usuarios u ON u.id_usuario = m.id_emisor WHERE m.id_solicitud = $1 ORDER BY m.fecha_envio DESC LIMIT 30`,
      [inc.id_solicitud]
    ),
  ]);
  audit(req, 'EXPEDIENTE_INCIDENCIA', 'incidencia', inc.id_incidencia);
  res.json({ incidencia: inc, conceptos: conceptos.rows, evidencias: evidencias.rows, chat: chat.rows.reverse(), generado: new Date().toISOString() });
});

module.exports = router;
