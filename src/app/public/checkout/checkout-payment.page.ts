import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { Stripe, StripeElements, StripePaymentElement } from '@stripe/stripe-js';
import { firstValueFrom } from 'rxjs';
import { CheckoutResponse } from '../../core/api/models';
import { PublicApiService } from '../../core/api/public-api.service';
import { problemMessage } from '../../core/api/problem';
import { SiteConfigService } from '../../core/config/site-config.service';
import { CheckoutStepsComponent } from './checkout-steps.component';
import { CheckoutStoreService } from './checkout-store.service';

/**
 * Paso 2: pago del prepago con Stripe Payment Element (tarjeta, Apple Pay, Google Pay, Bizum… según lo
 * activado en Stripe). Los datos de pago van directamente del navegador a Stripe; aquí solo se maneja el
 * `clientSecret` del PaymentIntent. La confirmación definitiva llega al backend por webhook.
 */
@Component({
  selector: 'app-checkout-payment-page',
  imports: [CurrencyPipe, DatePipe, RouterLink, CheckoutStepsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container page">
      <app-checkout-steps [step]="2" />
      @if (!checkout()) {
        <div class="alert alert--warning">
          No hay ninguna reserva en curso en esta ventana. <a routerLink="/buscar">Empezar una reserva</a>
        </div>
      } @else {
        <div class="layout">
          <section class="card stack">
            <h1>Pago seguro</h1>
            @if (site.config().testMode) {
              <div class="alert alert--warning" role="note">
                <strong>Pago de prueba: no se cobra nada.</strong> Los apartamentos aún no están disponibles y esta
                reserva no es real. Para simular el pago use la tarjeta <strong>4242 4242 4242 4242</strong>, cualquier
                fecha futura y cualquier CVC.
              </div>
            }
            @if (expired()) {
              <div class="alert alert--danger">
                El tiempo para completar el pago ha terminado y la reserva se ha liberado.
                <a routerLink="/buscar" [queryParams]="searchParams()">Volver a buscar</a>
              </div>
            } @else {
              <p class="muted small">
                Mantenemos el apartamento reservado para usted durante <strong>{{ remaining() }}</strong>.
              </p>
              <div #paymentElement class="payment-element" [class.is-loading]="!ready()"></div>
              @if (!ready() && !loadError()) {
                <div class="loading"><span class="spinner" aria-label="Cargando el formulario de pago"></span></div>
              }
              @if (loadError()) { <div class="alert alert--danger">{{ loadError() }}</div> }
              @if (payError()) { <div class="alert alert--danger" role="alert">{{ payError() }}</div> }
              <button type="button" class="btn btn--lg" [disabled]="!ready() || paying()" (click)="pay()">
                @if (paying()) { <span class="spinner"></span> }
                Pagar {{ checkout()!.prepaymentAmount | currency: checkout()!.currency }}
              </button>
              <button type="button" class="btn btn--ghost btn--sm" [disabled]="paying()" (click)="abandon()">
                Cancelar y liberar el apartamento
              </button>
              <p class="small muted">🔒 Pago cifrado procesado por Stripe. No guardamos los datos de su tarjeta.</p>
            }
          </section>
          <aside class="card">
            <h2>{{ checkout()!.stay.roomTypeName }}</h2>
            <p class="muted">{{ checkout()!.stay.ratePlanName }}</p>
            <dl class="kv">
              <dt>Localizador</dt><dd class="mono">{{ checkout()!.reservationCode }}</dd>
              <dt>Llegada</dt><dd>{{ checkout()!.stay.checkIn | date: 'EEE d MMM y' }}</dd>
              <dt>Salida</dt><dd>{{ checkout()!.stay.checkOut | date: 'EEE d MMM y' }}</dd>
              <dt>Noches</dt><dd>{{ checkout()!.stay.nights }}</dd>
              <dt>Total</dt><dd>{{ checkout()!.totalAmount | currency: checkout()!.currency }}</dd>
              <dt>Ahora</dt><dd><strong>{{ checkout()!.prepaymentAmount | currency: checkout()!.currency }}</strong></dd>
              @if (checkout()!.amountDueAtProperty > 0) {
                <dt>En el alojamiento</dt><dd>{{ checkout()!.amountDueAtProperty | currency: checkout()!.currency }}</dd>
              }
            </dl>
          </aside>
        </div>
      }
    </div>
  `,
  styles: `
    .page { padding-top: 24px; }
    .layout { display: grid; gap: 24px; grid-template-columns: minmax(0, 1fr) 340px; align-items: start; }
    .payment-element { min-height: 40px; }
    .payment-element.is-loading { min-height: 0; }
    @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } }
  `,
})
export class CheckoutPaymentPage implements OnInit {
  private readonly api = inject(PublicApiService);
  private readonly store = inject(CheckoutStoreService);
  private readonly router = inject(Router);
  protected readonly site = inject(SiteConfigService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = viewChild<ElementRef<HTMLElement>>('paymentElement');

  protected readonly checkout = signal<CheckoutResponse | null>(null);
  protected readonly ready = signal(false);
  protected readonly paying = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly payError = signal<string | null>(null);
  private readonly now = signal(Date.now());

  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private element: StripePaymentElement | null = null;

  protected readonly expiresAt = computed(() => {
    const hold = this.checkout()?.holdExpiresAt;
    return hold ? Date.parse(hold) : null;
  });
  protected readonly expired = computed(() => {
    const at = this.expiresAt();
    return at !== null && this.now() >= at;
  });
  protected readonly remaining = computed(() => {
    const at = this.expiresAt();
    if (at === null) return '';
    const seconds = Math.max(0, Math.round((at - this.now()) / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} min`;
  });
  protected readonly searchParams = computed(() => {
    const s = this.checkout()?.stay;
    return s ? { checkIn: s.checkIn, checkOut: s.checkOut, adults: s.adults, children: s.children } : {};
  });

  ngOnInit(): void {
    const current = this.store.current();
    if (!current) return;
    if (current.status !== 'PENDING_PAYMENT' || !current.payment) {
      void this.router.navigate(['/reserva', current.reservationCode]);
      return;
    }
    this.checkout.set(current);
    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => {
      clearInterval(timer);
      this.element?.destroy();
    });
    void this.mountStripe(current);
  }

  private async mountStripe(checkout: CheckoutResponse): Promise<void> {
    try {
      const { loadStripe } = await import('@stripe/stripe-js');
      this.stripe = await loadStripe(checkout.payment!.publishableKey, { locale: 'es' });
      if (!this.stripe) throw new Error('No se ha podido cargar Stripe');
      this.elements = this.stripe.elements({
        clientSecret: checkout.payment!.clientSecret,
        locale: 'es',
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#7a3b2e',
            colorText: '#2b211c',
            colorDanger: '#b3261e',
            fontFamily: 'Inter, system-ui, sans-serif',
            borderRadius: '6px',
          },
        },
      });
      this.element = this.elements.create('payment', { layout: 'tabs' });
      const host = this.host();
      if (!host) return;
      this.element.on('ready', () => this.ready.set(true));
      this.element.on('loaderror', (e) => this.loadError.set(e.error.message ?? 'No se ha podido cargar el formulario de pago.'));
      this.element.mount(host.nativeElement);
    } catch (error) {
      this.loadError.set(
        error instanceof Error ? `${error.message}. Recargue la página para intentarlo de nuevo.` : 'No se ha podido cargar el pago.',
      );
    }
  }

  protected async pay(): Promise<void> {
    const checkout = this.checkout();
    if (!checkout || !this.stripe || !this.elements || this.paying()) return;
    this.paying.set(true);
    this.payError.set(null);
    try {
      const { error } = await this.stripe.confirmPayment({
        elements: this.elements,
        // Solo se redirige si el método de pago lo exige (3-D Secure de algunos bancos, Bizum...).
        redirect: 'if_required',
        confirmParams: { return_url: `${window.location.origin}/reserva/${encodeURIComponent(checkout.reservationCode)}` },
      });
      if (error) {
        this.payError.set(error.type === 'card_error' || error.type === 'validation_error'
          ? (error.message ?? 'El pago no se ha completado.')
          : 'No se ha podido completar el pago. Inténtelo de nuevo o use otro método.');
        return;
      }
      await this.router.navigate(['/reserva', checkout.reservationCode]);
    } finally {
      this.paying.set(false);
    }
  }

  protected async abandon(): Promise<void> {
    const checkout = this.checkout();
    if (!checkout) return;
    try {
      await firstValueFrom(this.api.cancelCheckout(checkout.reservationCode, checkout.checkoutToken));
      this.store.forget(checkout.reservationCode);
      await this.router.navigate(['/buscar'], { queryParams: this.searchParams() });
    } catch (error) {
      this.payError.set(problemMessage(error));
    }
  }
}
