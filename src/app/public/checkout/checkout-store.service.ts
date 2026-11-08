import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CheckoutResponse } from '../../core/api/models';

const PREFIX = 'ochavada.checkout.';
const CURRENT = `${PREFIX}current`;
const IDEMPOTENCY = `${PREFIX}idempotency`;

/**
 * Estado del checkout entre pasos y recargas: el token del checkout (credencial para consultar el estado
 * y cancelar la retención) y la respuesta del paso 1. Vive en `sessionStorage`, ligado a la pestaña.
 */
@Injectable({ providedIn: 'root' })
export class CheckoutStoreService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  save(response: CheckoutResponse): void {
    this.write(PREFIX + response.reservationCode, JSON.stringify(response));
    this.write(CURRENT, response.reservationCode);
  }

  current(): CheckoutResponse | null {
    const code = this.read(CURRENT);
    return code ? this.get(code) : null;
  }

  get(code: string): CheckoutResponse | null {
    const raw = this.read(PREFIX + code);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CheckoutResponse;
    } catch {
      return null;
    }
  }

  forget(code: string): void {
    this.remove(PREFIX + code);
    if (this.read(CURRENT) === code) this.remove(CURRENT);
  }

  /**
   * Clave de idempotencia de un intento de checkout: la misma mientras no cambien los datos, de modo que un
   * doble clic o un reintento tras un corte de red recupera la misma retención en vez de crear otra.
   */
  idempotencyKey(fingerprint: string): string {
    const raw = this.read(IDEMPOTENCY);
    if (raw) {
      const [fp, key] = raw.split('|');
      if (fp === fingerprint && key) return key;
    }
    const key = this.isBrowser && typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.write(IDEMPOTENCY, `${fingerprint}|${key}`);
    return key;
  }

  resetIdempotency(): void {
    this.remove(IDEMPOTENCY);
  }

  private read(key: string): string | null {
    if (!this.isBrowser) return null;
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    if (!this.isBrowser) return;
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // Sin almacenamiento disponible.
    }
  }

  private remove(key: string): void {
    if (!this.isBrowser) return;
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Ignorado.
    }
  }
}
