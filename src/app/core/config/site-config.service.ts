import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, TransferState, inject, makeStateKey, signal } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { DEFAULT_SITE_CONFIG, SERVER_SITE_CONFIG, SiteConfig } from './site-config';

const STATE_KEY = makeStateKey<SiteConfig>('site-config');

@Injectable({ providedIn: 'root' })
export class SiteConfigService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly transferState = inject(TransferState);
  private readonly serverConfig = inject(SERVER_SITE_CONFIG, { optional: true });
  /** Sin interceptores: la configuración no depende de la sesión. */
  private readonly http = new HttpClient(inject(HttpBackend));

  readonly config = signal<SiteConfig>(DEFAULT_SITE_CONFIG);

  /** Inicialización de la aplicación: en el servidor usa el entorno; en el navegador, el estado SSR o la red. */
  async load(): Promise<void> {
    if (isPlatformServer(this.platformId)) {
      const config = this.serverConfig ?? DEFAULT_SITE_CONFIG;
      this.transferState.set(STATE_KEY, config);
      this.config.set(config);
      return;
    }
    const transferred = this.transferState.get(STATE_KEY, null);
    if (transferred) {
      this.config.set(transferred);
      return;
    }
    try {
      this.config.set({ ...DEFAULT_SITE_CONFIG, ...(await firstValueFrom(this.http.get<Partial<SiteConfig>>('/site-config.json'))) });
    } catch {
      // Sin servidor SSR (p. ej. `ng serve` sin él): valores por defecto.
    }
  }
}
