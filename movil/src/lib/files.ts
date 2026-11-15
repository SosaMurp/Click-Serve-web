import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import type { LocalFile } from '../api/types';

// Agrega un archivo local a un FormData: en web se convierte en Blob; en nativo se usa File de expo-file-system.
// El fetch global de Expo (expo/fetch) no acepta la forma de React Native { uri, name, type }: lanza un error
// que la app veía como "sin conexión". File implementa Blob (bytes, name y type), que sí sabe enviar.
export async function appendFile(form: FormData, field: string, file: LocalFile): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(file.uri)).blob();
    form.append(field, blob, file.name);
    return;
  }
  form.append(field, new File(file.uri) as unknown as Blob);
}

export async function buildForm(fields: Record<string, unknown>, files: Record<string, LocalFile | LocalFile[] | null | undefined> = {}): Promise<FormData> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null && v !== '') form.append(k, String(v));
  }
  for (const [k, v] of Object.entries(files)) {
    if (!v) continue;
    for (const f of Array.isArray(v) ? v : [v]) await appendFile(form, k, f);
  }
  return form;
}
