import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { siteConfigFromEnv } from './app/core/config/site-config';
import { buildContentSecurityPolicy, injectNonce } from './csp';

const browserDistFolder = join(import.meta.dirname, '../browser');
const production = process.env['NODE_ENV'] === 'production';

const app = express();
const angularApp = new AngularNodeAppEngine({
  // Detrás de Caddy el esquema real (https) llega en X-Forwarded-Proto. Solo se confía en esa cabecera,
  // y solo si TRUST_PROXY=true (el contenedor no es accesible salvo a través del proxy).
  trustProxyHeaders: process.env['TRUST_PROXY'] === 'true' ? ['x-forwarded-proto'] : false,
});

app.disable('x-powered-by');

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")');
  next();
});

/** Comprobación de salud para Docker/Caddy. */
app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'UP' });
});

/** Datos del establecimiento para las páginas renderizadas en el cliente (sin secretos). */
app.get('/site-config.json', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json(siteConfigFromEnv(process.env));
});

/** Ficheros estáticos con huella: caché larga. */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * El resto lo renderiza Angular (SSR o CSR según `app.routes.server.ts`). En producción cada página HTML
 * lleva una Content-Security-Policy con un nonce aleatorio por petición, que se añade a los scripts en
 * línea que genera Angular (p. ej. la reproducción de eventos de la hidratación).
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then(async (response) => {
      if (!response) {
        next();
        return;
      }
      const isHtml = (response.headers.get('content-type') ?? '').includes('text/html');
      if (!production || !isHtml) {
        await writeResponseToNodeResponse(response, res);
        return;
      }
      const nonce = randomBytes(16).toString('base64');
      const headers = new Headers(response.headers);
      headers.set('Content-Security-Policy', buildContentSecurityPolicy(nonce));
      headers.delete('content-length');
      const html = injectNonce(await response.text(), nonce);
      await writeResponseToNodeResponse(new Response(html, { status: response.status, headers }), res);
    })
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = Number(process.env['PORT'] || 4000);
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }
    console.log(`Servidor SSR escuchando en http://localhost:${port}`);
  });
}

/** Manejador usado por el CLI de Angular (servidor de desarrollo y compilación). */
export const reqHandler = createNodeRequestHandler(app);
