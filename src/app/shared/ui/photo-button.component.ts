import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { ToastService } from './toast.service';
import { preparePhoto } from './photo';

/**
 * Botón «Foto»: en el móvil abre directamente la cámara trasera; en el ordenador, el selector de archivos.
 * Emite la foto ya reducida y en JPEG.
 */
@Component({
  selector: 'app-photo-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="btn btn--secondary btn--sm photo-btn" [class.is-busy]="working()" [class.is-disabled]="disabled()">
      <input type="file" accept="image/*" capture="environment" (change)="pick($event)" [disabled]="disabled() || working()">
      @if (working()) { <span class="spinner"></span> } {{ label() }}
    </label>
  `,
  styles: `
    .photo-btn { position: relative; cursor: pointer; }
    .photo-btn input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; }
    .is-disabled { opacity: 0.55; pointer-events: none; }
  `,
})
export class PhotoButtonComponent {
  private readonly toast = inject(ToastService);
  readonly label = input('📷 Foto');
  readonly disabled = input(false);
  readonly picked = output<Blob>();
  protected readonly working = signal(false);

  protected async pick(event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;
    this.working.set(true);
    try {
      this.picked.emit(await preparePhoto(file));
    } catch (e) {
      this.toast.error(e);
    } finally {
      this.working.set(false);
    }
  }
}
