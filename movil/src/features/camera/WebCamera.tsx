import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Button, color, Icon, radius, space, Text } from '../../design';
import type { LocalFile } from '../../api/types';

// Cámara en vivo para la versión web (laptop o navegador del celular). En la web, el selector de Expo
// solo abre los archivos, así que "Tomar foto" usa getUserMedia: vista previa, botón de disparo y
// "Repetir" antes de usarla. Si no hay cámara o se niega el permiso, ofrece elegir de la galería.

export type WebCameraResult = LocalFile | 'galeria' | null;
type Request = { front: boolean; resolve: (r: WebCameraResult) => void };

let open: ((r: Request) => void) | null = null;

export function openWebCamera(front = false): Promise<WebCameraResult> {
  return new Promise((resolve) => {
    if (!open) { resolve('galeria'); return; }
    open({ front, resolve });
  });
}

export function WebCameraHost() {
  const [req, setReq] = useState<Request | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    open = (r) => setReq((prev) => { prev?.resolve(null); return r; });
    return () => { open = null; };
  }, []);
  if (Platform.OS !== 'web' || !req) return null;
  const done = (r: WebCameraResult) => { req.resolve(r); setReq(null); };
  return <WebCameraModal front={req.front} onDone={done} />;
}

function WebCameraModal({ front, onDone }: { front: boolean; onDone: (r: WebCameraResult) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [usarFrontal, setUsarFrontal] = useState(front);
  const [foto, setFoto] = useState<{ url: string; blob: Blob } | null>(null);
  const [intento, setIntento] = useState(0);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (foto) return undefined;
    let cancelled = false;
    setListo(false);
    setError(null);
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Este navegador no deja usar la cámara aquí. Ábrelo en Chrome o Edge desde localhost, o con un enlace https.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: usarFrontal ? 'user' : 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
          setListo(true);
        }
      } catch (e) {
        const name = (e as { name?: string })?.name;
        setError(name === 'NotAllowedError'
          ? 'No diste permiso para usar la cámara. Toca el ícono de la cámara en la barra de direcciones del navegador, elige "Permitir" y vuelve a intentar.'
          : name === 'NotFoundError'
            ? 'No encontramos ninguna cámara en este equipo.'
            : 'No pudimos abrir la cámara. Revisa que ninguna otra app (Zoom, Teams, la app Cámara) la esté usando y vuelve a intentar.');
      }
    })();
    return () => { cancelled = true; stop(); };
  }, [usarFrontal, foto, intento]);

  const disparar = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // La cámara frontal se ve como espejo; la foto se guarda igual que la vista previa.
    if (usarFrontal) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      stop();
      setFoto({ url: URL.createObjectURL(blob), blob });
    }, 'image/jpeg', 0.9);
  }, [usarFrontal]);

  const cerrar = (r: WebCameraResult) => { stop(); onDone(r); };

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={() => cerrar(null)}>
      <View style={styles.screen}>
        <Text variant="headline" tone="onColor" align="center">{foto ? '¿Usar esta foto?' : 'Tomar foto'}</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Icon name="camera-off" size={36} color={color.inkOnColor} />
            <Text variant="bodyLg" tone="onColor" align="center">{error}</Text>
          </View>
        ) : (
          <View style={styles.preview}>
            {foto
              ? React.createElement('img', { src: foto.url, alt: 'Foto tomada', style: { width: '100%', height: '100%', objectFit: 'contain', background: '#000' } })
              : React.createElement('video', {
                ref: videoRef,
                playsInline: true,
                muted: true,
                autoPlay: true,
                style: { width: '100%', height: '100%', objectFit: 'contain', background: '#000', transform: usarFrontal ? 'scaleX(-1)' : undefined },
              })}
            {!foto && !listo ? <View style={styles.loading}><Text variant="bodyLg" tone="onColor">Abriendo la cámara…</Text></View> : null}
          </View>
        )}

        <View style={styles.actions}>
          {error ? (
            <>
              <Button title="Intentar de nuevo" variant="white" icon="refresh-cw" size="xl" full onPress={() => setIntento((n) => n + 1)} />
              <Button title="Elegir de la galería" variant="accent" icon="image" size="xl" full onPress={() => cerrar('galeria')} />
            </>
          ) : foto ? (
            <>
              <Button title="Usar foto" variant="accent" icon="check" size="xl" full onPress={() => cerrar({ uri: foto.url, name: `foto-${Date.now()}.jpg`, type: 'image/jpeg' })} />
              <Button title="Repetir" variant="white" icon="rotate-ccw" size="xl" full onPress={() => { URL.revokeObjectURL(foto.url); setFoto(null); }} />
            </>
          ) : (
            <>
              <Pressable accessibilityRole="button" accessibilityLabel="Tomar la foto" onPress={disparar} disabled={!listo} style={[styles.shutter, !listo && styles.shutterOff]}>
                <View style={styles.shutterInner} />
              </Pressable>
              <View style={styles.row}>
                <Button title="Cambiar cámara" variant="white" icon="repeat" onPress={() => setUsarFrontal((x) => !x)} style={styles.flex} full />
                <Button title="Galería" variant="white" icon="image" onPress={() => cerrar('galeria')} style={styles.flex} full />
              </View>
            </>
          )}
          <Pressable accessibilityRole="button" onPress={() => cerrar(null)} style={styles.cancel} hitSlop={8}>
            <Text variant="button" tone="onColor">Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: color.navy, padding: space.lg, justifyContent: 'center', gap: space.lg },
  preview: { width: '100%', maxWidth: 720, aspectRatio: 4 / 3, alignSelf: 'center', backgroundColor: '#000', borderRadius: radius.lg, overflow: 'hidden' },
  loading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  errorBox: { alignItems: 'center', gap: space.md, padding: space.xl, maxWidth: 560, alignSelf: 'center' },
  actions: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: space.sm, alignItems: 'stretch' },
  shutter: { alignSelf: 'center', width: 76, height: 76, borderRadius: 38, borderWidth: 5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  shutterOff: { opacity: 0.4 },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: color.accent },
  row: { flexDirection: 'row', gap: space.sm },
  cancel: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1.5, borderColor: '#FFFFFF' },
});
