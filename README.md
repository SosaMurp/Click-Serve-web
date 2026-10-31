# Click & Serve

Marketplace de servicios a domicilio en Lázaro Cárdenas, Michoacán: clientes piden un técnico (electricidad, plomería,
cómputo y redes…), el técnico cotiza, hace el trabajo y cobra desde la app. Este repositorio reúne las tres piezas.

| Carpeta | Qué es |
|---|---|
| `src/` (raíz) | Panel web de administración: React 19 + Vite + TypeScript. Validación de técnicos, finanzas y retiros, soporte e incidencias, mapa en vivo, configuración y reportes. |
| `backend/` | **Un solo backend** para el panel y la app: Express 5 + PostgreSQL, WebSocket en `/ws`. Detalles en [`backend/README.md`](backend/README.md). |
| `movil/` | App móvil de clientes y técnicos: Expo + React Native. Ver [`movil/README.md`](movil/README.md). |

## Levantar todo en local

Requisitos: Node 20 o superior y PostgreSQL 17 (o similar).

```bash
# 1. Base de datos y backend (puerto 3000)
psql -h localhost -U postgres -c "CREATE DATABASE clickyserve_db"
cd backend
npm install
cp .env.example .env        # llena DB_*, y pon NODE_ENV=development, JWT_SECRET y FILES_SECRET
npm start                   # aplica las migraciones solas
npm run db:seed             # opcional: cuentas de prueba de cliente y técnico (otra terminal)

# 2. Administrador de prueba y panel web (puerto 5173; reenvía /api al backend)
node scripts/create-test-admin.js    # guarda sus credenciales en backend/test-admin.local (ignorado por git)
cd ..
npm install
npm run dev
```

Al iniciar sesión en el panel se pide un código de 6 dígitos que llega por correo. En desarrollo no hace falta SMTP:
el código se imprime en la consola del backend, o se consulta con `node scripts/create-test-admin.js otp`.

Otro destino para el panel: `API_TARGET=http://otra-maquina:3000 npm run dev`.

La app móvil se levanta aparte (`cd movil && npm install && npx expo start`); ver su README.

## Pruebas

```bash
cd backend && npm test      # necesita la base clickyserve_test (la reinicia en cada archivo)
cd movil && npm test        # pruebas de las utilidades de la app
npx tsc --noEmit            # tipos del panel (desde la raíz)
```

## Cosas que conviene saber

- **Roles:** 1 cliente, 2 técnico, 3 administrador. El registro público nunca crea administradores; se dan de alta
  desde el panel (Directorio de cuentas → Nuevo coadministrador).
- **Configuración desde el panel:** comisión, retiro mínimo, multa operativa estándar, radio de búsqueda y minutos para
  aceptar los lee la app en vivo; el modo mantenimiento responde 503 a clientes y técnicos.
- **Pagos:** sin `CONEKTA_PRIVATE_KEY` los cobros son de prueba (solo en desarrollo). Un reembolso asentado desde el
  panel queda registrado en el cobro; si el cargo fue real, la devolución a la tarjeta se hace desde Conekta.
- **Secretos:** nunca van en el código. `.env`, `.env.local` y `test-admin.local` están ignorados por git.
