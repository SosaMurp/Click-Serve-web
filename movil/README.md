# Click & Serve · app móvil

App de clientes y técnicos hecha con Expo (React Native + expo-router). Habla con el backend único del repositorio
(`../backend`), el mismo que usa el panel de administración.

## Correrla

```bash
npm install
cp .env.example .env     # EXPO_PUBLIC_API_URL: http://localhost:3000, o la IP de la PC si usas un teléfono
npx expo start
```

El backend debe estar corriendo (`cd ../backend && npm start`). En un teléfono físico `localhost` es el teléfono:
usa la IP de tu PC en la red local, por ejemplo `http://192.168.1.20:3000`. Fuera de desarrollo la app solo acepta URLs
`https://`.

## Estructura

- `app/` rutas (expo-router): `(auth)`, `(cliente)`, `(tecnico)` y `(comun)`.
- `src/api/` cliente HTTP y tipos del backend; `src/features/` pantallas por dominio; `src/design/` sistema de diseño
  (mismos colores y tipografía que el panel web); `src/lib/` utilidades con pruebas en `src/lib/__tests__/`.
- `docs/REPORTE-CAMBIOS.md` historial de cambios y requisitos cubiertos.

## Pruebas

```bash
npm test               # utilidades (formato, estados, URL del API, análisis de la foto de la INE…)
npx tsc --noEmit       # tipos
```

> Este código viene de la copia de trabajo `Click-Serve-MOVI`; cuando una pantalla cambie allá, copia el cambio aquí
> (o al revés) para que no se separen.
