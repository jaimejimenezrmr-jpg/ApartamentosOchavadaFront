/**
 * Content-Security-Policy de las páginas HTML.
 *
 * - Scripts: solo los propios, los de Stripe (Payment Element) y los inline que llevan el nonce de la
 *   petición. Sin `unsafe-inline` ni `unsafe-eval`.
 * - Estilos: `unsafe-inline` es necesario porque Angular aplica estilos de componentes y enlaces `[style]`
 *   en tiempo de ejecución; no permite ejecutar código.
 * - Imágenes: cualquier origen https (las fotos de los apartamentos se alojan en un CDN).
 * - Marcos: solo Stripe (3-D Secure); la propia web no puede incrustarse en otras (`frame-ancestors`).
 */
export function buildContentSecurityPolicy(nonce: string): string {
  const stripe = 'https://js.stripe.com https://*.js.stripe.com';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' ${stripe} https://maps.googleapis.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://api.stripe.com https://maps.googleapis.com",
    `frame-src ${stripe} https://hooks.stripe.com`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

/** Añade el nonce a los `<script>` en línea (sin `src`) que aún no lo tengan. */
export function injectNonce(html: string, nonce: string): string {
  return html.replace(/<script\b(?![^>]*\bnonce=)(?![^>]*\bsrc=)([^>]*)>/gi, `<script nonce="${nonce}"$1>`);
}
