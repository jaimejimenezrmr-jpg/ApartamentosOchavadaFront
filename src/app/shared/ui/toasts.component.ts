import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toasts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" aria-live="polite" aria-atomic="false">
      @for (toast of service.toasts(); track toast.id) {
        <div class="toast alert alert--{{ toast.kind }}" role="status">
          <span>{{ toast.message }}</span>
          <button type="button" class="btn btn--ghost btn--sm" (click)="service.dismiss(toast.id)" aria-label="Cerrar aviso">✕</button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts { position: fixed; right: 16px; bottom: 16px; z-index: 1000; display: flex; flex-direction: column;
      gap: 8px; width: min(420px, calc(100vw - 32px)); }
    .toast { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; box-shadow: var(--shadow); }
  `,
})
export class ToastsComponent {
  protected readonly service = inject(ToastService);
}
