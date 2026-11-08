import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Páginas públicas (catálogo, fichas, buscador, legales): renderizadas en el servidor para SEO y primera
 * carga rápida. Checkout, portal del huésped y backoffice dependen de credenciales del navegador
 * (token de checkout, JWT en memoria o en sessionStorage) y se renderizan en el cliente.
 */
export const serverRoutes: ServerRoute[] = [
  { path: 'backoffice', renderMode: RenderMode.Client },
  { path: 'backoffice/**', renderMode: RenderMode.Client },
  { path: 'mi-estancia', renderMode: RenderMode.Client },
  { path: 'reservar', renderMode: RenderMode.Client },
  { path: 'reservar/**', renderMode: RenderMode.Client },
  { path: 'reserva/**', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server },
];
