const { filtrarTexto } = require('../lib/chatFilter');

// Middleware del chat seguro: va después del uploader (multer llena req.body en los envíos con adjunto).
// Reemplaza req.body.mensaje por la versión filtrada y deja el resultado en req.chatFiltro para la respuesta.
function filtroChatSeguro(req, res, next) {
  const raw = req.body?.mensaje;
  if (typeof raw === 'string' && raw) {
    const resultado = filtrarTexto(raw);
    req.body.mensaje = resultado.texto;
    req.chatFiltro = { bloqueado: resultado.bloqueado, motivos: resultado.motivos };
  } else {
    req.chatFiltro = { bloqueado: false, motivos: [] };
  }
  next();
}

module.exports = { filtroChatSeguro };
