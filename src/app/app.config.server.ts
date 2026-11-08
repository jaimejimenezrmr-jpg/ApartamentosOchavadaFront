import { HTTP_TRANSFER_CACHE_ORIGIN_MAP } from '@angular/common/http';
import { ApplicationConfig, REQUEST, inject, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { API_ORIGIN, SERVER_SITE_CONFIG, siteConfigFromEnv } from './core/config/site-config';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // Al renderizar en el servidor la API se llama por la red interna (en Docker: http://backend:8080).
    { provide: API_ORIGIN, useFactory: () => (process.env['API_INTERNAL_URL'] ?? 'http://localhost:8080').replace(/\/$/, '') },
    // Las respuestas cacheadas para el navegador se guardan con el origen público (el de la petición).
    {
      provide: HTTP_TRANSFER_CACHE_ORIGIN_MAP,
      useFactory: (): Record<string, string> => {
        const request = inject(REQUEST, { optional: true });
        return request ? { [inject(API_ORIGIN)]: new URL(request.url).origin } : {};
      },
    },
    { provide: SERVER_SITE_CONFIG, useFactory: () => siteConfigFromEnv(process.env) },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
