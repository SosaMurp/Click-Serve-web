const pool = require('../config/db');

// 1. OBTENER SOLICITUDES DE RETIRO (RF-75, RF-77)
exports.getWithdrawals = async (req, res) => {
  try {
    const { status } = req.query;
    let queryText = `
      SELECT sr.id_retiro, sr.id_usuario, sr.monto, sr.clabe, sr.banco, sr.estado, sr.folio_trx, 
             sr.fecha_solicitud, sr.fecha_procesado, sr.motivo_rechazo,
             u.nombre, u.apellido, u.correo, u.telefono
      FROM solicitudes_retiro sr
      JOIN Usuarios u ON sr.id_usuario = u.id_usuario
    `;
    const params = [];

    if (status) {
      params.push(status);
      queryText += ` WHERE sr.estado = $1`;
    }

    queryText += ` ORDER BY sr.fecha_solicitud DESC`;

    const result = await pool.query(queryText, params);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener solicitudes de retiro:', error);
    res.status(500).json({ error: 'Error al consultar las solicitudes de retiro.' });
  }
};

// 2. APROBAR SOLICITUD DE RETIRO Y ASIGNAR FOLIO TRX (RF-77, RF-79)
exports.approveWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const folioTrx = `TRX-${Math.floor(100 + Math.random() * 900)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const result = await pool.query(
      `UPDATE solicitudes_retiro 
       SET estado = 'Aprobado', folio_trx = $1, fecha_procesado = CURRENT_TIMESTAMP 
       WHERE id_retiro = $2 RETURNING *`,
      [folioTrx, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud de retiro no encontrada.' });
    }

    res.status(200).json({
      ...result.rows[0],
      folio_trx: folioTrx, // Mantenemos compatibilidad con cualquier cosa extra
      mensaje: 'Transferencia autorizada exitosamente.'
    });
  } catch (error) {
    console.error('Error al aprobar retiro:', error);
    res.status(500).json({ error: 'Error al procesar la aprobación del retiro.' });
  }
};

// 3. RECHAZAR SOLICITUD DE RETIRO SOSPECHOSA (RF-78)
exports.rejectWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivoRechazo } = req.body;

    const result = await pool.query(
      `UPDATE solicitudes_retiro 
       SET estado = 'Rechazado', motivo_rechazo = $1, fecha_procesado = CURRENT_TIMESTAMP 
       WHERE id_retiro = $2 RETURNING *`,
      [motivoRechazo || 'Denegado por auditoría de tesorería', id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud de retiro no encontrada.' });
    }

    res.status(200).json({
      ...result.rows[0],
      mensaje: 'Solicitud de retiro denegada.'
    });
  } catch (error) {
    console.error('Error al rechazar retiro:', error);
    res.status(500).json({ error: 'Error al denegar la solicitud de retiro.' });
  }
};

// 4. VER COMPROBANTE DE COMPLEMENTO FINANCIERO (RF-79)
exports.getWithdrawalReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT sr.*, u.nombre, u.apellido, u.correo, u.telefono
       FROM solicitudes_retiro sr
       JOIN Usuarios u ON sr.id_usuario = u.id_usuario
       WHERE sr.id_retiro = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comprobante no encontrado.' });
    }

    res.status(200).json({ comprobante: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener comprobante:', error);
    res.status(500).json({ error: 'Error al obtener el comprobante de transferencia.' });
  }
};

// 5. LISTAR DISPUTAS (RF-81, RF-114)
exports.getDisputes = async (req, res) => {
  try {
    const { status } = req.query;
    let queryText = `
      SELECT 
        d.id_disputa,
        d.id_cliente,
        d.id_tecnico,
        d.estado,
        d.monto_reembolso,
        d.monto_multa,
        d.observaciones,
        d.fecha_creacion,
        d.fecha_resolucion,
        c.nombre AS cliente_nombre,
        c.apellido AS cliente_apellido,
        t.nombre AS tecnico_nombre,
        t.apellido AS tecnico_apellido
      FROM public.disputas d
      JOIN public.Usuarios c ON d.id_cliente = c.id_usuario
      JOIN public.Usuarios t ON d.id_tecnico = t.id_usuario
    `;
    const params = [];

    if (status) {
      params.push(status);
      queryText += ` WHERE d.estado = $1`;
    }

    queryText += ` ORDER BY d.fecha_creacion DESC`;

    const result = await pool.query(queryText, params);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener disputas:', error);
    res.status(500).json({ error: 'Error al obtener la lista de disputas.' });
  }
};

// 6. LIQUIDACIÓN DE CONFLICTOS Y SANCIONES (RF-82, RF-83)
exports.settleDispute = async (req, res) => {
  try {
    const { id } = req.params;
    const { montoReembolso, montoMulta, observaciones } = req.body;

    const result = await pool.query(
      `UPDATE disputas 
       SET estado = 'Resuelta', monto_reembolso = $1, monto_multa = $2, observaciones = $3, fecha_resolucion = CURRENT_TIMESTAMP 
       WHERE id_disputa = $4 RETURNING *`,
      [montoReembolso || 0, montoMulta || 0, observaciones || 'Conflicto resuelto por administración', id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Disputa no encontrada.' });
    }

    res.status(200).json({
      ...result.rows[0],
      mensaje: 'Movimiento contable de liquidación formalizado exitosamente.'
    });
  } catch (error) {
    console.error('Error al liquidar disputa:', error);
    res.status(500).json({ error: 'Error al procesar la liquidación del conflicto.' });
  }
};

// 7. EXPORTAR PDF / DATOS DE CASO DE SANCIÓN (RF-80)
exports.exportDisputePdf = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT d.*, 
              c.nombre AS cliente_nombre, c.apellido AS cliente_apellido, c.correo AS cliente_correo,
              t.nombre AS tecnico_nombre, t.apellido AS tecnico_apellido, t.correo AS tecnico_correo
       FROM disputas d
       LEFT JOIN Usuarios c ON d.id_cliente = c.id_usuario
       LEFT JOIN Usuarios t ON d.id_tecnico = t.id_usuario
       WHERE d.id_disputa = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Caso no encontrado.' });
    }

    res.status(200).json({
      documento_pdf: {
        titulo: `Respaldo Caso de Sanción #${id}`,
        datos: result.rows[0],
        fecha_emision: new Date()
      }
    });
  } catch (error) {
    console.error('Error al exportar PDF:', error);
    res.status(500).json({ error: 'Error al generar el documento de respaldo.' });
  }
};

