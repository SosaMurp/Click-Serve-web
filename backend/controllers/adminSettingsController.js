const pool = require('../config/db');

// 1. OBTENER CONFIGURACIÓN DE PLATAFORMA (RF-97)
exports.getSettings = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM configuracion_plataforma WHERE id = 1');
    if (result.rows.length === 0) {
      return res.status(200).json({
        comision_porcentaje: 15.00,
        monto_minimo_retiro: 100.00,
        radio_maximo_km: 25,
        tolerancia_minutos: 15,
        sensibilidad_ia: 'Media',
        modo_mantenimiento: false,
        mensaje_mantenimiento: 'El sistema se encuentra en mantenimiento programado.'
      });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener configuraciones:', error);
    res.status(500).json({ error: 'Error al consultar la configuración de la plataforma.' });
  }
};

// 2. ACTUALIZAR PARÁMETROS OPERATIVOS Y FINANCIEROS (RF-97)
exports.updateSettings = async (req, res) => {
  try {
    const { comisionPorcentaje, montoMinimoRetiro, radioMaximoKm, toleranciaMinutos } = req.body;

    const result = await pool.query(
      `UPDATE configuracion_plataforma 
       SET comision_porcentaje = COALESCE($1, comision_porcentaje),
           monto_minimo_retiro = COALESCE($2, monto_minimo_retiro),
           radio_maximo_km = COALESCE($3, radio_maximo_km),
           tolerancia_minutos = COALESCE($4, tolerancia_minutos),
           actualizado_en = CURRENT_TIMESTAMP
       WHERE id = 1 RETURNING *`,
      [comisionPorcentaje, montoMinimoRetiro, radioMaximoKm, toleranciaMinutos]
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar configuraciones:', error);
    res.status(500).json({ error: 'Error al actualizar la configuración.' });
  }
};

// 3. CALIBRACIÓN DE SENSIBILIDAD DE INTELIGENCIA ARTIFICIAL (RF-98)
exports.updateAiSensitivity = async (req, res) => {
  try {
    const { sensibilidadIa } = req.body;

    const result = await pool.query(
      `UPDATE configuracion_plataforma 
       SET sensibilidad_ia = $1, actualizado_en = CURRENT_TIMESTAMP
       WHERE id = 1 RETURNING *`,
      [sensibilidadIa || 'Media']
    );

    res.status(200).json({
      mensaje: `Sensibilidad del motor de biometría calibrado a '${sensibilidadIa}'.`,
      configuracion: result.rows[0]
    });
  } catch (error) {
    console.error('Error al calibrar IA:', error);
    res.status(500).json({ error: 'Error al actualizar la calibración de biometría.' });
  }
};

// 4. VERIFICAR ESTADO DEL SISTEMA / MANTENIMIENTO (PÚBLICO) (RF-99)
exports.getSystemStatus = async (req, res) => {
  try {
    const result = await pool.query('SELECT modo_mantenimiento, mensaje_mantenimiento FROM configuracion_plataforma WHERE id = 1');
    if (result.rows.length === 0) {
      return res.status(200).json({ mantenimiento: false });
    }
    res.status(200).json({ 
      mantenimiento: result.rows[0].modo_mantenimiento,
      mensaje: result.rows[0].mensaje_mantenimiento 
    });
  } catch (error) {
    console.error('Error al verificar estado del sistema:', error);
    res.status(500).json({ error: 'Error al verificar el estado del servicio.' });
  }
};

// 5. MODO MANTENIMIENTO Y CONTINGENCIA (RF-99)
exports.toggleMaintenanceMode = async (req, res) => {
  try {
    const { modoMantenimiento, mensajeMantenimiento } = req.body;

    const result = await pool.query(
      `UPDATE configuracion_plataforma 
       SET modo_mantenimiento = $1,
           mensaje_mantenimiento = COALESCE($2, mensaje_mantenimiento),
           actualizado_en = CURRENT_TIMESTAMP
       WHERE id = 1 RETURNING *`,
      [modoMantenimiento, mensajeMantenimiento]
    );

    res.status(200).json({
      mensaje: modoMantenimiento 
        ? 'Modo mantenimiento activado. Plataforma suspendida temporalmente.' 
        : 'Modo mantenimiento desactivado. Operación normal restablecida.',
      configuracion: result.rows[0]
    });
  } catch (error) {
    console.error('Error al cambiar modo mantenimiento:', error);
    res.status(500).json({ error: 'Error al cambiar el estado de contingencia.' });
  }
};

// 6. GENERAR Y DESCARGAR REPORTES (.CSV, .XLSX, .PDF) (RF-93, RF-95, RF-96)
exports.exportReport = async (req, res) => {
  try {
    const { alcanceTemporal, dimension, formato } = req.body;
    const formatoElegido = (formato || 'csv').toLowerCase();

    let queryText = '';
    if (dimension === 'Finanzas') {
      queryText = `SELECT id_retiro, monto, clabe, banco, estado, folio_trx, fecha_solicitud FROM solicitudes_retiro ORDER BY fecha_solicitud DESC`;
    } else if (dimension === 'Auditoría de Identidad') {
      queryText = `SELECT id_expediente, id_usuario, especialidad, estatus, fecha_solicitud FROM expedientes_tecnicos ORDER BY fecha_solicitud DESC`;
    } else {
      queryText = `SELECT id_usuario, nombre, apellido, correo, id_rol, estado_cuenta FROM Usuarios ORDER BY id_usuario DESC`;
    }

    const result = await pool.query(queryText);

    res.status(200).json({
      mensaje: `Reporte de '${dimension}' generado exitosamente para el alcance '${alcanceTemporal || 'Últimos 7 días'}'.`,
      formato: formatoElegido,
      total_registros: result.rows.length,
      datos: result.rows,
      fecha_generacion: new Date()
    });
  } catch (error) {
    console.error('Error al exportar reporte:', error);
    res.status(500).json({ error: 'Error al procesar la creación del documento.' });
  }
};

