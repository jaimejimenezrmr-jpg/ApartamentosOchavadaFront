import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GuestTokenResponse } from '../api/models';

const STORAGE_KEY = 'ochavada.guest-session';

interface StoredGuestSession {
  token: string;
  expiresAt: string;
  reservationCode: string;
}

/**
 * Sesión del huésped en el portal «Mi estancia». El enlace mágico se canjea por un JWT de huésped ligado a
 * una reserva; se guarda en `sessionStorage` (se borra al cerrar la pestaña) y nunca en una cookie.
 */
@Injectable({ providedIn: 'root' })
export class GuestSessionService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly session = signal<StoredGuestSession | null>(this.read());

  token(): string | null {
    const s = this.session();
    if (!s) return null;
    if (Date.parse(s.expiresAt) <= Date.now()) {
      this.clear();
      return null;
    }
    return s.token;
  }

  store(response: GuestTokenResponse): void {
    const s: StoredGuestSession = {
      token: response.accessToken,
      expiresAt: response.expiresAt,
      reservationCode: response.reservationCode,
    };
    this.session.set(s);
    if (this.isBrowser) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      } catch {
        // Navegación privada sin almacenamiento: la sesión dura lo que la página.
      }
    }
  }

  clear(): void {
    this.session.set(null);
    if (this.isBrowser) {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignorado.
      }
    }
  }

  private read(): StoredGuestSession | null {
    if (!this.isBrowser) return null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredGuestSession;
      return typeof parsed.token === 'string' && Date.parse(parsed.expiresAt) > Date.now() ? parsed : null;
    } catch {
      return null;
    }
  }
}
