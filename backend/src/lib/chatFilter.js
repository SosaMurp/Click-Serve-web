// Chat seguro: oculta en los mensajes entre cliente y técnico todo lo que sirva para sacar el trato de la app
// (teléfonos, apps de mensajería y redes, pagos por fuera, datos bancarios, enlaces y correos).
// Cada coincidencia se reemplaza por [BLOQUEADO]; el mensaje se guarda ya filtrado.

const BLOQUEADO = '[BLOQUEADO]';

// Una "palabra" no pega con letras ni dígitos a los lados (JS \b no entiende acentos).
const W_START = '(?<![\\p{L}\\d])';
const W_END = '(?![\\p{L}\\d])';
const word = (body) => new RegExp(`${W_START}(?:${body})${W_END}`, 'giu');

// 1. Secuencias de dígitos: teléfonos (10), tarjetas (15-16) y CLABE (18), juntos, con espacios, guiones,
//    puntos, paréntesis o escritos con palabras ("siete cinco tres…"). Se cuenta cada dígito de la secuencia.
const DIGIT_WORDS = { cero: 1, uno: 1, una: 1, dos: 1, tres: 1, cuatro: 1, cinco: 1, seis: 1, siete: 1, ocho: 1, nueve: 1 };
const DIGIT_WORD = `${W_START}(?:${Object.keys(DIGIT_WORDS).join('|')})${W_END}`;
const DIGIT_TOKEN = `(?:\\d+|${DIGIT_WORD})`;
const DIGIT_RUN = new RegExp(`\\+?${DIGIT_TOKEN}(?:[\\s.\\-()/]{0,3}${DIGIT_TOKEN})*`, 'giu');
const MIN_DIGITS = 10;

function countDigits(run) {
  const digits = (run.match(/\d/g) || []).length;
  const words = (run.toLowerCase().match(new RegExp(DIGIT_WORD, 'giu')) || []).length;
  return digits + words;
}

function digitReason(count) {
  if (count >= 18) return 'CLABE';
  if (count >= 15) return 'TARJETA';
  return 'TELEFONO';
}

// Las reglas de texto, en orden: primero correos y enlaces (para tapar la dirección completa).
const RULES = [
  { motivo: 'CORREO', re: /[\p{L}\d._%+-]+\s*(?:@|\(at\)|(?<![\p{L}\d])arroba(?![\p{L}\d]))\s*[\p{L}\d-]+(?:\s*(?:\.|(?<![\p{L}\d])punto(?![\p{L}\d]))\s*\p{L}{2,})+/giu },
  { motivo: 'ENLACE', re: /(?:https?:\/\/|www\.)\S+/giu },
  { motivo: 'ENLACE', re: word('(?:wa|t|m)\\.me(?:\\/\\S*)?|bit\\.ly(?:\\/\\S*)?') },
  { motivo: 'ENLACE', re: word('[\\p{L}\\d-]+\\.(?:com|mx|net|org|me|ly|io|app|link|co|info|biz|site|online|store)(?:\\.[a-z]{2})?(?:\\/\\S*)?') },
  {
    motivo: 'APP_MENSAJERIA',
    re: word('whats\\s*app|whatsapp|whats|wats|wasap|guasap|wsp|wpp|telegram|signal|messenger|facebook|face|fb|instagram|insta|ig|tiktok|snapchat|twitter'),
  },
  {
    motivo: 'PAGO_FUERA',
    re: word([
      'efectivo',
      'trato\\s+directo',
      'por\\s+fuera',
      'fuera\\s+de\\s+la\\s+(?:app|aplicaci[oó]n|plataforma)',
      'pago\\s+directo',
      'p[aá]game\\s+(?:a\\s+m[ií]|directo|aparte)',
      'canc[eé]lame',
      'cancel[aá](?:r|s|me)?\\s+(?:en|por)\\s+(?:fuera|aparte|directo|mano)',
      'en\\s+mano',
      '(?:transferencia|dep[oó]sito)\\s+directa?o?',
    ].join('|')),
  },
  {
    motivo: 'DATOS_BANCARIOS',
    re: word('clabe|n[uú]mero\\s+de\\s+(?:cuenta|tarjeta)|cuenta\\s+(?:bancaria|de\\s+banco|clabe)|mi\\s+cuenta\\s+(?:es|de\\s+banco)|te\\s+paso\\s+mi\\s+cuenta'),
  },
];

function filtrarTexto(input) {
  let texto = String(input ?? '');
  const motivos = new Set();

  for (const { motivo, re } of RULES) {
    texto = texto.replace(re, () => {
      motivos.add(motivo);
      return BLOQUEADO;
    });
  }

  texto = texto.replace(DIGIT_RUN, (run) => {
    const count = countDigits(run);
    if (count < MIN_DIGITS) return run;
    motivos.add(digitReason(count));
    return BLOQUEADO;
  });

  return { texto, bloqueado: motivos.size > 0, motivos: [...motivos] };
}

module.exports = { BLOQUEADO, filtrarTexto };
