// controllers/serviciosController.js
const pool = require('../config/db');
const { despacharAlertasCliente } = require('../services/notificationService');

// ── Crear servicio con ubicación ─────────────────────────────────────────────
exports.createServicio = async (req, res) => {
  try {
    const {
      id_usuario,
      titulo,
      descripcion,
      // Coordenadas del LocationSelector
      latitud,
      longitud,
      direccion,
    } = req.body;

    // Validación básica de coordenadas (solo si se enviaron)
    const lat = parseFloat(latitud);
    const lng = parseFloat(longitud);

    if (latitud !== undefined && latitud !== null) {
      if (isNaN(lat) || lat < -90 || lat > 90) {
        return res.status(400).json({ error: 'Latitud fuera del rango válido (-90 a 90).' });
      }
      if (isNaN(lng) || lng < -180 || lng > 180) {
        return res.status(400).json({ error: 'Longitud fuera del rango válido (-180 a 180).' });
      }
    }

    // Protección BOLA / IDOR: Un usuario regular solo crea servicios a su propio nombre
    const effectiveUserId = (req.user?.id_rol === 3 && id_usuario) ? id_usuario : (req.user?.id_usuario || id_usuario);

    const result = await pool.query(
      `INSERT INTO servicios
         (id_usuario, titulo, descripcion, estatus, latitud, longitud, direccion, fecha_creacion)
       VALUES
         ($1, $2, $3, 'Pendiente', $4, $5, $6, NOW())
       RETURNING id_servicio, titulo, estatus, latitud, longitud, direccion, fecha_creacion`,
      [
        effectiveUserId,
        titulo,
        descripcion,
        latitud !== undefined ? lat : null,
        longitud !== undefined ? lng : null,
        direccion?.trim() || null,
      ]
    );

    res.status(201).json({
      mensaje: 'Servicio creado exitosamente.',
      servicio: result.rows[0],
    });
  } catch (error) {
    console.error('Error al crear servicio:', error);
    res.status(500).json({ error: 'Error interno al crear el servicio.' });
  }
};

// ── Actualizar ubicación de un servicio existente ────────────────────────────
exports.updateServicioLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { latitud, longitud, direccion } = req.body;

    const lat = parseFloat(latitud);
    const lng = parseFloat(longitud);

    if (isNaN(lat) || lat < -90  || lat > 90)  return res.status(400).json({ error: 'Latitud inválida.'  });
    if (isNaN(lng) || lng < -180 || lng > 180) return res.status(400).json({ error: 'Longitud inválida.' });

    const result = await pool.query(
      `UPDATE servicios
       SET latitud = $1, longitud = $2, direccion = $3
       WHERE id_servicio = $4
       RETURNING id_servicio, latitud, longitud, direccion`,
      [lat, lng, direccion?.trim() || null, id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Servicio no encontrado.' });

    res.status(200).json({
      mensaje: 'Ubicación actualizada correctamente.',
      servicio: result.rows[0],
    });
  } catch (error) {
    console.error('Error al actualizar ubicación:', error);
    res.status(500).json({ error: 'Error interno al actualizar la ubicación.' });
  }
};

// ── Listar servicios con coordenadas ─────────────────────────────────────────
exports.getServicios = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_servicio, titulo, descripcion, estatus,
              latitud, longitud, direccion, fecha_creacion
       FROM servicios
       ORDER BY fecha_creacion DESC`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al listar servicios:', error);
    res.status(500).json({ error: 'Error al obtener la lista de servicios.' });
  }
};

// ── Detalle de un servicio (mismo formato que /admin/dashboard/recent-services) ─
exports.getServicioById = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de servicio inválido.' });
  }
  try {
    const result = await pool.query(
      `SELECT s.id_servicio,
              CONCAT('SRV-', LPAD(s.id_servicio::text, 3, '0')) AS codigo,
              s.titulo, s.estatus, s.monto, s.direccion, s.fecha_creacion,
              t.nombre AS tecnico_nombre, t.apellido AS tecnico_apellido,
              c.nombre AS cliente_nombre, c.apellido AS cliente_apellido
       FROM servicios s
       LEFT JOIN Usuarios t ON s.id_tecnico = t.id_usuario
       LEFT JOIN Usuarios c ON s.id_cliente = c.id_usuario
       WHERE s.id_servicio = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Servicio no encontrado.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener servicio:', error);
    res.status(500).json({ error: 'Error al obtener el servicio.' });
  }
};

// ── Actualizar estado de servicio (RF de Auditoría y Seguimiento) ────────────
exports.updateServicioStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      estatus,
      notificarCliente = false,
      canalNotificacion = 'ambos',
      motivoCambio = null,
      mensajePersonalizado = null,
    } = req.body;

    if (!estatus || typeof estatus !== 'string') {
      return res.status(400).json({ error: 'El campo "estatus" es obligatorio.' });
    }

    // 1. Actualizar el estado del servicio en la BD
    const updateResult = await pool.query(
      `UPDATE servicios
       SET estatus = $1,
           fecha_actualizacion = NOW()
       WHERE id_servicio = $2
       RETURNING id_servicio, id_cliente, id_usuario, id_tecnico, titulo, descripcion, estatus, monto, direccion`,
      [estatus, id]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Servicio no encontrado.' });
    }

    const servicioActualizado = updateResult.rows[0];

    // 2. Si se solicitó notificar al cliente, consultar sus datos de contacto
    let notificacionResultado = null;
    const clienteId = servicioActualizado.id_cliente || servicioActualizado.id_usuario;

    if (notificarCliente && clienteId) {
      try {
        const clienteResult = await pool.query(
          `SELECT id_usuario, nombre, apellido, correo, telefono
           FROM Usuarios
           WHERE id_usuario = $1`,
          [clienteId]
        );

        if (clienteResult.rows.length > 0) {
          const cliente = clienteResult.rows[0];
          // Ejecución desacoplada (se procesa sin frenar la respuesta crítica si se prefiere)
          notificacionResultado = await despacharAlertasCliente({
            cliente,
            servicio: servicioActualizado,
            nuevoEstado: estatus,
            motivo: mensajePersonalizado || motivoCambio,
            canal: canalNotificacion,
          });
        }
      } catch (notifyErr) {
        console.error('Error no fatal al gestionar notificación al cliente:', notifyErr);
      }
    }

    // 3. Responder con éxito
    return res.status(200).json({
      mensaje: `Estado del servicio #${id} actualizado exitosamente a "${estatus}".`,
      servicio: servicioActualizado,
      notificacion: {
        solicitada: !!notificarCliente,
        detalles: notificacionResultado,
      },
    });
  } catch (error) {
    console.error('Error al actualizar estado del servicio:', error);
    return res.status(500).json({ error: 'Error interno al actualizar estado del servicio.' });
  }
};
