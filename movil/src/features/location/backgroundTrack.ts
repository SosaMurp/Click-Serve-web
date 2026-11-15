import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { tecnicoApi } from '../../api/endpoints';
import { dialog } from '../../ui/dialog';

// RNF-43: ubicación del técnico mientras va EN_CAMINO, también con la app en segundo plano o la pantalla apagada.
// Android usa un servicio en primer plano (notificación fija "Compartiendo tu ubicación"); iOS muestra el indicador azul.
// Expo Go y la web no permiten tareas en segundo plano: ahí sigue el envío cada 4 s con la app abierta.
export const TAREA_UBICACION = 'cs-ubicacion-en-camino';

let ultimoEnvio = 0;

// La tarea debe definirse al cargar el módulo (antes de montar la app), por eso se importa desde app/_layout.
if (Platform.OS !== 'web') {
  try {
    TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(TAREA_UBICACION, async ({ data, error }) => {
      if (error || !data?.locations?.length) return;
      const ahora = Date.now();
      if (ahora - ultimoEnvio < 3000) return; // el sistema puede entregar ráfagas: máx. un envío cada 3 s
      ultimoEnvio = ahora;
      const { latitude, longitude } = data.locations[data.locations.length - 1].coords;
      try {
        await tecnicoApi.ubicacion(latitude, longitude);
      } catch { /* sin red: se reintenta con la siguiente lectura */ }
    });
  } catch { /* módulo nativo ausente */ }
}

// Solo una compilación propia (EAS / desarrollo) en Android o iOS puede rastrear en segundo plano.
export function segundoPlanoDisponible(): boolean {
  return Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

let yaPreguntado = false;

async function permisoSegundoPlano(): Promise<boolean> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    const r = await Location.requestForegroundPermissionsAsync();
    if (r.status !== 'granted') return false;
  }
  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status === 'granted') return true;
  if (yaPreguntado || !bg.canAskAgain) return false;
  yaPreguntado = true;
  // Android 11+ abre los ajustes del sistema: primero se explica por qué.
  const ok = await dialog.confirm({
    title: 'Comparte tu ubicación en el camino',
    message:
      'Para que el cliente vea que vas en camino aunque uses el mapa u otra app, permite la ubicación "Todo el tiempo". '
      + 'Solo se comparte mientras el servicio está En camino.',
    confirmText: 'Permitir',
    cancelText: 'Ahora no',
  });
  if (!ok) return false;
  const r = await Location.requestBackgroundPermissionsAsync();
  return r.status === 'granted';
}

// Devuelve true si quedó rastreando en segundo plano; false para usar el respaldo en primer plano.
export async function iniciarRastreo(): Promise<boolean> {
  if (!segundoPlanoDisponible()) return false;
  try {
    if (!(await permisoSegundoPlano())) return false;
    if (await Location.hasStartedLocationUpdatesAsync(TAREA_UBICACION)) return true;
    await Location.startLocationUpdatesAsync(TAREA_UBICACION, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 15,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      activityType: Location.ActivityType.AutomotiveNavigation,
      foregroundService: {
        notificationTitle: 'Click & Serve',
        notificationBody: 'Compartiendo tu ubicación con el cliente mientras vas en camino.',
        notificationColor: '#1D4ED8',
        killServiceOnDestroy: true,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function detenerRastreo(): Promise<void> {
  if (!segundoPlanoDisponible()) return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TAREA_UBICACION)) await Location.stopLocationUpdatesAsync(TAREA_UBICACION);
  } catch { /* la tarea ya no existía */ }
}
