import { ChangeDetectionStrategy, Component, ElementRef, input, output, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Diálogo modal nativo (`<dialog>`) para confirmar acciones irreversibles. Si `reasonLabel` está definido,
 * pide un motivo obligatorio (p. ej. cancelaciones).
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dialog class="dialog" (close)="onClose()" (cancel)="onClose()">
      <form method="dialog" (submit)="$event.preventDefault(); accept()">
        <div class="dialog__body stack">
          <h3>{{ title() }}</h3>
          <p class="muted">{{ message() }}</p>
          @if (reasonLabel()) {
            <div class="field">
              <label for="confirm-reason">{{ reasonLabel() }}</label>
              <textarea id="confirm-reason" name="reason" [(ngModel)]="reason" maxlength="500" required></textarea>
            </div>
          }
        </div>
        <div class="dialog__actions">
          <button type="button" class="btn btn--secondary" (click)="close()">Volver</button>
          <button type="submit" class="btn" [class.btn--danger]="danger()" [disabled]="!!reasonLabel() && !reason.trim()">
            {{ confirmLabel() }}
          </button>
        </div>
      </form>
    </dialog>
  `,
})
export class ConfirmDialogComponent {
  readonly title = input.required<string>();
  readonly message = input<string>('');
  readonly confirmLabel = input<string>('Confirmar');
  readonly danger = input<boolean>(false);
  readonly reasonLabel = input<string | null>(null);

  readonly confirmed = output<string>();
  readonly dismissed = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  protected reason = '';
  private accepted = false;

  open(): void {
    this.reason = '';
    this.accepted = false;
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  protected accept(): void {
    if (this.reasonLabel() && !this.reason.trim()) return;
    this.accepted = true;
    this.confirmed.emit(this.reason.trim());
    this.close();
  }

  protected onClose(): void {
    if (!this.accepted) {
      this.dismissed.emit();
    }
  }
}
