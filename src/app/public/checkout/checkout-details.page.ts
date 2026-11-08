import { apiResource } from '../../shared/ui/api-resource';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CheckoutRequest } from '../../core/api/models';
import { PublicApiService } from '../../core/api/public-api.service';
import { fieldErrors, problemMessage, toProblem } from '../../core/api/problem';
import { todayInProperty } from '../../core/util/dates';
import { countries } from '../../shared/countries';
import { MEAL_PLAN } from '../../shared/labels';
import { validateStay } from '../shared/search-form.component';
import { CheckoutStoreService } from './checkout-store.service';
import { CheckoutStepsComponent } from './checkout-steps.component';

const PHONE = /^\+?[0-9 ()-]{6,30}$/;

@Component({
  selector: 'app-checkout-details-page',
  imports: [ReactiveFormsModule, CurrencyPipe, DatePipe, RouterLink, CheckoutStepsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container page">
      <app-checkout-steps [step]="1" />
      @if (invalidStay()) {
        <div class="alert alert--warning">{{ invalidStay() }} <a routerLink="/buscar">Volver a buscar</a></div>
      } @else if (availability.isLoading()) {
        <div class="loading"><span class="spinner" aria-label="Comprobando disponibilidad"></span></div>
      } @else if (availability.error()) {
        <div class="alert alert--danger">{{ loadError() }}</div>
      } @else if (!selection()) {
        <div class="alert alert--warning">
          La tarifa elegida ya no está disponible para esas fechas.
          <a routerLink="/buscar" [queryParams]="searchParams()">Ver otras opciones</a>
        </div>
      } @else {
        <div class="layout">
          <form class="card stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <h1>Sus datos</h1>
            <p class="muted small">Los usaremos para la confirmación y el acceso a «Mi estancia». Los campos con * son obligatorios.</p>
            <div class="grid-3" formGroupName="guest">
              <div class="field">
                <label for="c-fn">Nombre *</label>
                <input id="c-fn" formControlName="firstName" autocomplete="given-name" maxlength="100">
                @if (err('guest.firstName')) { <span class="field__error">{{ err('guest.firstName') }}</span> }
              </div>
              <div class="field">
                <label for="c-ln1">Primer apellido *</label>
                <input id="c-ln1" formControlName="lastName1" autocomplete="family-name" maxlength="100">
                @if (err('guest.lastName1')) { <span class="field__error">{{ err('guest.lastName1') }}</span> }
              </div>
              <div class="field">
                <label for="c-ln2">Segundo apellido</label>
                <input id="c-ln2" formControlName="lastName2" maxlength="100">
              </div>
              <div class="field">
                <label for="c-em">Email *</label>
                <input id="c-em" type="email" formControlName="email" autocomplete="email" maxlength="254">
                @if (err('guest.email')) { <span class="field__error">{{ err('guest.email') }}</span> }
              </div>
              <div class="field">
                <label for="c-ph">Teléfono *</label>
                <input id="c-ph" type="tel" formControlName="phone" autocomplete="tel" placeholder="+34 600 000 000" maxlength="30">
                @if (err('guest.phone')) { <span class="field__error">{{ err('guest.phone') }}</span> }
              </div>
              <div class="field">
                <label for="c-co">País de residencia</label>
                <select id="c-co" formControlName="countryCode" autocomplete="country">
                  @for (c of countryList; track c.iso3) { <option [value]="c.iso3">{{ c.name }}</option> }
                </select>
              </div>
            </div>
            <div class="grid-2">
              <div class="field">
                <label for="c-eta">Hora prevista de llegada</label>
                <input id="c-eta" type="time" formControlName="expectedArrivalTime">
              </div>
            </div>
            <div class="field">
              <label for="c-sr">Peticiones especiales</label>
              <textarea id="c-sr" formControlName="specialRequests" maxlength="2000"
                        placeholder="Cuna, llegada tarde, aparcamiento…"></textarea>
            </div>
            <label class="check">
              <input type="checkbox" formControlName="acceptTerms">
              <span>Acepto las <a routerLink="/condiciones" target="_blank">condiciones de reserva</a> y las condiciones de la tarifa *</span>
            </label>
            @if (err('acceptTerms')) { <span class="field__error">{{ err('acceptTerms') }}</span> }
            <label class="check">
              <input type="checkbox" formControlName="acceptPrivacy">
              <span>He leído la <a routerLink="/privacidad" target="_blank">política de privacidad</a> *</span>
            </label>
            @if (err('acceptPrivacy')) { <span class="field__error">{{ err('acceptPrivacy') }}</span> }
            <label class="check">
              <input type="checkbox" formControlName="marketingConsent">
              <span>Quiero recibir ofertas y novedades por email (opcional)</span>
            </label>
            @if (submitError()) { <div class="alert alert--danger" role="alert">{{ submitError() }}</div> }
            <button type="submit" class="btn btn--lg" [disabled]="submitting()">
              @if (submitting()) { <span class="spinner"></span> }
              {{ selection()!.offer.prepaymentAmount > 0 ? 'Continuar al pago' : 'Confirmar reserva' }}
            </button>
          </form>

          <aside class="card summary">
            <h2>{{ selection()!.roomName }}</h2>
            <p class="muted">{{ selection()!.offer.name }} · {{ mealPlan[selection()!.offer.mealPlan] }}</p>
            <dl class="kv">
              <dt>Llegada</dt><dd>{{ checkIn() | date: 'EEE d MMM y' }}</dd>
              <dt>Salida</dt><dd>{{ checkOut() | date: 'EEE d MMM y' }}</dd>
              <dt>Noches</dt><dd>{{ selection()!.offer.nights.length }}</dd>
              <dt>Huéspedes</dt><dd>{{ adultCount() }} adultos@if (childCount()) {, {{ childCount() }} niños}</dd>
            </dl>
            <hr>
            <dl class="kv">
              @for (n of selection()!.offer.nights; track n.date) {
                <dt>{{ n.date | date: 'EEE d MMM' }}</dt><dd class="right">{{ n.price | currency: currency() }}</dd>
              }
            </dl>
            <p class="total"><span>Total</span><strong>{{ selection()!.offer.totalAmount | currency: currency() }}</strong></p>
            @if (selection()!.offer.prepaymentAmount > 0) {
              <p class="small">A pagar ahora: <strong>{{ selection()!.offer.prepaymentAmount | currency: currency() }}</strong></p>
              @if (selection()!.offer.prepaymentAmount < selection()!.offer.totalAmount) {
                <p class="small muted">Resto en el alojamiento: {{ selection()!.offer.totalAmount - selection()!.offer.prepaymentAmount | currency: currency() }}</p>
              }
            } @else {
              <p class="small">Sin pago por adelantado: abonará la estancia en el alojamiento.</p>
            }
            @if (selection()!.offer.refundable && selection()!.offer.freeCancellationUntil) {
              <p class="small ok">✓ Cancelación gratuita hasta el {{ selection()!.offer.freeCancellationUntil | date: 'd MMM y' }}</p>
            } @else if (!selection()!.offer.refundable) {
              <p class="small muted">Tarifa no reembolsable.</p>
            }
          </aside>
        </div>
      }
    </div>
  `,
  styles: `
    .page { padding-top: 24px; }
    .layout { display: grid; gap: 24px; grid-template-columns: minmax(0, 1fr) 360px; align-items: start; }
    .summary { position: sticky; top: 84px; }
    .summary hr { border: 0; border-top: 1px solid var(--c-border); margin: 14px 0; }
    .total { display: flex; justify-content: space-between; align-items: baseline; margin-top: 14px; font-size: 1.05rem; }
    .total strong { font-size: 1.4rem; color: var(--c-brand); }
    .ok { color: var(--c-success); }
    @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } .summary { position: static; order: -1; } }
  `,
})
export class CheckoutDetailsPage {
  private readonly api = inject(PublicApiService);
  private readonly store = inject(CheckoutStoreService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly mealPlan = MEAL_PLAN;
  protected readonly countryList = countries();

  readonly ratePlanId = input<string>();
  readonly checkIn = input<string>('');
  readonly checkOut = input<string>('');
  readonly adults = input<string>('2');
  readonly children = input<string>('0');

  protected readonly adultCount = computed(() => Math.max(1, Number.parseInt(this.adults(), 10) || 1));
  protected readonly childCount = computed(() => Math.max(0, Number.parseInt(this.children(), 10) || 0));
  protected readonly invalidStay = computed(() =>
    this.ratePlanId() ? validateStay(this.checkIn(), this.checkOut(), todayInProperty()) : 'Elija primero un apartamento y una tarifa.',
  );
  protected readonly searchParams = computed(() => ({
    checkIn: this.checkIn(), checkOut: this.checkOut(), adults: this.adultCount(), children: this.childCount(),
  }));

  protected readonly availability = apiResource({
    params: () => (this.invalidStay() ? undefined : this.searchParams()),
    stream: ({ params }) => this.api.availability(params.checkIn, params.checkOut, params.adults, params.children),
  });

  protected readonly selection = computed(() => {
    for (const r of this.availability.data()?.results ?? []) {
      const offer = r.offers.find((o) => o.ratePlanId === this.ratePlanId());
      if (offer) return offer.bookable && r.availableUnits > 0 ? { roomName: r.roomType.name, offer } : null;
    }
    return null;
  });
  protected readonly currency = computed(() => this.availability.data()?.currency ?? 'EUR');
  protected readonly loadError = computed(() => problemMessage(this.availability.error()));

  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  private readonly serverErrors = signal<Record<string, string>>({});

  protected readonly form = this.fb.group({
    guest: this.fb.group({
      firstName: ['', [Validators.required, Validators.maxLength(100)]],
      lastName1: ['', [Validators.required, Validators.maxLength(100)]],
      lastName2: ['', Validators.maxLength(100)],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
      phone: ['', [Validators.required, Validators.pattern(PHONE)]],
      countryCode: ['ESP'],
    }),
    expectedArrivalTime: [''],
    specialRequests: ['', Validators.maxLength(2000)],
    acceptTerms: [false, Validators.requiredTrue],
    acceptPrivacy: [false, Validators.requiredTrue],
    marketingConsent: [false],
  });

  /** Error de un campo: primero el de validación local (si se tocó), después el del servidor. */
  protected err(path: string): string | null {
    const control = this.form.get(path);
    if (control && control.invalid && (control.touched || this.submitted)) {
      if (control.hasError('required')) return 'Campo obligatorio';
      if (control.hasError('email')) return 'Email no válido';
      if (control.hasError('pattern')) return 'Formato no válido';
      if (control.hasError('maxlength')) return 'Demasiado largo';
    }
    return this.serverErrors()[path] ?? null;
  }

  private submitted = false;

  protected async submit(): Promise<void> {
    this.submitted = true;
    this.form.markAllAsTouched();
    const selection = this.selection();
    if (this.form.invalid || !selection) {
      this.submitError.set('Revise los campos marcados.');
      return;
    }
    const v = this.form.getRawValue();
    const request: CheckoutRequest = {
      ratePlanId: selection.offer.ratePlanId,
      checkIn: this.checkIn(),
      checkOut: this.checkOut(),
      adults: this.adultCount(),
      children: this.childCount(),
      guest: {
        firstName: v.guest.firstName.trim(),
        lastName1: v.guest.lastName1.trim(),
        lastName2: v.guest.lastName2.trim() || null,
        email: v.guest.email.trim(),
        phone: v.guest.phone.trim(),
        countryCode: v.guest.countryCode || 'ESP',
      },
      specialRequests: v.specialRequests.trim() || null,
      expectedArrivalTime: v.expectedArrivalTime || null,
      locale: 'es',
      acceptTerms: v.acceptTerms,
      acceptPrivacy: v.acceptPrivacy,
      marketingConsent: v.marketingConsent,
    };
    this.submitting.set(true);
    this.submitError.set(null);
    this.serverErrors.set({});
    try {
      const key = this.store.idempotencyKey(JSON.stringify(request));
      const response = await firstValueFrom(this.api.startCheckout(request, key));
      this.store.save(response);
      this.store.resetIdempotency();
      if (response.payment && response.status === 'PENDING_PAYMENT') {
        await this.router.navigate(['/reservar/pago']);
      } else {
        await this.router.navigate(['/reserva', response.reservationCode]);
      }
    } catch (error) {
      const problem = toProblem(error);
      this.serverErrors.set(fieldErrors(error));
      this.submitError.set(problem.code === 'checkout.sold_out' || problem.status === 409
        ? `${problem.detail} Vuelva a la búsqueda para ver otras opciones.`
        : problemMessage(error));
      if (problem.status !== 0) this.store.resetIdempotency();
    } finally {
      this.submitting.set(false);
    }
  }
}
