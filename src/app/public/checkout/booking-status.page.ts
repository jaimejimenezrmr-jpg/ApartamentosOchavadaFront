import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CheckoutResponse, CheckoutStatusResponse } from '../../core/api/models';
import { PublicApiService } from '../../core/api/public-api.service';
import { problemMessage } from '../../core/api/problem';
import { CheckoutStepsComponent } from './checkout-steps.component';
import { CheckoutStoreService } from './checkout-store.service';

const POLL_MS = 2000;
const MAX_POLLS = 45;

/**
 * Paso 3: estado de la reserva tras el pago. El pago lo confirma Stripe al backend por webhook, así que se
 * consulta el estado unos segundos hasta que la reserva pasa a confirmada (o el pago falla).
 */
@Component({
  selector: 'app-booking-status-page',
  imports: [CurrencyPipe, DatePipe, RouterLink, CheckoutStepsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container page">
      <app-checkout-steps [step]="3" />
      <section class="card stack status">
        @switch (view()) {
          @case ('confirmed') {
            <div class="icon icon--ok" aria-hidden="true">✓</div>
            <h1>¡Reserva confirmada!</h1>
            <p>Localizador <strong class="mono">{{ code() }}</strong>. Le hemos enviado la confirmación por email con el enlace a
              «Mi estancia», donde podrá registrar a los viajeros y, el día de llegada, abrir la puerta desde el móvil.</p>
            @if (checkout(); as c) {
              <dl class="kv">
                <dt>Apartamento</dt><dd>{{ c.stay.roomTypeName }}</dd>
                <dt>Llegada</dt><dd>{{ c.stay.checkIn | date: 'EEEE d MMMM y' }}</dd>
                <dt>Salida</dt><dd>{{ c.stay.checkOut | date: 'EEEE d MMMM y' }}</dd>
                <dt>Total</dt><dd>{{ c.totalAmount | currency: c.currency }}</dd>
                @if (status(); as s) { <dt>Pagado</dt><dd>{{ s.paidAmount | currency: s.currency }}</dd> }
              </dl>
            }
          }
          @case ('processing') {
            <div class="loading"><span class="spinner" aria-hidden="true"></span></div>
            <h1>Confirmando su pago…</h1>
            <p class="muted">Estamos esperando la confirmación del banco. No cierre esta ventana.</p>
          }
          @case ('delayed') {
            <h1>Su pago se está procesando</h1>
            <p>El banco está tardando más de lo habitual. Recibirá un email en cuanto se confirme la reserva
              <strong class="mono">{{ code() }}</strong>; no es necesario repetir el pago.</p>
          }
          @case ('failed') {
            <div class="icon icon--ko" aria-hidden="true">!</div>
            <h1>El pago no se ha completado</h1>
            <p>{{ status()?.paymentFailureMessage || 'El banco ha rechazado la operación.' }}</p>
            <a routerLink="/reservar/pago" class="btn">Intentarlo de nuevo</a>
          }
          @case ('released') {
            <h1>La reserva no se ha completado</h1>
            <p>El plazo de pago terminó o la reserva se canceló, y el apartamento se ha liberado.</p>
            <a routerLink="/buscar" class="btn">Buscar de nuevo</a>
          }
          @case ('unknown') {
            <h1>Reserva {{ code() }}</h1>
            <p>Consulte el email de confirmación para ver el estado de su reserva y acceder a «Mi estancia».</p>
          }
          @case ('error') {
            <div class="alert alert--danger">{{ error() }}</div>
          }
        }
      </section>
    </div>
  `,
  styles: `
    .page { padding-top: 24px; }
    .status { max-width: 720px; }
    .icon { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; font-size: 1.8rem; font-weight: 700; }
    .icon--ok { background: var(--c-success-soft); color: var(--c-success); }
    .icon--ko { background: var(--c-danger-soft); color: var(--c-danger); }
  `,
})
export class BookingStatusPage implements OnInit {
  private readonly api = inject(PublicApiService);
  private readonly store = inject(CheckoutStoreService);
  private readonly destroyRef = inject(DestroyRef);

  readonly code = input.required<string>();

  protected readonly checkout = signal<CheckoutResponse | null>(null);
  protected readonly status = signal<CheckoutStatusResponse | null>(null);
  protected readonly view = signal<'processing' | 'confirmed' | 'delayed' | 'failed' | 'released' | 'unknown' | 'error'>('processing');
  protected readonly error = signal<string | null>(null);
  private stopped = false;

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => (this.stopped = true));
    const checkout = this.store.get(this.code());
    this.checkout.set(checkout);
    if (!checkout) {
      this.view.set('unknown');
      return;
    }
    if (checkout.status === 'CONFIRMED') {
      this.view.set('confirmed');
    }
    void this.poll(checkout, 0);
  }

  private async poll(checkout: CheckoutResponse, attempt: number): Promise<void> {
    if (this.stopped) return;
    try {
      const status = await firstValueFrom(this.api.checkoutStatus(checkout.reservationCode, checkout.checkoutToken));
      this.status.set(status);
      if (status.status === 'CONFIRMED' || status.status === 'CHECKED_IN' || status.status === 'CHECKED_OUT') {
        this.view.set('confirmed');
        this.store.forget(checkout.reservationCode);
        this.store.save({ ...checkout, status: status.status, payment: null });
        return;
      }
      if (status.status === 'CANCELLED' || status.status === 'NO_SHOW') {
        this.view.set('released');
        return;
      }
      if (status.paymentStatus === 'FAILED' || status.paymentStatus === 'REQUIRES_ACTION') {
        this.view.set('failed');
        return;
      }
    } catch (error) {
      if (attempt === 0) {
        this.error.set(problemMessage(error));
        this.view.set('error');
        return;
      }
    }
    if (attempt + 1 >= MAX_POLLS) {
      this.view.set('delayed');
      return;
    }
    setTimeout(() => void this.poll(checkout, attempt + 1), POLL_MS);
  }
}
