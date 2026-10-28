const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const pool = require('../config/db');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || process.env.SMTP_USER || 'projectcys1@gmail.com',
    pass: process.env.EMAIL_PASS || process.env.SMTP_PASS || 'bzpacpnbucuobeat'
  }
});

// Helper: Generación de token numérico criptográficamente seguro (CSPRNG)
const generateSecureOTP = (min, max) => {
  return crypto.randomInt(min, max).toString();
};

// 1. REGISTRAR USUARIO
exports.register = async (req, res) => {
  const { nombre, apellidos, telefono, email, fechaNacimiento, password, perfil } = req.body;

  if (!email || !password || !nombre) {
    return res.status(400).json({ error: 'Los campos obligatorios deben ser completados.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  }

  try {
    const emailFormateado = email.trim().toLowerCase();
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = await pool.query(
      `INSERT INTO Usuarios 
        (nombre, apellido, telefono, correo, fecha_nacimiento, contrasena, id_rol, estado_cuenta) 
       VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING id_usuario`,
      [nombre, apellidos, telefono, emailFormateado, fechaNacimiento, hashedPassword, perfil || 1, 'No verificado']
    );

    const idUsuario = newUser.rows[0].id_usuario;
    const tokenGenerado = generateSecureOTP(1000, 10000); // 4 dígitos seguro

    await pool.query(
      `INSERT INTO tokens_temporales (id_usuario, token, tipo_accion, estado_uso, fecha_expiracion) 
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + interval '15 minutes')`,
      [idUsuario, tokenGenerado, 'registro', 'sin usar']
    );

    const mailOptions = {
      from: '"Click & Serve" <projectcys1@gmail.com>',
      to: emailFormateado,
      subject: 'Tu código de verificación - Click & Serve',
      html: `
        <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
          <h2>¡Bienvenido a Click & Serve!</h2>
          <p>Hola ${nombre}, ingresa el siguiente código para activar tu cuenta:</p>
          <h1 style="letter-spacing: 5px; color: #0A192F; background-color: #F8FAFC; padding: 15px; border-radius: 8px; display: inline-block;">
            ${tokenGenerado}
          </h1>
          <p style="font-size: 12px; color: #64748b; margin-top: 15px;">Este código expirará en 15 minutos.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ mensaje: 'Usuario registrado con éxito. Código enviado al correo.' });

  } catch (error) {
    console.error('Error en register:', error);
    if (error.code === '23505' || error.constraint === 'usuarios_correo_key') {
      return res.status(409).json({ error: 'El correo electrónico ya se encuentra registrado.' });
    }
    res.status(500).json({ error: 'Error en el servidor al registrar el usuario' });
  }
};

// 2. INICIAR SESIÓN (GENERAL)
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son requeridos.' });
  }

  try {
    const emailFormateado = email.trim().toLowerCase();
    const userQuery = await pool.query(
      'SELECT id_usuario, nombre, apellido, telefono, correo, fecha_nacimiento, id_rol, estado_cuenta, contrasena, version_sesion FROM Usuarios WHERE correo = $1', 
      [emailFormateado]
    );

    // Protección contra enumeración de usuarios: mensaje idéntico para usuario no existente o password incorrecto
    if (userQuery.rows.length === 0) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }

    const usuario = userQuery.rows[0];
    const contraseñaValida = await bcrypt.compare(password, usuario.contrasena);

    if (!contraseñaValida) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }

    if (usuario.estado_cuenta === 'No verificado') {
      return res.status(403).json({ error: 'Por favor, verifica tu cuenta con el código enviado a tu correo.' });
    }

    if (usuario.estado_cuenta === 'Suspendido' || usuario.estado_cuenta === 'Inactivo') {
      return res.status(403).json({ error: 'Tu cuenta se encuentra suspendida o inactiva. Contacta a soporte.' });
    }

    delete usuario.contrasena;

    const dispositivo = req.headers['user-agent'] || 'Dispositivo desconocido';
    const sesionResult = await pool.query(
      `INSERT INTO sesiones_activas (id_usuario, id_rol, dispositivo) VALUES ($1, $2, $3) RETURNING id_sesion`,
      [usuario.id_usuario, usuario.id_rol, dispositivo]
    );
    const sessionId = sesionResult.rows[0].id_sesion;

    const token = jwt.sign(
      { 
        id_usuario: usuario.id_usuario, 
        id_rol: usuario.id_rol,
        version_sesion: usuario.version_sesion || 1,
        sessionId: sessionId
      }, 
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '7d' }
    );

    res.status(200).json({ 
      mensaje: 'Inicio de sesión exitoso',
      usuario: usuario,
      token: token
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error al intentar iniciar sesión' });
  }
};

// ============================================================
// 3. LOGIN ADMINISTRADOR — PASO 1: Verificación de credenciales
// ============================================================
exports.loginAdmin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son requeridos.' });
  }

  try {
    const emailFormateado = email.trim().toLowerCase();

    const userQuery = await pool.query(
      'SELECT id_usuario, nombre, id_rol, estado_cuenta, contrasena FROM Usuarios WHERE correo = $1', 
      [emailFormateado]
    );

    // Anti-enumeración de usuarios: respuesta idéntica
    if (userQuery.rows.length === 0) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }

    const usuario = userQuery.rows[0];
    const contraseñaValida = await bcrypt.compare(password, usuario.contrasena);

    if (!contraseñaValida) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }

    // Comprobación estricta de rol de administrador (id_rol === 3)
    if (usuario.id_rol !== 3) {
      return res.status(403).json({ error: 'Acceso denegado. Credenciales no válidas para el panel web administrativo.' });
    }

    if (usuario.estado_cuenta === 'No verificado') {
      return res.status(403).json({ error: 'Tu cuenta administrativa aún no está verificada.' });
    }

    if (usuario.estado_cuenta === 'Suspendido' || usuario.estado_cuenta === 'Inactivo') {
      return res.status(403).json({ error: 'Tu cuenta administrativa se encuentra suspendida. Contacta a un administrador senior.' });
    }

    // Generar código OTP criptográficamente seguro de 6 dígitos
    const tokenGenerado = generateSecureOTP(100000, 1000000);

    // Expirar códigos previos de login_admin sin usar
    await pool.query(
      `UPDATE tokens_temporales SET estado_uso = 'expirado' 
       WHERE id_usuario = $1 AND tipo_accion = 'login_admin' AND estado_uso = 'sin usar'`,
      [usuario.id_usuario]
    );

    // Guardar token temporal con caducidad de 10 minutos
    await pool.query(
      `INSERT INTO tokens_temporales (id_usuario, token, tipo_accion, estado_uso, fecha_expiracion) 
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + interval '10 minutes')`,
      [usuario.id_usuario, tokenGenerado, 'login_admin', 'sin usar']
    );

    const mailOptions = {
      from: '"Click & Serve - Seguridad" <projectcys1@gmail.com>',
      to: emailFormateado,
      subject: 'Código de acceso al panel - Click & Serve',
      html: `
        <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
          <h2>Autenticación de Dos Factores</h2>
          <p>Hola ${usuario.nombre}, se ha detectado un intento de inicio de sesión en tu cuenta administrativa.</p>
          <p>Ingresa el siguiente código de 6 dígitos para acceder al dashboard:</p>
          <h1 style="letter-spacing: 5px; color: #0A192F; background-color: #F8FAFC; padding: 15px; border-radius: 8px; display: inline-block;">
            ${tokenGenerado}
          </h1>
          <p style="font-size: 12px; color: #64748b; margin-top: 15px;">Este código expirará en 10 minutos.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    
    res.status(200).json({ 
      mensaje: 'Credenciales correctas. Código enviado al correo.',
      requiere2FA: true 
    });

  } catch (error) {
    console.error('Error en loginAdmin:', error);
    res.status(500).json({ error: 'Error en el servidor al intentar iniciar sesión' });
  }
};

// ============================================================
// 4. VERIFICAR 2FA LOGIN ADMIN — PASO 2: Validación del código OTP
// ============================================================
exports.verifyLoginAdmin = async (req, res) => {
  const { email, token } = req.body;

  if (!email || !token) {
    return res.status(400).json({ error: 'El correo y el código son requeridos.' });
  }

  try {
    const emailFormateado = email.trim().toLowerCase();
    
    const userQuery = await pool.query(
      'SELECT id_usuario, id_rol, version_sesion, nombre, apellido, correo, estado_cuenta FROM Usuarios WHERE correo = $1 AND id_rol = 3', 
      [emailFormateado]
    );

    if (userQuery.rows.length === 0) {
      return res.status(400).json({ error: 'Código de seguridad incorrecto o expirado.' });
    }
    
    const usuario = userQuery.rows[0];

    // Verificar token sin usar y que NO haya expirado (fecha_expiracion > CURRENT_TIMESTAMP)
    const tokenQuery = await pool.query(
      `SELECT id_token FROM tokens_temporales 
       WHERE id_usuario = $1 AND token = $2 AND tipo_accion = 'login_admin' 
         AND estado_uso = 'sin usar' AND fecha_expiracion > CURRENT_TIMESTAMP`,
      [usuario.id_usuario, token.trim()]
    );

    if (tokenQuery.rows.length === 0) {
      // Marcar expirados pendientes si los hay
      await pool.query(
        `UPDATE tokens_temporales SET estado_uso = 'expirado' 
         WHERE id_usuario = $1 AND tipo_accion = 'login_admin' AND estado_uso = 'sin usar' AND fecha_expiracion <= CURRENT_TIMESTAMP`,
        [usuario.id_usuario]
      );
      return res.status(400).json({ error: 'Código de seguridad incorrecto o expirado.' });
    }

    const idToken = tokenQuery.rows[0].id_token;
    await pool.query(`UPDATE tokens_temporales SET estado_uso = 'usado' WHERE id_token = $1`, [idToken]);

    const dispositivo = req.headers['user-agent'] || 'Panel Web Administrativo';

    const sesionResult = await pool.query(
      `INSERT INTO sesiones_activas (id_usuario, id_rol, dispositivo) VALUES ($1, $2, $3) RETURNING id_sesion`,
      [usuario.id_usuario, usuario.id_rol, dispositivo]
    );
    const sessionId = sesionResult.rows[0].id_sesion;

    const jwtToken = jwt.sign(
      { 
        id_usuario: usuario.id_usuario,
        id_rol: usuario.id_rol,
        version_sesion: usuario.version_sesion || 1,
        sessionId: sessionId
      }, 
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '8h' }
    );

    res.status(200).json({ 
      mensaje: 'Acceso autorizado',
      usuario: usuario,
      token: jwtToken
    });

  } catch (error) {
    console.error('Error en verifyLoginAdmin:', error);
    res.status(500).json({ error: 'Error al verificar el código de seguridad' });
  }
};

// 5. VERIFICAR TOKEN DE REGISTRO
exports.verifyToken = async (req, res) => {
  const { email, token } = req.body;

  if (!email || !token) {
    return res.status(400).json({ error: 'Correo y código son requeridos.' });
  }

  try {
    const emailFormateado = email.trim().toLowerCase();
    const userQuery = await pool.query('SELECT id_usuario FROM Usuarios WHERE correo = $1', [emailFormateado]);
    if (userQuery.rows.length === 0) {
      return res.status(400).json({ error: 'Código incorrecto, expirado o ya utilizado.' });
    }
    const idUsuario = userQuery.rows[0].id_usuario;

    const tokenQuery = await pool.query(
      `SELECT id_token FROM tokens_temporales 
       WHERE id_usuario = $1 AND token = $2 AND tipo_accion = 'registro' 
         AND estado_uso = 'sin usar' AND fecha_expiracion > CURRENT_TIMESTAMP`,
      [idUsuario, token.trim()]
    );

    if (tokenQuery.rows.length === 0) {
      return res.status(400).json({ error: 'Código incorrecto, expirado o ya utilizado.' });
    }

    const idToken = tokenQuery.rows[0].id_token;
    await pool.query(`UPDATE tokens_temporales SET estado_uso = 'usado' WHERE id_token = $1`, [idToken]);
    await pool.query(`UPDATE Usuarios SET estado_cuenta = 'Activo' WHERE id_usuario = $1`, [idUsuario]);

    res.status(200).json({ mensaje: 'Cuenta verificada exitosamente y activada.' });
  } catch (error) {
    console.error('Error en verifyToken:', error);
    res.status(500).json({ error: 'Error al verificar el código' });
  }
};

// 6. REENVIAR CÓDIGO REGISTRO
exports.resendCode = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'El correo electrónico es requerido.' });
  }

  try {
    const emailFormateado = email.trim().toLowerCase();
    const userQuery = await pool.query('SELECT id_usuario, nombre FROM Usuarios WHERE correo = $1', [emailFormateado]);
    
    // Anti-enumeración de usuarios: respuesta genérica
    if (userQuery.rows.length === 0) {
      return res.status(200).json({ mensaje: 'Si la cuenta está pendiente de activación, se ha enviado un nuevo código.' });
    }

    const { id_usuario, nombre } = userQuery.rows[0];

    await pool.query(
      `UPDATE tokens_temporales SET estado_uso = 'expirado' 
       WHERE id_usuario = $1 AND tipo_accion = 'registro' AND estado_uso = 'sin usar'`,
      [id_usuario]
    );

    const tokenGenerado = generateSecureOTP(1000, 10000);

    await pool.query(
      `INSERT INTO tokens_temporales (id_usuario, token, tipo_accion, estado_uso, fecha_expiracion) 
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + interval '15 minutes')`,
      [id_usuario, tokenGenerado, 'registro', 'sin usar']
    );

    const mailOptions = {
      from: '"Click & Serve" <projectcys1@gmail.com>', 
      to: emailFormateado,
      subject: 'Nuevo código de verificación - Click & Serve',
      html: `
        <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
          <h2>¡Nuevo código enviado!</h2>
          <p>Hola ${nombre}, ingresa este código para activar tu cuenta:</p>
          <h1 style="letter-spacing: 5px; color: #0A192F; background-color: #F8FAFC; padding: 15px; border-radius: 8px; display: inline-block;">
            ${tokenGenerado}
          </h1>
          <p style="font-size: 12px; color: #64748b; margin-top: 15px;">Este código expirará en 15 minutos.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ mensaje: 'Nuevo código enviado exitosamente.' });
  } catch (error) {
    console.error('Error en resendCode:', error);
    res.status(500).json({ error: 'Error al intentar reenviar el código' });
  }
};

// ============================================================
// 7. SOLICITAR RECUPERACIÓN DE CONTRASEÑA
// ============================================================
// Verificaciones de seguridad añadidas:
// - Verificación previa de existencia y de asignación de rol (id_rol no nulo)
// - Comprobación de estado activo (cuentas suspendidas no reciben códigos)
// - Protección contra enumeración de usuarios (respuesta neutral universal)
// - Generación CSPRNG de código OTP de 4 dígitos
// - Caducidad explícita de 15 minutos en BD
exports.requestRecovery = async (req, res) => {
  const { email } = req.body; 

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'El correo electrónico es requerido.' });
  }

  try {
    const emailFormateado = email.trim().toLowerCase();
    
    // Consulta al usuario comprobando id_rol y estado_cuenta
    const userQuery = await pool.query(
      'SELECT id_usuario, nombre, id_rol, estado_cuenta FROM Usuarios WHERE correo = $1',
      [emailFormateado]
    );

    // Respuesta unificada que previene el User Enumeration
    const genericResponse = { 
      mensaje: 'Si el correo está registrado y activo, se ha enviado un código de recuperación.' 
    };

    // 1. Si no existe ningún usuario con ese correo, responder con mensaje neutro sin filtrar información
    if (userQuery.rows.length === 0) {
      return res.status(200).json(genericResponse);
    }

    const usuario = userQuery.rows[0];

    // 2. Comprobar ANTES de enviar si el usuario tiene un id_rol asignado y válido
    if (usuario.id_rol === null || usuario.id_rol === undefined || Number.isNaN(Number(usuario.id_rol))) {
      console.warn(`[Seguridad] Intento de recuperación bloqueado: usuario id=${usuario.id_usuario} sin rol asignado.`);
      return res.status(200).json(genericResponse);
    }

    // 3. Comprobar que la cuenta no esté suspendida o inactiva
    if (usuario.estado_cuenta === 'Suspendido' || usuario.estado_cuenta === 'Inactivo') {
      console.warn(`[Seguridad] Intento de recuperación bloqueado: cuenta suspendida/inactiva id=${usuario.id_usuario}.`);
      return res.status(200).json(genericResponse);
    }

    // 4. Expirar tokens previos de recuperación para este usuario
    await pool.query(
      `UPDATE tokens_temporales SET estado_uso = 'expirado' 
       WHERE id_usuario = $1 AND tipo_accion = 'recuperacion' AND estado_uso = 'sin usar'`,
      [usuario.id_usuario]
    );

    // 5. Generar código criptográficamente seguro
    const tokenGenerado = generateSecureOTP(1000, 10000);

    // 6. Registrar en tokens_temporales con expiración explícita de 15 minutos
    await pool.query(
      `INSERT INTO tokens_temporales (id_usuario, token, tipo_accion, estado_uso, fecha_expiracion) 
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + interval '15 minutes')`,
      [usuario.id_usuario, tokenGenerado, 'recuperacion', 'sin usar']
    );

    const mailOptions = {
      from: '"Click & Serve" <projectcys1@gmail.com>', 
      to: emailFormateado,
      subject: 'Recuperación de contraseña - Click & Serve',
      html: `
        <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
          <h2>Recuperación de cuenta</h2>
          <p>Hola ${usuario.nombre}, ingresa este código en la aplicación o panel administrativo:</p>
          <h1 style="letter-spacing: 5px; color: #0A192F; background-color: #F8FAFC; padding: 15px; border-radius: 8px; display: inline-block;">
            ${tokenGenerado}
          </h1>
          <p style="font-size: 12px; color: #64748b; margin-top: 15px;">Este código expirará en 15 minutos.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json(genericResponse);
  } catch (error) {
    console.error('Error en requestRecovery:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud de recuperación' });
  }
};

// ============================================================
// 8. VERIFICAR RECUPERACIÓN (Valida el código de 4 dígitos)
// ============================================================
exports.verifyRecovery = async (req, res) => {
  const { email, token } = req.body;

  if (!email || !token) {
    return res.status(400).json({ error: 'Correo y código son requeridos.' });
  }

  try {
    const emailFormateado = email.trim().toLowerCase();
    const userQuery = await pool.query(
      'SELECT id_usuario, id_rol, estado_cuenta FROM Usuarios WHERE correo = $1', 
      [emailFormateado]
    );

    // Si el usuario no existe o no tiene rol asignado, responder con error genérico
    if (userQuery.rows.length === 0 || userQuery.rows[0].id_rol === null || userQuery.rows[0].id_rol === undefined) {
      return res.status(400).json({ error: 'Código de seguridad incorrecto o expirado.' });
    }

    const idUsuario = userQuery.rows[0].id_usuario;

    // Verificar token sin usar y con fecha de expiración vigente
    const tokenQuery = await pool.query(
      `SELECT id_token FROM tokens_temporales 
       WHERE id_usuario = $1 AND token = $2 AND tipo_accion = 'recuperacion' 
         AND estado_uso = 'sin usar' AND fecha_expiracion > CURRENT_TIMESTAMP`,
      [idUsuario, token.trim()]
    );

    if (tokenQuery.rows.length === 0) {
      // Marcar expirados pendientes
      await pool.query(
        `UPDATE tokens_temporales SET estado_uso = 'expirado' 
         WHERE id_usuario = $1 AND tipo_accion = 'recuperacion' AND estado_uso = 'sin usar' AND fecha_expiracion <= CURRENT_TIMESTAMP`,
        [idUsuario]
      );
      return res.status(400).json({ error: 'Código de seguridad incorrecto o expirado.' });
    }

    const idToken = tokenQuery.rows[0].id_token;
    await pool.query(`UPDATE tokens_temporales SET estado_uso = 'verificado' WHERE id_token = $1`, [idToken]);

    res.status(200).json({ mensaje: 'Código verificado correctamente. Puedes cambiar tu contraseña.' });
  } catch (error) {
    console.error('Error en verifyRecovery:', error);
    res.status(500).json({ error: 'Error al verificar el código de recuperación' });
  }
};

// ============================================================
// 9. RESTABLECER CONTRASEÑA
// ============================================================
exports.resetPassword = async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ error: 'Correo y nueva contraseña son requeridos.' });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
  }

  try {
    const emailFormateado = email.trim().toLowerCase();
    const userQuery = await pool.query(
      'SELECT id_usuario, id_rol FROM Usuarios WHERE correo = $1', 
      [emailFormateado]
    );

    if (userQuery.rows.length === 0 || userQuery.rows[0].id_rol === null || userQuery.rows[0].id_rol === undefined) {
      return res.status(403).json({ error: 'Acceso denegado. No has verificado tu código de seguridad.' });
    }

    const idUsuario = userQuery.rows[0].id_usuario;

    // Verificar que exista un token verificado recientemente y que no haya expirado
    const tokenQuery = await pool.query(
      `SELECT id_token FROM tokens_temporales 
       WHERE id_usuario = $1 AND tipo_accion = 'recuperacion' 
         AND estado_uso = 'verificado' AND fecha_expiracion > CURRENT_TIMESTAMP`,
      [idUsuario]
    );

    if (tokenQuery.rows.length === 0) {
      return res.status(403).json({ error: 'Acceso denegado. El código de verificación ha expirado o no ha sido validado.' });
    }

    const idToken = tokenQuery.rows[0].id_token;
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Actualizar contraseña e incrementar versión de sesión para no-repudio
    await pool.query(
      `UPDATE Usuarios 
       SET contrasena = $1, version_sesion = COALESCE(version_sesion, 1) + 1, fecha_actualizacion_contrasena = CURRENT_TIMESTAMP 
       WHERE id_usuario = $2`, 
      [hashedPassword, idUsuario]
    );

    // Revocar todas las sesiones activas en todos los dispositivos
    await pool.query(
      "UPDATE sesiones_activas SET estado = 'revocada' WHERE id_usuario = $1 AND estado = 'activa'",
      [idUsuario]
    );

    // Marcar token como utilizado
    await pool.query(`UPDATE tokens_temporales SET estado_uso = 'usado' WHERE id_token = $1`, [idToken]);

    res.status(200).json({ mensaje: 'Contraseña actualizada exitosamente. Ya puedes iniciar sesión.' });
  } catch (error) {
    console.error('Error en resetPassword:', error);
    res.status(500).json({ error: 'Error al intentar restablecer la contraseña' });
  }
};

// ============================================================
// 10. CAMBIAR CONTRASEÑA DESDE PERFIL
// ============================================================
exports.updatePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Debes proporcionar la contraseña actual y la nueva contraseña.' });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
  }

  try {
    const userQuery = await pool.query(
      'SELECT id_usuario, contrasena, version_sesion, id_rol FROM Usuarios WHERE id_usuario = $1', 
      [req.user.id_usuario]
    );
    
    if (userQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const usuario = userQuery.rows[0];
    const contraseñaValida = await bcrypt.compare(currentPassword, usuario.contrasena);

    if (!contraseñaValida) {
      return res.status(401).json({ error: 'La contraseña actual ingresada es incorrecta.' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    const newVersionSesion = (usuario.version_sesion || 1) + 1;

    await pool.query(
      'UPDATE Usuarios SET contrasena = $1, version_sesion = $2, fecha_actualizacion_contrasena = CURRENT_TIMESTAMP WHERE id_usuario = $3', 
      [hashedPassword, newVersionSesion, usuario.id_usuario]
    );

    // Revocar todas las demás sesiones excepto la actual
    if (req.user.sessionId) {
      await pool.query(
        "UPDATE sesiones_activas SET estado = 'revocada' WHERE id_usuario = $1 AND id_sesion != $2 AND estado = 'activa'",
        [usuario.id_usuario, req.user.sessionId]
      );
    }

    const token = jwt.sign(
      { 
        id_usuario: usuario.id_usuario, 
        id_rol: usuario.id_rol,
        version_sesion: newVersionSesion,
        sessionId: req.user.sessionId
      }, 
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '7d' }
    );

    res.status(200).json({ 
      mensaje: 'Contraseña actualizada exitosamente.',
      token: token
    });
  } catch (error) {
    console.error('Error en updatePassword:', error);
    res.status(500).json({ error: 'Error en el servidor al intentar cambiar la contraseña.' });
  }
};

// 11. OBTENER SESIONES ACTIVAS
exports.getSessions = async (req, res) => {
  try {
    const userId = req.user.id_usuario;
    const userRol = req.user.id_rol;
    const query = await pool.query(
      "SELECT id_sesion, dispositivo, fecha_creacion FROM sesiones_activas WHERE id_usuario = $1 AND id_rol = $2 AND estado = 'activa' ORDER BY fecha_creacion DESC",
      [userId, userRol]
    );
    
    const sesiones = query.rows.map(sesion => ({
      ...sesion,
      es_sesion_actual: sesion.id_sesion === req.user.sessionId
    }));

    res.status(200).json({ sesiones });
  } catch (error) {
    console.error('Error al obtener sesiones:', error);
    res.status(500).json({ error: 'Error al obtener tus sesiones activas.' });
  }
};

// 12. REVOCAR SESIÓN ESPECÍFICA
exports.revokeSession = async (req, res) => {
  try {
    const userId = req.user.id_usuario;
    const userRol = req.user.id_rol;
    const sessionToRevoke = req.params.sessionId;

    const checkQuery = await pool.query(
      "SELECT id_usuario, id_rol FROM sesiones_activas WHERE id_sesion = $1",
      [sessionToRevoke]
    );

    if (checkQuery.rows.length === 0) {
      return res.status(404).json({ error: 'La sesión no existe o ya fue eliminada.' });
    }

    const { id_usuario, id_rol } = checkQuery.rows[0];

    if (id_usuario !== userId || id_rol !== userRol) {
      return res.status(403).json({ error: 'Acceso denegado. No tienes permiso para desvincular esta sesión.' });
    }

    await pool.query(
      "UPDATE sesiones_activas SET estado = 'revocada' WHERE id_sesion = $1",
      [sessionToRevoke]
    );

    res.status(200).json({ mensaje: 'Dispositivo desvinculado exitosamente.' });
  } catch (error) {
    console.error('Error al revocar sesión:', error);
    res.status(500).json({ error: 'Error al intentar desvincular el dispositivo.' });
  }
};

// 13. REVOCAR TODAS LAS DEMÁS SESIONES
exports.revokeAllSessions = async (req, res) => {
  try {
    const userId = req.user.id_usuario;
    const userRol = req.user.id_rol;
    const currentSessionId = req.user.sessionId;

    await pool.query(
      "UPDATE sesiones_activas SET estado = 'revocada' WHERE id_usuario = $1 AND id_rol = $2 AND id_sesion != $3 AND estado = 'activa'",
      [userId, userRol, currentSessionId]
    );

    res.status(200).json({ mensaje: 'Todas las demás sesiones han sido cerradas exitosamente.' });
  } catch (error) {
    console.error('Error al revocar todas las sesiones:', error);
    res.status(500).json({ error: 'Error al intentar cerrar las sesiones.' });
  }
};

// 14. LOGOUT
exports.logout = async (req, res) => {
  try {
    if (req.user && req.user.sessionId) {
      await pool.query(
        "UPDATE sesiones_activas SET estado = 'revocada' WHERE id_sesion = $1",
        [req.user.sessionId]
      );
    }
    res.status(200).json({ mensaje: 'Sesión cerrada exitosamente en el servidor.' });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({ error: 'Error al intentar cerrar la sesión en el servidor.' });
  }
};
