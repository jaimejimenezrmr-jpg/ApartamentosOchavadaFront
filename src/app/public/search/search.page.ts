import { apiResource } from '../../shared/ui/api-resource';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RateOffer, RoomTypeAvailability } from '../../core/api/models';
import { PublicApiService } from '../../core/api/public-api.service';
import { problemMessage } from '../../core/api/problem';
import { todayInProperty } from '../../core/util/dates';
import { MEAL_PLAN } from '../../shared/labels';
import { SearchFormComponent, validateStay } from '../shared/search-form.component';

interface Criteria {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
}

@Component({
  selector: 'app-search-page',
  imports: [SearchFormComponent, CurrencyPipe, DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container page">
      <h1>Disponibilidad y precios</h1>
      <app-search-form [initialCheckIn]="checkIn() ?? null" [initialCheckOut]="checkOut() ?? null"
                       [initialAdults]="criteria()?.adults ?? null" [initialChildren]="criteria()?.children ?? null" />

      @if (!criteria()) {
        <p class="empty">Elija las fechas de su estancia para ver los apartamentos disponibles y sus precios.</p>
      } @else if (invalid()) {
        <p class="alert alert--warning results">{{ invalid() }}</p>
      } @else if (availability.isLoading()) {
        <div class="loading"><span class="spinner" aria-label="Buscando disponibilidad"></span></div>
      } @else if (availability.error()) {
        <p class="alert alert--danger results">{{ error() }}</p>
      } @else if (availability.data(); as a) {
        <p class="results muted">
          {{ a.nights }} {{ a.nights === 1 ? 'noche' : 'noches' }} ·
          del {{ a.checkIn | date: 'EEEE d MMMM' }} al {{ a.checkOut | date: 'EEEE d MMMM y' }} ·
          {{ a.adults }} {{ a.adults === 1 ? 'adulto' : 'adultos' }}@if (a.children) {, {{ a.children }} {{ a.children === 1 ? 'niño' : 'niños' }}}
        </p>
        @if (!a.results.length) {
          <div class="card empty">
            <h3>No hay apartamentos disponibles</h3>
            <p>Pruebe con otras fechas o con menos personas por apartamento.</p>
          </div>
        }
        @for (result of a.results; track result.roomType.slug) {
          <article class="card result">
            <div class="result__room">
              @if (result.roomType.coverPhoto; as photo) {
                <img [src]="photo.url" [alt]="photo.altText" loading="lazy" width="320" height="210">
              }
              <div>
                <h2><a [routerLink]="['/apartamentos', result.roomType.slug]">{{ result.roomType.name }}</a></h2>
                <p class="muted small">
                  Hasta {{ result.roomType.maxOccupancy }} personas · {{ result.roomType.bedrooms }} dorm. · {{ result.roomType.bathrooms }} {{ result.roomType.bathrooms === 1 ? 'baño' : 'baños' }}
                </p>
                @if (result.availableUnits > 0 && result.availableUnits <= 2) {
                  <span class="badge badge--warning">{{ result.availableUnits === 1 ? '¡Queda solo 1!' : 'Quedan ' + result.availableUnits }}</span>
                }
              </div>
            </div>
            <div class="offers">
              @for (offer of result.offers; track offer.ratePlanId) {
                <div class="offer" [class.offer--disabled]="!offer.bookable">
                  <div class="offer__info">
                    <h3>{{ offer.name }}</h3>
                    <p class="small muted">{{ mealPlan[offer.mealPlan] }}</p>
                    @if (offer.refundable && offer.freeCancellationUntil) {
                      <p class="small ok">✓ Cancelación gratuita hasta el {{ offer.freeCancellationUntil | date: 'd MMM y' }}</p>
                    } @else if (offer.refundable) {
                      <p class="small muted">Cancelación según condiciones</p>
                    } @else {
                      <p class="small muted">No reembolsable</p>
                    }
                    @if (offer.description) { <p class="small muted">{{ offer.description }}</p> }
                    @for (r of offer.restrictions; track r.code) { <p class="small field__error">{{ r.message }}</p> }
                  </div>
                  <div class="offer__price">
                    <strong>{{ offer.totalAmount | currency: a.currency }}</strong>
                    <span class="small muted">{{ offer.averageNightlyPrice | currency: a.currency }} / noche</span>
                    <span class="small muted">{{ prepaymentText(offer, a.currency) }}</span>
                    <button type="button" class="btn" [disabled]="!offer.bookable" (click)="book(result, offer)">Reservar</button>
                  </div>
                </div>
              }
            </div>
          </article>
        }
      }
    </div>
  `,
  styles: `
    .page { padding-top: 28px; }
    .results { margin-top: 20px; }
    .result { margin-top: 18px; display: grid; gap: 18px; grid-template-columns: 320px minmax(0, 1fr); }
    .result__room img { border-radius: var(--radius-sm); aspect-ratio: 16 / 10.5; object-fit: cover; margin-bottom: 10px; }
    .result__room h2 a { color: var(--c-text); text-decoration: none; }
    .offers { display: flex; flex-direction: column; gap: 10px; }
    .offer { display: flex; justify-content: space-between; gap: 16px; border: 1px solid var(--c-border); border-radius: var(--radius-sm); padding: 14px; }
    .offer--disabled { background: var(--c-surface-alt); }
    .offer__info h3 { margin-bottom: 2px; }
    .offer__info p { margin: 0 0 2px; }
    .offer__price { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; text-align: right; min-width: 170px; }
    .offer__price strong { font-size: 1.35rem; color: var(--c-brand); }
    .offer__price .btn { margin-top: 8px; }
    .ok { color: var(--c-success); }
    @media (max-width: 860px) { .result { grid-template-columns: 1fr; } .offer { flex-direction: column; } .offer__price { align-items: stretch; text-align: left; } }
  `,
})
export class SearchPage {
  private readonly api = inject(PublicApiService);
  private readonly router = inject(Router);
  protected readonly mealPlan = MEAL_PLAN;

  readonly checkIn = input<string>();
  readonly checkOut = input<string>();
  readonly adults = input<string>();
  readonly children = input<string>();

  protected readonly criteria = computed<Criteria | null>(() => {
    const checkIn = this.checkIn();
    const checkOut = this.checkOut();
    if (!checkIn || !checkOut) return null;
    return {
      checkIn,
      checkOut,
      adults: clampInt(this.adults(), 1, 20, 2),
      children: clampInt(this.children(), 0, 20, 0),
    };
  });

  protected readonly invalid = computed(() => {
    const c = this.criteria();
    return c ? validateStay(c.checkIn, c.checkOut, todayInProperty()) : null;
  });

  protected readonly availability = apiResource({
    params: () => (this.criteria() && !this.invalid() ? this.criteria()! : undefined),
    stream: ({ params }) => this.api.availability(params.checkIn, params.checkOut, params.adults, params.children),
  });

  protected readonly error = computed(() => problemMessage(this.availability.error()));

  protected prepaymentText(offer: RateOffer, currency: string): string {
    if (offer.prepaymentAmount <= 0) return 'Pago en el alojamiento';
    const fmt = new Intl.NumberFormat('es-ES', { style: 'currency', currency });
    return offer.prepaymentAmount >= offer.totalAmount
      ? 'Pago íntegro al reservar'
      : `${fmt.format(offer.prepaymentAmount)} al reservar`;
  }

  protected book(result: RoomTypeAvailability, offer: RateOffer): void {
    const c = this.criteria();
    if (!c) return;
    void this.router.navigate(['/reservar'], {
      queryParams: { ratePlanId: offer.ratePlanId, room: result.roomType.slug, ...c },
    });
  }
}

function clampInt(value: string | undefined, min: number, max: number, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
}
