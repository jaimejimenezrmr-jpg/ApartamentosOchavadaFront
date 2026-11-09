import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, effect, inject, input, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { BackofficeApiService } from '../../core/api/backoffice-api.service';
import { Uuid } from '../../core/api/models';

/**
 * Miniatura de una foto del centro de operaciones. Las fotos exigen sesión, así que se descargan con la API
 * (que añade el token) y se muestran desde una URL local; al pulsar se abre a tamaño completo.
 */
@Component({
  selector: 'app-protected-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'open.set(false)' },
  template: `
    @if (url(); as u) {
      <button type="button" class="thumb" (click)="open.set(true)" [attr.aria-label]="'Ampliar ' + alt()">
        <img [src]="u" [alt]="alt()" loading="lazy">
      </button>
      @if (open()) {
        <div class="viewer" role="dialog" aria-modal="true" [attr.aria-label]="alt()" (click)="open.set(false)">
          <img [src]="u" [alt]="alt()">
          <button type="button" class="btn btn--secondary btn--sm viewer__close" (click)="open.set(false)">Cerrar</button>
        </div>
      }
    } @else if (failed()) {
      <span class="thumb thumb--empty small muted" title="No se pudo cargar la foto">⚠</span>
    } @else {
      <span class="thumb thumb--empty"><span class="spinner"></span></span>
    }
  `,
  styles: `
    :host { display: inline-block; }
    .thumb { width: 72px; height: 72px; padding: 0; border: 1px solid var(--c-border); border-radius: var(--radius-sm);
      overflow: hidden; background: var(--c-surface-alt); cursor: zoom-in; display: grid; place-items: center; }
    .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .thumb--empty { cursor: default; }
    .viewer { position: fixed; inset: 0; z-index: 1000; background: rgba(20, 12, 8, 0.88); display: grid; place-items: center;
      padding: 16px; cursor: zoom-out; }
    .viewer img { max-width: 100%; max-height: calc(100vh - 80px); border-radius: var(--radius-sm); }
    .viewer__close { position: absolute; top: 12px; right: 12px; }
  `,
})
export class ProtectedImageComponent {
  private readonly api = inject(BackofficeApiService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly mediaId = input.required<Uuid>();
  readonly alt = input('Foto');
  protected readonly url = signal<string | null>(null);
  protected readonly failed = signal(false);
  protected readonly open = signal(false);
  private objectUrl: string | null = null;

  constructor() {
    effect(() => {
      const id = this.mediaId();
      if (!this.browser) return;
      void this.load(id);
    });
    inject(DestroyRef).onDestroy(() => this.release());
  }

  private async load(id: Uuid): Promise<void> {
    this.failed.set(false);
    try {
      const blob = await firstValueFrom(this.api.media(id));
      if (id !== this.mediaId()) return;
      this.release();
      this.objectUrl = URL.createObjectURL(blob);
      this.url.set(this.objectUrl);
    } catch {
      this.failed.set(true);
    }
  }

  private release(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
