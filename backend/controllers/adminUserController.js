const pool = require('../config/db');
const bcrypt = require('bcrypt');

// 1. LISTADO DE USUARIOS CON FILTROS (RF-37, RF-38)
exports.getUsers = async (req, res) => {
  try {
    const { role, status, specialty, search } = req.query;

    let queryText = `
      SELECT u.id_usuario, u.nombre, u.apellido, u.correo, u.telefono, u.id_rol, u.estado_cuenta, u.fecha_nacimiento,
             et.id_expediente, et.especialidad, et.estatus AS estatus_expediente, et.metricas
      FROM Usuarios u
      LEFT JOIN expedientes_tecnicos et ON u.id_usuario = et.id_usuario
      WHERE 1=1
    `;
    const params = [];

    // Filtro por Rol: 1 = Cliente, 2 = Técnico, 3 = Administrador
    if (role === 'tech' || role === '2') {
      params.push(2);
      queryText += ` AND u.id_rol = $${params.length}`;
    } else if (role === 'client' || role === '1') {
      params.push(1);
      queryText += ` AND u.id_rol = $${params.length}`;
    } else if (role === 'admin' || role === '3') {
      params.push(3);
      queryText += ` AND u.id_rol = $${params.length}`;
    }

    // Filtro por Estado de Cuenta
    if (status) {
      params.push(status);
      queryText += ` AND u.estado_cuenta = $${params.length}`;
    }

    // Filtro por Especialidad
    if (specialty) {
      params.push(`%${specialty}%`);
      queryText += ` AND et.especialidad ILIKE $${params.length}`;
    }

    // Filtro de Búsqueda de Texto
    if (search) {
      params.push(`%${search}%`);
      queryText += ` AND (u.nombre ILIKE $${params.length} OR u.apellido ILIKE $${params.length} OR u.correo ILIKE $${params.length} OR u.telefono ILIKE $${params.length})`;
    }

    queryText += ` ORDER BY u.id_usuario DESC`;

    const result = await pool.query(queryText, params);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener la lista de usuarios.' });
  }
};

// 2. BÚSQUEDA AVANZADA (RF-39)
exports.searchAdvanced = async (req, res) => {
  try {
    const { especialidad, estadoCuenta, fechaInicio, fechaFin } = req.body;
    let queryText = `
      SELECT u.id_usuario, u.nombre, u.apellido, u.correo, u.telefono, u.id_rol, u.estado_cuenta,
             et.especialidad, et.estatus AS estatus_expediente
      FROM Usuarios u
      LEFT JOIN expedientes_tecnicos et ON u.id_usuario = et.id_usuario
      WHERE 1=1
    `;
    const params = [];

    if (especialidad) {
      params.push(`%${especialidad}%`);
      queryText += ` AND et.especialidad ILIKE $${params.length}`;
    }
    if (estadoCuenta) {
      params.push(estadoCuenta);
      queryText += ` AND u.estado_cuenta = $${params.length}`;
    }

    const result = await pool.query(queryText, params);
    res.status(200).json({ resultados: result.rows });
  } catch (error) {
    console.error('Error en búsqueda avanzada:', error);
    res.status(500).json({ error: 'Error en el filtro avanzado.' });
  }
};

// 3. EXPEDIENTES DE TÉCNICOS PENDIENTES / EN REVISIÓN (RF-28, RF-29, RF-34)
exports.getVerifications = async (req, res) => {
  try {
    const { status } = req.query;
    let queryText = `
      SELECT et.id_expediente, et.id_usuario, et.especialidad, et.estatus, et.fecha_solicitud, et.metricas, et.documentos,
             u.nombre, u.apellido, u.correo, u.telefono, u.estado_cuenta
      FROM expedientes_tecnicos et
      JOIN Usuarios u ON et.id_usuario = u.id_usuario
    `;
    const params = [];

    if (status) {
      params.push(status);
      queryText += ` WHERE et.estatus = $1`;
    } else {
      queryText += ` WHERE et.estatus IN ('En Revisión', 'Pendiente')`;
    }

    queryText += ` ORDER BY et.fecha_solicitud DESC`;

    const result = await pool.query(queryText, params);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener verificaciones:', error);
    res.status(500).json({ error: 'Error al consultar expedientes de verificación.' });
  }
};

// 4. DETALLE INDIVIDUAL DE UN EXPEDIENTE TÉCNICO (RF-20, RF-31, RF-36)
exports.getTechnicianDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT u.id_usuario, u.nombre, u.apellido, u.correo, u.telefono, u.fecha_nacimiento, u.estado_cuenta,
              et.id_expediente, et.especialidad, et.estatus, et.fecha_solicitud, et.fecha_resolucion, 
              et.motivo_rechazo, et.documentos, et.metricas
       FROM Usuarios u
       LEFT JOIN expedientes_tecnicos et ON u.id_usuario = et.id_usuario
       WHERE u.id_usuario = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expediente no encontrado.' });
    }

    res.status(200).json({ expediente: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener detalle del técnico:', error);
    res.status(500).json({ error: 'Error al consultar el expediente.' });
  }
};

// 5. APROBAR EXPEDIENTE / FIRMA DE AUTORIZACIÓN (RF-42)
exports.approveTechnician = async (req, res) => {
  try {
    const { id } = req.params;

    // Actualizar estado en Usuarios a Activo
    await pool.query(
      `UPDATE Usuarios SET estado_cuenta = 'Activo' WHERE id_usuario = $1`,
      [id]
    );

    // Actualizar o crear expediente técnico en estado Aprobado
    await pool.query(
      `INSERT INTO expedientes_tecnicos (id_usuario, estatus, fecha_resolucion)
       VALUES ($1, 'Aprobado', CURRENT_TIMESTAMP)
       ON CONFLICT (id_usuario) 
       DO UPDATE SET estatus = 'Aprobado', fecha_resolucion = CURRENT_TIMESTAMP`,
      [id]
    );

    res.status(200).json({ mensaje: 'Técnico autorizado exitosamente. Acceso operativo concedido.' });
  } catch (error) {
    console.error('Error al aprobar técnico:', error);
    res.status(500).json({ error: 'Error al autorizar el expediente.' });
  }
};

// 6. RECHAZAR EXPEDIENTE / PROTOCOLO DE RECHAZO Y BLOQUEO (RF-41)
exports.rejectTechnician = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivoRechazo, bloquearUsuario } = req.body;

    const nuevoEstadoCuenta = bloquearUsuario ? 'Suspendido' : 'No verificado';

    await pool.query(
      `UPDATE Usuarios SET estado_cuenta = $1 WHERE id_usuario = $2`,
      [nuevoEstadoCuenta, id]
    );

    await pool.query(
      `UPDATE expedientes_tecnicos 
       SET estatus = 'Rechazado', motivo_rechazo = $1, fecha_resolucion = CURRENT_TIMESTAMP 
       WHERE id_usuario = $2`,
      [motivoRechazo || 'Rechazado por auditoría administrativa', id]
    );

    res.status(200).json({ 
      mensaje: bloquearUsuario 
        ? 'Solicitud rechazada y usuario bloqueado por sospecha de riesgo.' 
        : 'Solicitud rechazada exitosamente.' 
    });
  } catch (error) {
    console.error('Error al rechazar técnico:', error);
    res.status(500).json({ error: 'Error al procesar el rechazo del expediente.' });
  }
};

// 7. SUSPENDER FACULTADES OPERATIVAS (RF-32)
exports.suspendUser = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(`UPDATE Usuarios SET estado_cuenta = 'Suspendido' WHERE id_usuario = $1`, [id]);
    
    // Revocar todas sus sesiones activas de inmediato
    await pool.query(`UPDATE sesiones_activas SET estado = 'revocada' WHERE id_usuario = $1`, [id]);

    res.status(200).json({ mensaje: 'Cuenta suspendida exitosamente y sesiones revocadas.' });
  } catch (error) {
    console.error('Error al suspender usuario:', error);
    res.status(500).json({ error: 'Error al suspender la cuenta.' });
  }
};

// 8. RESTAURAR FACULTADES OPERATIVAS (RF-33)
exports.reactivateUser = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(`UPDATE Usuarios SET estado_cuenta = 'Activo' WHERE id_usuario = $1`, [id]);
    res.status(200).json({ mensaje: 'Estatus operativo restaurado exitosamente.' });
  } catch (error) {
    console.error('Error al reactivar usuario:', error);
    res.status(500).json({ error: 'Error al reactivar la cuenta.' });
  }
};

// 9. REGISTRO DE COADMINISTRADOR (RF-26)
exports.registerCoAdmin = async (req, res) => {
  try {
    const { nombre, apellidos, telefono, email, fechaNacimiento, password } = req.body;
    const emailFormateado = email.trim().toLowerCase();
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await pool.query(
      `INSERT INTO Usuarios (nombre, apellido, telefono, correo, fecha_nacimiento, contrasena, id_rol, estado_cuenta)
       VALUES ($1, $2, $3, $4, $5, $6, 3, 'Activo')`,
      [nombre, apellidos, telefono, emailFormateado, fechaNacimiento, hashedPassword]
    );

    res.status(201).json({ mensaje: 'Coadministrador registrado exitosamente.' });
  } catch (error) {
    console.error('Error al registrar coadministrador:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'El correo electrónico ya está registrado.' });
    }
    res.status(500).json({ error: 'Error al registrar el coadministrador.' });
  }
};

// 10. EXPORTAR EXPEDIENTE TÉCNICO COMPLETO (RF-17)
exports.exportUserBackup = async (req, res) => {
  try {
    const { id } = req.params;
    const userQuery = await pool.query(
      `SELECT id_usuario, nombre, apellido, correo, telefono, fecha_nacimiento, id_rol, estado_cuenta FROM Usuarios WHERE id_usuario = $1`,
      [id]
    );

    if (userQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const techQuery = await pool.query(`SELECT * FROM expedientes_tecnicos WHERE id_usuario = $1`, [id]);

    res.status(200).json({
      expediente_completo: {
        usuario: userQuery.rows[0],
        tecnico: techQuery.rows[0] || null,
        fecha_exportacion: new Date()
      }
    });
  } catch (error) {
    console.error('Error al exportar expediente:', error);
    res.status(500).json({ error: 'Error al generar el respaldo del expediente.' });
  }
};

// 11. ELIMINACIÓN DEFINTIVA DE CUENTA (RF-16)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM Usuarios WHERE id_usuario = $1`, [id]);
    res.status(200).json({ mensaje: 'Cuenta de usuario eliminada definitivamente.' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ error: 'Error al eliminar la cuenta de usuario.' });
  }
};

