import { apiResource } from '../../shared/ui/api-resource';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BackofficeApiService } from '../../core/api/backoffice-api.service';
import { HousekeepingStatus, ReservationSummary } from '../../core/api/models';
import { problemMessage } from '../../core/api/problem';
import { addDays, todayInProperty } from '../../core/util/dates';
import { CHANNEL, HOUSEKEEPING_STATUS, RESERVATION_STATUS, housekeepingTone, reservationTone } from '../../shared/labels';

@Component({
  selector: 'app-dashboard-page',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row row--between head">
      <h1>Panel del {{ date() | date: 'EEEE d MMMM' }}</h1>
      <div class="row">
        <button type="button" class="btn btn--secondary btn--sm" (click)="shift(-1)">‹ Día anterior</button>
        <input type="date" [value]="date()" (change)="setDate($any($event.target).value)" aria-label="Fecha">
        <button type="button" class="btn btn--secondary btn--sm" (click)="shift(1)">Día siguiente ›</button>
      </div>
    </div>

    @if (data.isLoading() && !data.data()) {
      <div class="loading"><span class="spinner"></span></div>
    } @else if (data.error()) {
      <div class="alert alert--danger">{{ error() }}</div>
    } @else if (data.data(); as d) {
      <div class="kpis">
        <div class="card kpi"><span>Ocupación</span><strong>{{ d.occupancyPercent | number: '1.0-1' }} %</strong>
          <small>{{ d.occupiedRooms }} de {{ d.activeRooms }} unidades</small></div>
        <div class="card kpi"><span>En casa</span><strong>{{ d.inHouse }}</strong><small>reservas alojadas</small></div>
        <div class="card kpi"><span>Ingresos del mes</span><strong>{{ d.revenueMonthToDate | currency: d.currency: 'symbol': '1.0-0' }}</strong>
          <small>ADR {{ d.adrMonthToDate | currency: d.currency }} · RevPAR {{ d.revparMonthToDate | currency: d.currency }}</small></div>
        <div class="card kpi"><span>Facturado del mes</span><strong>{{ d.invoicedMonthToDate | currency: d.currency: 'symbol': '1.0-0' }}</strong></div>
      </div>

      @if (d.unassignedArrivals || d.sesReportsOverdue || d.sesReportsNeedingAction || d.pendingPaymentHolds) {
        <div class="stack alerts">
          @if (d.unassignedArrivals) {
            <div class="alert alert--warning">{{ d.unassignedArrivals }} llegada(s) sin unidad asignada. <a routerLink="/backoffice/rack">Asignar en el rack</a></div>
          }
          @if (d.sesReportsOverdue) {
            <div class="alert alert--danger">{{ d.sesReportsOverdue }} comunicación(es) a SES.HOSPEDAJES fuera de plazo. <a routerLink="/backoffice/ses">Revisar</a></div>
          } @else if (d.sesReportsNeedingAction) {
            <div class="alert alert--warning">{{ d.sesReportsNeedingAction }} comunicación(es) a SES.HOSPEDAJES requieren atención. <a routerLink="/backoffice/ses">Revisar</a></div>
          }
          @if (d.pendingPaymentHolds) {
            <div class="alert alert--info">{{ d.pendingPaymentHolds }} reserva(s) web esperando el pago.</div>
          }
        </div>
      }

      <div class="cols">
        <section class="card">
          <div class="card__title"><h2>Llegadas ({{ d.arrivals.length }})</h2></div>
          @if (!d.arrivals.length) { <p class="empty">Sin llegadas.</p> }
          <div class="table-wrap">
            <table class="table">
              <tbody>
                @for (r of d.arrivals; track r.id) {
                  <tr class="is-link" (click)="open(r)">
                    <td><strong>{{ r.holderName }}</strong><br><span class="small muted">{{ r.code }} · {{ channel[r.channel] }}</span></td>
                    <td>{{ r.roomNumber ?? '— sin unidad' }}<br><span class="small muted">{{ r.roomTypeName }}</span></td>
                    <td><span class="badge badge--{{ tone(r.status) }}">{{ status[r.status] }}</span></td>
                    <td class="num">@if (r.balanceDue > 0) { <span class="badge badge--warning">{{ r.balanceDue | currency: r.currency }}</span> }</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
        <section class="card">
          <div class="card__title"><h2>Salidas ({{ d.departures.length }})</h2></div>
          @if (!d.departures.length) { <p class="empty">Sin salidas.</p> }
          <div class="table-wrap">
            <table class="table">
              <tbody>
                @for (r of d.departures; track r.id) {
                  <tr class="is-link" (click)="open(r)">
                    <td><strong>{{ r.holderName }}</strong><br><span class="small muted">{{ r.code }}</span></td>
                    <td>{{ r.roomNumber ?? '—' }}</td>
                    <td><span class="badge badge--{{ tone(r.status) }}">{{ status[r.status] }}</span></td>
                    <td class="num">@if (r.balanceDue > 0) { <span class="badge badge--warning">{{ r.balanceDue | currency: r.currency }}</span> }</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
        <section class="card">
          <div class="card__title"><h2>Limpieza</h2><a routerLink="/backoffice/limpieza" class="small">Tablero</a></div>
          <p>{{ d.openHousekeepingTasks }} tarea(s) abiertas.</p>
          <div class="row">
            @for (s of hkStatuses; track s) {
              @if (d.roomsByHousekeepingStatus[s]) {
                <span class="badge badge--{{ hkTone(s) }}">{{ hkLabel[s] }}: {{ d.roomsByHousekeepingStatus[s] }}</span>
              }
            }
          </div>
        </section>
      </div>
    }
  `,
  styles: `
    .head { margin-bottom: 16px; }
    .head h1 { margin: 0; }
    .head h1::first-letter { text-transform: uppercase; }
    .head input { width: auto; min-height: 32px; }
    .kpis { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
    .kpi { display: flex; flex-direction: column; gap: 2px; padding: 16px; }
    .kpi span { color: var(--c-text-muted); font-size: 0.82rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
    .kpi strong { font: 600 1.7rem var(--font-display); }
    .kpi small { color: var(--c-text-muted); }
    .alerts { margin-top: 16px; }
    .cols { display: grid; gap: 16px; margin-top: 16px; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); align-items: start; }
    .cols .card + .card { margin-top: 0; }
  `,
})
export class DashboardPage {
  private readonly api = inject(BackofficeApiService);
  private readonly router = inject(Router);
  protected readonly status = RESERVATION_STATUS;
  protected readonly channel = CHANNEL;
  protected readonly hkLabel = HOUSEKEEPING_STATUS;
  protected readonly hkStatuses: HousekeepingStatus[] = ['DIRTY', 'IN_PROGRESS', 'CLEAN', 'INSPECTED', 'OUT_OF_SERVICE'];
  protected readonly tone = reservationTone;
  protected readonly hkTone = housekeepingTone;

  protected readonly date = signal(todayInProperty());
  protected readonly data = apiResource({ params: () => this.date(), stream: ({ params }) => this.api.dashboard(params) });
  protected readonly error = computed(() => problemMessage(this.data.error()));

  protected shift(days: number): void {
    this.date.set(addDays(this.date(), days));
  }

  protected setDate(value: string): void {
    if (value) this.date.set(value);
  }

  protected open(r: ReservationSummary): void {
    void this.router.navigate(['/backoffice/reservas', r.id]);
  }
}
