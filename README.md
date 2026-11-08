# Apartamentos Ochavada · Frontend

Angular 22 (standalone, zoneless, signals) con SSR en Node/Express. Una sola aplicación con tres áreas:

| Área | Rutas | Renderizado |
|---|---|---|
| Web pública y motor de reservas | `/`, `/apartamentos/:slug`, `/buscar`, `/condiciones`, `/privacidad`, `/aviso-legal` | Servidor (SEO, 404 reales) |
| Checkout en 2 pasos (Stripe Payment Element) | `/reservar`, `/reservar/pago`, `/reserva/:code` | Cliente |
| Portal del huésped «Mi estancia» | `/mi-estancia#acceso=<token>` | Cliente |
| Backoffice / PMS | `/backoffice/**` | Cliente |

## Estructura

```
src/app
├── core/
│   ├── api/       Modelos tipados de la API, servicios por área, interceptor y errores RFC 7807
│   ├── auth/      Sesión del personal (JWT en memoria + refresh por cookie HttpOnly), sesión del huésped, guards
│   ├── config/    Datos del establecimiento en tiempo de ejecución (PROPERTY_*) y origen de la API
│   └── util/      Fechas de calendario en la zona horaria del alojamiento
├── public/        Portada, ficha, buscador, checkout, portal del huésped y páginas legales
├── backoffice/    Panel, rack (Gantt con arrastrar y soltar), reservas, huéspedes, limpieza, tarifas,
│                  facturas, SES.HOSPEDAJES, cerraduras, catálogo y channel manager
└── shared/        Etiquetas en español, países ISO alfa-3, formulario de viajeros, avisos, diálogos
```

Permisos del backoffice por rol: ADMIN &gt; RECEPTIONIST &gt; HOUSEKEEPING (limpieza solo ve su tablero).

## Seguridad

- **Personal:** el access token vive solo en memoria; el refresh token es una cookie `HttpOnly; SameSite=Strict`
  limitada a `/api/v1/auth`. Al recargar, la sesión se recupera con un refresh silencioso; un 401 provoca
  un único intento de renovación y, si falla, vuelta al login.
- **Huésped:** el enlace mágico lleva el token en el fragmento (`#acceso=`), que no llega a los registros del
  servidor; se canjea una vez por un JWT de huésped guardado en `sessionStorage`.
- **Checkout:** el token del checkout y la clave de idempotencia van en `sessionStorage`; los datos de la
  tarjeta van del navegador a Stripe y nunca pasan por la aplicación.
- Las facturas HTML del backend se muestran en un `iframe` con `sandbox` sin scripts.

## Desarrollo

Requisitos: Node 22+ (probado con Node 26 LTS).

```bash
npm install
```

Backend local sin Docker ni PostgreSQL instalado (PostgreSQL embebido; los datos se pierden al parar). Crea
el administrador `admin@ochavada.local` / `Admin-Local-2026!`:

```bash
cd ../ApartamentosOchavadaBackend && ./mvnw spring-boot:test-run -Dspring-boot.run.main-class=com.ochavada.backend.LocalDevServer
```

Frontend con recarga en caliente (el proxy `proxy.conf.json` envía `/api` a `http://localhost:8080`):

```bash
npm start
```

Abra http://localhost:4200. Para el pago online hacen falta claves de prueba de Stripe en el backend
(`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`); sin ellas solo se pueden reservar
tarifas sin prepago.

## Tests y compilación

```bash
npm test
```

```bash
npm run build
```

```bash
npm run serve:ssr
```

## Despliegue con Docker

La imagen se construye con el `Dockerfile` de este repositorio y se despliega junto al resto de servicios
(PostgreSQL, frontend/backend y Caddy) con el Docker Compose de `../ApartamentosOchavadaInfra`; ver su README.

## Variables del servidor SSR

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor Node (por defecto 4000) |
| `API_INTERNAL_URL` | URL del backend para renderizar en el servidor (en Docker: `http://backend:8080`) |
| `PROPERTY_NAME`, `PROPERTY_LEGAL_NAME`, `PROPERTY_TAX_ID` | Nombre comercial, titular y NIF (aviso legal) |
| `PROPERTY_ADDRESS`, `PROPERTY_PHONE`, `PROPERTY_EMAIL` | Contacto mostrado en la web |
| `PROPERTY_TOURISM_REGISTRY` | Número del Registro de Turismo de Andalucía |
| `PROPERTY_CHECK_IN_TIME`, `PROPERTY_CHECK_OUT_TIME` | Horarios mostrados (por defecto 15:00 y 11:00) |

En producción `/api/**` debe llegar al backend por el mismo dominio (Caddy) y el resto al servidor SSR.
`GET /healthz` responde `{"status":"UP"}` para las comprobaciones de salud.

Los textos de las páginas legales se generan con estos datos: revíselos con su asesor antes de publicar.
