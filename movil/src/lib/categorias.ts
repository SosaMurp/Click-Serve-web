import type { IconName } from '../design';

// Ícono por oficio para reconocer un servicio de un vistazo, sin depender de leer el texto.
export function iconoCategoria(nombre?: string | null): IconName {
  const n = String(nombre || '').toLowerCase();
  if (n.includes('electr')) return 'zap';
  if (n.includes('plom') || n.includes('agua')) return 'droplet';
  if (n.includes('comput') || n.includes('tecnolog') || n.includes('red')) return 'monitor';
  if (n.includes('cerraj')) return 'key';
  if (n.includes('pint')) return 'edit-3';
  if (n.includes('aire') || n.includes('refrig') || n.includes('clima')) return 'wind';
  if (n.includes('carpint') || n.includes('mueble')) return 'package';
  if (n.includes('jard')) return 'feather';
  if (n.includes('limp')) return 'trash-2';
  return 'tool';
}

// Ejemplo de cómo describir la falla, según el servicio (o la categoría) que eligió el cliente. Frases cortas y
// cotidianas para que cualquier persona, sobre todo adultos mayores, sepa qué escribir.
const EJEMPLO_POR_SERVICIO: [RegExp, string][] = [
  [/formateo|sistema/, 'Ej. la computadora tarda mucho en prender y quiero reinstalar Windows'],
  [/limpieza|mantenimiento de equipo/, 'Ej. la laptop se calienta mucho y el ventilador hace ruido'],
  [/red|wifi/, 'Ej. el internet no llega a las recámaras de arriba'],
  [/virus/, 'Ej. me salen anuncios solos y la computadora va muy lenta'],
  [/contacto|apagador/, 'Ej. el contacto de la cocina hace chispa al conectar la licuadora'],
  [/lámpara|lampara/, 'Ej. quiero poner un ventilador de techo en la sala'],
  [/cortocircuito/, 'Ej. se bota la pastilla cada vez que prendo el microondas'],
  [/centro de carga/, 'Ej. quiero cambiar la caja de fusibles vieja por pastillas'],
  [/drenaje/, 'Ej. el lavabo del baño no traga el agua'],
  [/llave|mezcladora/, 'Ej. la llave de la cocina gotea aunque esté cerrada'],
  [/fuga/, 'Ej. sale agua por debajo del fregadero'],
  [/calentador|boiler/, 'Ej. el boiler ya no calienta y quiero cambiarlo'],
  [/minisplit|recarga de gas/, 'Ej. el minisplit de la recámara prende pero no enfría'],
  [/lavadora/, 'Ej. la lavadora no saca el agua al terminar'],
  [/refrigerador/, 'Ej. el refrigerador no enfría y hace mucho ruido'],
  [/estufa/, 'Ej. un quemador de la estufa no prende'],
  [/apertura de puerta/, 'Ej. me quedé afuera de mi casa y dejé las llaves adentro'],
  [/chapa/, 'Ej. la chapa de la puerta principal ya no cierra bien'],
  [/cerrojo/, 'Ej. quiero poner un cerrojo extra en la puerta de la calle'],
  [/retoques|resanes/, 'Ej. hay grietas y manchas en la pared de la sala'],
  [/pintar habitaci/, 'Ej. quiero pintar mi recámara de 3 por 4 metros'],
  [/impermeabilizar/, 'Ej. se mete el agua por el techo cuando llueve'],
  [/batería|bateria|corriente/, 'Ej. mi carro no arranca, creo que es la batería'],
  [/aceite/, 'Ej. ya le toca el cambio de aceite a mi carro'],
  [/balatas/, 'Ej. los frenos de mi carro rechinan al frenar'],
];

const EJEMPLO_POR_CATEGORIA: Record<string, string> = {
  COMPUTO: 'Ej. la computadora no prende o se apaga sola',
  ELECTRICIDAD: 'Ej. no hay luz en la cocina y los demás cuartos sí tienen',
  PLOMERIA: 'Ej. sale agua por debajo del lavabo del baño',
  CLIMATIZACION: 'Ej. el aire acondicionado prende pero no enfría',
  LINEA_BLANCA: 'Ej. la lavadora no centrifuga',
  CERRAJERIA: 'Ej. la llave ya no entra en la chapa de la puerta',
  PINTURA: 'Ej. quiero pintar la fachada de mi casa',
  MECANICA: 'Ej. mi carro hace un ruido raro al frenar',
};

export function ejemploDescripcion(categoria?: string | null, servicio?: string | null, esDiagnostico = false): string {
  const s = String(servicio || '').toLowerCase();
  if (s && !esDiagnostico) {
    const hit = EJEMPLO_POR_SERVICIO.find(([re]) => re.test(s));
    if (hit) return hit[1];
  }
  return (categoria && EJEMPLO_POR_CATEGORIA[categoria]) || 'Ej. describe qué pasa, desde cuándo y dónde está la falla';
}
