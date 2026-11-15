import { errorMessage } from '../../api/client';
import { solicitudesApi } from '../../api/endpoints';
import { dialog } from '../../ui/dialog';
import { toast } from '../../ui/toast';
import { avisarSancion } from '../account/SancionesHost';
import { formatMoney } from '../../lib/format';

// RF-51/RF-64: cancelar pide confirmación; el técnico debe dar un motivo, el cliente puede omitirlo.
// Si el técnico ya salió hacia el domicilio, cancelar cuesta la visita (cargo): se avisa antes con el monto.
export async function cancelOrder(id: number | string, rol: 'cliente' | 'tecnico', cargo?: string | null): Promise<boolean> {
  const motivo = await dialog.prompt({
    title: rol === 'cliente' ? (cargo ? 'Cancelar tiene un cargo' : '¿Cancelar la solicitud?') : '¿Dejar este servicio?',
    message: rol === 'cliente'
      ? (cargo
        ? `Tu técnico ya va en camino o está en tu domicilio. Si cancelas, se cobra ${formatMoney(cargo)} por la visita de lo que tienes en custodia y te devolvemos el resto. Si quieres, dinos por qué (opcional).`
        : 'No se te cobra nada y te devolvemos lo que hayas pagado. Si quieres, dinos por qué (opcional).')
      : 'La solicitud vuelve a quedar disponible para otros técnicos. Escribe el motivo para el cliente.',
    placeholder: rol === 'cliente' ? 'Ya no lo necesito, encontré otra opción…' : 'Se me complicó el horario…',
    confirmText: rol === 'cliente' ? (cargo ? `Cancelar y pagar ${formatMoney(cargo, { entero: true })}` : 'Cancelar solicitud') : 'Dejar servicio',
  });
  if (motivo === null) return false;
  if (rol === 'tecnico' && motivo.trim().length < 3) {
    toast.warning('Escribe el motivo de la cancelación.');
    return false;
  }
  try {
    const res = await solicitudesApi.cancelar(id, motivo.trim());
    toast.show(res.mensaje || 'Solicitud cancelada.');
    // Cancelar tras intentar compartir contacto en el chat de la orden es nivel 2 de la escala de sanciones.
    avisarSancion(res.sancion);
    return true;
  } catch (e) {
    toast.error(errorMessage(e));
    return false;
  }
}
