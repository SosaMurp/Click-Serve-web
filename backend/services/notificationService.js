// services/notificationService.js
const nodemailer = require('nodemailer');
const twilio = require('twilio');

// ── 1. Configuración de Nodemailer ──────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ── 2. Configuración de Twilio ──────────────────────────────────────────────
let twilioClient = null;
if (
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  !process.env.TWILIO_ACCOUNT_SID.includes('XXXX')
) {
  try {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch (err) {
    console.warn('[TWILIO INIT WARNING] No se pudo inicializar el cliente de Twilio:', err.message);
  }
}

// ── 3. Helper para normalizar teléfono a formato internacional E.164 ────────
function formatPhoneNumber(phone) {
  if (!phone) return null;
  const cleaned = phone.replace(/[^0-9+]/g, '');
  // Si no tiene prefijo '+', asumimos México (+52)
  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10) return `+52${cleaned}`;
    return `+${cleaned}`;
  }
  return cleaned;
}

// ── 4. Generador de plantilla HTML para correo ──────────────────────────────
function getEmailTemplate({ clienteNombre, codigoServicio, nuevoEstado, tituloServicio, motivo }) {
  const isFinalizado = nuevoEstado.toLowerCase().includes('finalizado') || nuevoEstado.toLowerCase().includes('completado');
  const isCancelado  = nuevoEstado.toLowerCase().includes('cancelado');
  const colorHeader  = isFinalizado ? '#16a34a' : isCancelado ? '#dc2626' : '#0284c7';
  const badgeText    = nuevoEstado.toUpperCase();

  return `
    <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
      <div style="background: ${colorHeader}; padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px;">Click & Serve</h1>
        <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">Actualización en Tiempo Real de tu Servicio</p>
      </div>
      <div style="padding: 28px 24px;">
        <p style="font-size: 15px; color: #0f172a; margin-top: 0;">
          Hola <strong>${clienteNombre}</strong>,
        </p>
        <p style="font-size: 14px; color: #475569; line-height: 1.6;">
          Te informamos que tu solicitud de servicio técnico <strong>#${codigoServicio}</strong> ha cambiado de estado operativo:
        </p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0; text-align: center;">
          <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 6px;">Nuevo Estado Operativo</span>
          <span style="display: inline-block; background: ${colorHeader}; color: #ffffff; font-weight: 700; font-size: 14px; padding: 6px 16px; border-radius: 9999px;">
            ${badgeText}
          </span>
          <p style="margin: 10px 0 0; font-size: 13px; font-weight: 600; color: #1e293b;">${tituloServicio || 'Servicio Técnico Especializado'}</p>
        </div>
        ${motivo ? `
          <div style="background: #f1f5f9; border-left: 4px solid ${colorHeader}; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #334155; border-radius: 0 6px 6px 0;">
            <strong>Observaciones del Administrador:</strong><br/>
            ${motivo}
          </div>
        ` : ''}
        <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 24px;">
          Si tienes alguna duda o aclaración sobre este movimiento, puedes responder a este correo o ingresar a la plataforma Click & Serve para más detalles.
        </p>
      </div>
      <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8;">
        © ${new Date().getFullYear()} Click & Serve. Nodo Lázaro Cárdenas, Michoacán. Todos los derechos reservados.
      </div>
    </div>
  `;
}

// ── 5. Función principal de despacho de alertas ──────────────────────────────
async function despacharAlertasCliente({ cliente, servicio, nuevoEstado, motivo, canal = 'ambos' }) {
  const resultados = {
    sms: { enviado: false, error: null },
    email: { enviado: false, error: null },
  };

  const tasks = [];
  const codigoServicio = servicio.codigo || `SRV-${String(servicio.id_servicio).padStart(3, '0')}`;
  const clienteNombre = `${cliente.nombre || 'Estimado(a)'} ${cliente.apellido || ''}`.trim();

  // A) Envío por Email (Nodemailer)
  const debeEnviarEmail = (canal === 'ambos' || canal === 'email') && cliente.correo;
  if (debeEnviarEmail) {
    tasks.push(
      transporter.sendMail({
        from: process.env.EMAIL_FROM || '"Click & Serve" <no-reply@clickandserve.com>',
        to: cliente.correo,
        subject: `[${codigoServicio}] Tu servicio ahora está: ${nuevoEstado}`,
        html: getEmailTemplate({
          clienteNombre,
          codigoServicio,
          nuevoEstado,
          tituloServicio: servicio.titulo,
          motivo,
        }),
      }).then(() => {
        resultados.email.enviado = true;
        console.log(`[NOTIFICACIÓN] Email enviado exitosamente a ${cliente.correo} (${codigoServicio})`);
      }).catch((err) => {
        resultados.email.error = err.message;
        console.error(`[NOTIFICACIÓN ERROR] Falló envío de correo a ${cliente.correo}:`, err.message);
      })
    );
  }

  // B) Envío por SMS (Twilio)
  const phoneFormatted = formatPhoneNumber(cliente.telefono);
  const debeEnviarSms = (canal === 'ambos' || canal === 'sms') && twilioClient && phoneFormatted;
  if (debeEnviarSms) {
    const smsBody = `Click&Serve: Tu servicio #${codigoServicio} ha cambiado a: ${nuevoEstado}.${motivo ? ` Detalle: ${motivo}` : ''} Info: clickandserve.com`;
    tasks.push(
      twilioClient.messages.create({
        body: smsBody,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneFormatted,
      }).then((msg) => {
        resultados.sms.enviado = true;
        console.log(`[NOTIFICACIÓN] SMS enviado exitosamente vía Twilio a ${phoneFormatted}. SID: ${msg.sid}`);
      }).catch((err) => {
        resultados.sms.error = err.message;
        console.error(`[NOTIFICACIÓN ERROR] Falló envío SMS a ${phoneFormatted}:`, err.message);
      })
    );
  } else if ((canal === 'ambos' || canal === 'sms') && !twilioClient) {
    resultados.sms.error = 'Cliente Twilio no configurado o credenciales de prueba pendientes.';
  }

  // Esperar todas las promesas sin interrumpir por fallo de una
  await Promise.allSettled(tasks);

  return resultados;
}

module.exports = {
  despacharAlertasCliente,
};
