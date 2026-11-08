import { apiResource } from '../../shared/ui/api-resource';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BackofficeApiService } from '../../core/api/backoffice-api.service';
import { ReservationStatus } from '../../core/api/models';
import { problemMessage } from '../../core/api/problem';
import { addDays, todayInProperty } from '../../core/util/dates';
import { CHANNEL, RESERVATION_STATUS, reservationTone } from '../../shared/labels';

const ALL_STATUSES = Object.keys(RESERVATION_STATUS) as ReservationStatus[];
const ACTIVE: ReservationStatus[] = ['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN'];

@Component({
  selector: 'app-reservation-list-page',
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row row--between">
      <h1>Reservas</h1>
      <a routerLink="/backoffice/reservas/nueva" class="btn">Nueva reserva</a>
    </div>
    <form class="card row filters" (ngSubmit)="apply()">
      <div class="field grow"><label for="rl-q">Buscar</label>
        <input id="rl-q" type="search" name="q" [(ngModel)]="query" placeholder="Localizador, nombre o email"></div>
      <div class="field"><label for="rl-from">Estancias desde</label><input id="rl-from" type="date" name="from" [(ngModel)]="fromInput"></div>
      <div class="field"><label for="rl-to">hasta</label><input id="rl-to" type="date" name="to" [(ngModel)]="toInput"></div>
      <div class="field"><span class="label">Estado</span>
        <div class="row statuses">
          @for (s of statuses; track s) {
            <label class="check"><input type="checkbox" [checked]="selected().includes(s)" (change)="toggle(s)"> {{ statusLabel[s] }}</label>
          }
        </div></div>
      <button type="submit" class="btn btn--secondary">Aplicar</button>
    </form>

    @if (result.error()) {
      <div class="alert alert--danger">{{ error() }}</div>
    } @else {
      <div class="card table-wrap" [class.is-loading]="result.isLoading()">
        <table class="table">
          <thead><tr>
            <th>Localizador</th><th>Titular</th><th>Estancia</th><th>Unidad</th><th>Canal</th><th>Estado</th>
            <th class="num">Total</th><th class="num">Pendiente</th>
          </tr></thead>
          <tbody>
            @for (r of result.data()?.content ?? []; track r.id) {
              <tr class="is-link" (click)="open(r.id)">
                <td class="mono">{{ r.code }}</td>
                <td>{{ r.holderName }}</td>
                <td class="nowrap">{{ r.checkIn | date: 'd MMM' }} → {{ r.checkOut | date: 'd MMM y' }} <span class="muted">({{ r.nights }} n.)</span></td>
                <td>{{ r.roomNumber ?? '—' }} <span class="muted small">{{ r.roomTypeName }}</span></td>
                <td>{{ channel[r.channel] }}</td>
                <td><span class="badge badge--{{ tone(r.status) }}">{{ statusLabel[r.status] }}</span></td>
                <td class="num">{{ r.totalAmount | currency: r.currency }}</td>
                <td class="num">@if (r.balanceDue > 0) { {{ r.balanceDue | currency: r.currency }} } @else { — }</td>
              </tr>
            } @empty {
              <tr><td colspan="8" class="empty">@if (result.isLoading()) { Cargando… } @else { No hay reservas con estos filtros. }</td></tr>
            }
          </tbody>
        </table>
      </div>
      @if (result.data(); as page) {
        @if (page.totalPages > 1) {
          <div class="row row--end pager">
            <button type="button" class="btn btn--secondary btn--sm" [disabled]="page.page === 0" (click)="pageIndex.set(page.page - 1)">‹ Anterior</button>
            <span class="small">Página {{ page.page + 1 }} de {{ page.totalPages }} · {{ page.totalElements }} reservas</span>
            <button type="button" class="btn btn--secondary btn--sm" [disabled]="page.page + 1 >= page.totalPages" (click)="pageIndex.set(page.page + 1)">Siguiente ›</button>
          </div>
        }
      }
    }
  `,
  styles: `
    .filters { align-items: flex-end; margin: 12px 0 16px; }
    .filters .field { min-width: 150px; }
    .statuses { gap: 4px 12px; }
    .statuses .check { font-size: 0.84rem; }
    .is-loading { opacity: 0.6; }
    .pager { margin-top: 10px; }
  `,
})
export class ReservationListPage {
  private readonly api = inject(BackofficeApiService);
  private readonly router = inject(Router);
  protected readonly statusLabel = RESERVATION_STATUS;
  protected readonly channel = CHANNEL;
  protected readonly statuses = ALL_STATUSES;
  protected readonly tone = reservationTone;

  /** `?q=` desde el buscador rápido de la barra superior. */
  readonly q = input<string>();

  private readonly today = todayInProperty();
  protected query = '';
  protected fromInput = addDays(this.today, -30);
  protected toInput = addDays(this.today, 180);

  private readonly filters = signal({ q: '', from: this.fromInput, to: this.toInput });
  protected readonly selected = signal<ReservationStatus[]>(ACTIVE);
  protected readonly pageIndex = signal(0);

  protected readonly result = apiResource({
    params: () => ({ ...this.filters(), statuses: this.selected(), page: this.pageIndex() }),
    stream: ({ params }) => this.api.searchReservations(params.from, params.to, params.statuses, params.q, params.page),
  });
  protected readonly error = computed(() => problemMessage(this.result.error()));

  constructor() {
    effect(() => {
      const q = this.q();
      if (q) {
        // Búsqueda por localizador: cualquier fecha y estado.
        this.query = q;
        this.fromInput = addDays(this.today, -730);
        this.toInput = addDays(this.today, 730);
        this.selected.set(ALL_STATUSES);
        this.pageIndex.set(0);
        this.filters.set({ q, from: this.fromInput, to: this.toInput });
      }
    });
  }

  protected toggle(status: ReservationStatus): void {
    this.selected.update((list) => (list.includes(status) ? list.filter((s) => s !== status) : [...list, status]));
    this.pageIndex.set(0);
  }

  protected apply(): void {
    if (!this.fromInput || !this.toInput || this.toInput <= this.fromInput) return;
    this.pageIndex.set(0);
    this.filters.set({ q: this.query, from: this.fromInput, to: this.toInput });
  }

  protected open(id: string): void {
    void this.router.navigate(['/backoffice/reservas', id]);
  }
}
