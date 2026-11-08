import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-checkout-steps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="steps" aria-label="Pasos de la reserva">
      @for (s of steps; track s.n) {
        <li [class.is-done]="s.n < step()" [class.is-current]="s.n === step()" [attr.aria-current]="s.n === step() ? 'step' : null">
          <span class="steps__n">{{ s.n < step() ? '✓' : s.n }}</span> {{ s.label }}
        </li>
      }
    </ol>
  `,
  styles: `
    .steps { list-style: none; display: flex; gap: 20px; padding: 0; margin: 0 0 20px; flex-wrap: wrap; font-size: 0.9rem; color: var(--c-text-muted); }
    .steps li { display: flex; align-items: center; gap: 8px; }
    .steps__n { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: var(--c-surface-alt);
      border: 1px solid var(--c-border); font-weight: 600; }
    .is-current { color: var(--c-text); font-weight: 600; }
    .is-current .steps__n { background: var(--c-brand); color: #fff; border-color: var(--c-brand); }
    .is-done .steps__n { background: var(--c-success-soft); color: var(--c-success); border-color: transparent; }
  `,
})
export class CheckoutStepsComponent {
  readonly step = input.required<1 | 2 | 3>();
  protected readonly steps = [
    { n: 1, label: 'Sus datos' },
    { n: 2, label: 'Pago seguro' },
    { n: 3, label: 'Confirmación' },
  ];
}
