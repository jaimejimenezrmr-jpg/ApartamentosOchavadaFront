import { InjectionToken } from '@angular/core';

/**
 * Datos del establecimiento que muestra la web (cabecera, pie, páginas legales). Se leen de variables de
 * entorno del servidor SSR (`PROPERTY_*`) y llegan al navegador por `/site-config.json`, de modo que la misma
 * imagen sirve para cualquier entorno sin recompilar.
 */
export interface SiteConfig {
  propertyName: string;
  legalName: string;
  legalTaxId: string;
  address: string;
  phone: string;
  email: string;
  /** Registro de turismo de Andalucía (obligatorio en la publicidad del alojamiento). */
  tourismRegistry: string;
  checkInTime: string;
  checkOutTime: string;
  /**
   * Web en pruebas (`SITE_TEST_MODE=true`): todo funciona, pero se avisa en todas las páginas de que los
   * apartamentos aún no están disponibles y de que las reservas no son reales. Se quita en el lanzamiento.
   */
  testMode: boolean;
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  propertyName: 'Apartamentos Ochavada',
  legalName: 'Apartamentos Ochavada',
  legalTaxId: '',
  address: 'Calle Pescaderías, 6, 14920 Aguilar de la Frontera (Córdoba)',
  phone: '',
  email: 'apartamentosochavada@gmail.com',
  tourismRegistry: '',
  checkInTime: '15:00',
  checkOutTime: '11:00',
  testMode: false,
};

/** Variables de entorno del servidor SSR → configuración del sitio. */
export function siteConfigFromEnv(env: Record<string, string | undefined>): SiteConfig {
  const pick = (key: string, fallback: string) => (env[key] && env[key]!.trim()) || fallback;
  return {
    propertyName: pick('PROPERTY_NAME', DEFAULT_SITE_CONFIG.propertyName),
    legalName: pick('PROPERTY_LEGAL_NAME', pick('PROPERTY_NAME', DEFAULT_SITE_CONFIG.legalName)),
    legalTaxId: pick('PROPERTY_TAX_ID', DEFAULT_SITE_CONFIG.legalTaxId),
    address: pick('PROPERTY_ADDRESS', DEFAULT_SITE_CONFIG.address),
    phone: pick('PROPERTY_PHONE', DEFAULT_SITE_CONFIG.phone),
    email: pick('PROPERTY_EMAIL', DEFAULT_SITE_CONFIG.email),
    tourismRegistry: pick('PROPERTY_TOURISM_REGISTRY', DEFAULT_SITE_CONFIG.tourismRegistry),
    checkInTime: pick('PROPERTY_CHECK_IN_TIME', DEFAULT_SITE_CONFIG.checkInTime),
    checkOutTime: pick('PROPERTY_CHECK_OUT_TIME', DEFAULT_SITE_CONFIG.checkOutTime),
    testMode: pick('SITE_TEST_MODE', 'false').toLowerCase() === 'true',
  };
}

/** Configuración proporcionada por el servidor SSR (solo existe al renderizar en el servidor). */
export const SERVER_SITE_CONFIG = new InjectionToken<SiteConfig>('SERVER_SITE_CONFIG');

/**
 * Origen de la API. En el navegador es el propio origen de la página (Caddy enruta `/api`); al renderizar en
 * el servidor es la URL interna del backend (`API_INTERNAL_URL`). Las URL son absolutas en ambos lados para
 * que la caché de transferencia SSR → navegador las reconozca (ver `HTTP_TRANSFER_CACHE_ORIGIN_MAP`).
 */
export const API_ORIGIN = new InjectionToken<string>('API_ORIGIN', {
  factory: () => (typeof location !== 'undefined' ? location.origin : ''),
});
