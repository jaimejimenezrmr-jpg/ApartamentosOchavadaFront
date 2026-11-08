import { apiResource } from '../../shared/ui/api-resource';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { AdminApiService } from '../../core/api/admin-api.service';
import { Beds24PollSummary, ImportResult } from '../../core/api/models';
import { problemMessage } from '../../core/api/problem';
import { useAction } from '../../shared/ui/action';

const RESULT_LABEL: Record<ImportResult, string> = {
  CREATED: 'nuevas',
  UPDATED: 'modificadas',
  CANCELLED: 'canceladas',
  UNCHANGED: 'sin cambios',
  NEEDS_REVIEW: 'a revisar',
  OWN_ECHO: 'propias',
  IGNORED: 'ignoradas',
};

/** Conexión con Beds24 (Booking.com, Airbnb, Expedia, Google Hotel Center) y vinculación de habitaciones. */
@Component({
  selector: 'app-channel-page',
  imports: [DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Channel manager · Beds24</h1>
    @if (status.error()) {
      <div class="alert alert--danger">{{ statusError() }}</div>
    } @else if (status.data(); as s) {
      <div class="kpis">
        <div class="card kpi"><span>Integración</span><strong>{{ s.enabled ? (s.connected ? 'Conectada' : 'Sin conectar') : 'Desactivada' }}</strong>
          <small>Horizonte {{ s.syncHorizonDays }} días · {{ s.pushBookings ? 'envía reservas propias' : 'no envía reservas propias' }}</small></div>
        <div class="card kpi"><span>Último sondeo</span><strong>{{ s.lastBookingPollAt ? (s.lastBookingPollAt | date: 'HH:mm') : '—' }}</strong>
          <small>{{ s.lastBookingPollAt ? (s.lastBookingPollAt | date: 'd MMM y') : 'nunca' }}</small></div>
        <div class="card kpi"><span>Cola de envíos</span><strong>{{ s.pendingEvents }}</strong>
          <small>{{ s.failedEvents }} reintentando · <span [class.danger]="s.deadEvents > 0">{{ s.deadEvents }} descartados</span></small></div>
      </div>

      @if (!s.enabled) {
        <div class="alert alert--warning">La integración está desactivada en el servidor (BEDS24_ENABLED=false).</div>
      } @else {
        @if (!s.connected) {
          <form class="card stack" (ngSubmit)="connect()">
            <h3>Conectar con Beds24</h3>
            <p class="small muted">En Beds24: Ajustes → Marketplace → API → «Generate invite code» con permisos de lectura y escritura de
              reservas, inventario y alojamientos. El código caduca en 24 horas.</p>
            <div class="row">
              <input name="code" class="grow" [(ngModel)]="inviteCode" placeholder="Código de invitación" required>
              <button type="submit" class="btn" [disabled]="action.busy() || !inviteCode.trim()">Conectar</button>
            </div>
          </form>
        }

        <section class="card">
          <div class="card__title"><h3>Acciones</h3></div>
          <div class="row">
            <button type="button" class="btn btn--secondary btn--sm" [disabled]="action.busy() || !s.connected" (click)="sync()">Reenviar inventario y precios</button>
            <button type="button" class="btn btn--secondary btn--sm" [disabled]="action.busy() || !s.connected" (click)="poll()">Buscar reservas nuevas</button>
            <button type="button" class="btn btn--secondary btn--sm" [disabled]="action.busy() || !s.connected" (click)="importUpcoming()">Importar reservas futuras</button>
            <form class="row" (ngSubmit)="importOne()">
              <input name="bid" type="number" min="1" [(ngModel)]="bookingId" placeholder="Nº reserva Beds24" class="narrow">
              <button type="submit" class="btn btn--secondary btn--sm" [disabled]="action.busy() || !bookingId || !s.connected">Reimportar</button>
            </form>
          </div>
          @if (lastSummary()) { <p class="small">{{ lastSummary() }}</p> }
        </section>

        <section class="card">
          <h3>Vinculación del catálogo</h3>
          <p class="small muted">Cada tipología se vincula a una habitación de Beds24 (Catálogo → Tipologías → «ID habitación Beds24»),
            cada unidad a su número de unidad y cada plan a un hueco de precio (price1…price16).</p>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Tipología</th><th>Habitación Beds24</th><th>Unidades vinculadas</th></tr></thead>
              <tbody>
                @for (t of s.roomTypes; track t.roomTypeId) {
                  <tr>
                    <td>{{ t.name }} <span class="mono small muted">{{ t.code }}</span>@if (!t.active) { <span class="badge">Oculta</span> }</td>
                    <td>@if (t.beds24RoomId) { <span class="mono">{{ t.beds24RoomId }}</span> } @else { <span class="badge badge--warning">Sin vincular</span> }</td>
                    <td><span [class.danger]="t.unitsMapped < t.units">{{ t.unitsMapped }} / {{ t.units }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        @if (s.connected) {
          <section class="card">
            <div class="card__title"><h3>Habitaciones en Beds24</h3>
              <button type="button" class="btn btn--ghost btn--sm" (click)="showRemote.set(true); remote.reload()">Consultar</button></div>
            @if (remote.error()) { <div class="alert alert--danger">{{ remoteError() }}</div> }
            @if (remote.data(); as rooms) {
              <div class="table-wrap">
                <table class="table">
                  <thead><tr><th>Alojamiento</th><th>Habitación</th><th>ID</th><th>Vinculada a</th><th>Unidades</th></tr></thead>
                  <tbody>
                    @for (r of rooms; track r.beds24RoomId) {
                      <tr>
                        <td>{{ r.propertyName }}</td><td>{{ r.name }} <span class="small muted">({{ r.qty }} uds.)</span></td>
                        <td class="mono">{{ r.beds24RoomId }}</td>
                        <td>{{ r.mappedRoomTypeCode ?? '—' }}</td>
                        <td class="small">@for (u of r.units; track u.beds24UnitId) { {{ u.beds24UnitId }}→{{ u.mappedRoomNumber ?? '?' }} }</td>
                      </tr>
                    } @empty { <tr><td colspan="5" class="empty">Beds24 no devuelve habitaciones.</td></tr> }
                  </tbody>
                </table>
              </div>
            }
          </section>
        }

        <section class="card small">
          <h3>Webhook de reservas</h3>
          <p>En Beds24 (Ajustes → Alojamiento → Webhooks), configure la URL
            <code>https://&lt;dominio&gt;/api/v1/webhooks/beds24</code>, la versión «2 sin datos personales» y la cabecera personalizada
            <code>X-Ochavada-Webhook-Token: &lt;BEDS24_WEBHOOK_TOKEN&gt;</code>. Además se sondea cada 10 minutos por si se pierde alguna notificación.</p>
        </section>
      }
    } @else {
      <div class="loading"><span class="spinner"></span></div>
    }
  `,
  styles: `
    .kpis { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-bottom: 16px; }
    .kpi { display: flex; flex-direction: column; gap: 2px; padding: 16px; margin: 0 !important; }
    .kpi span { color: var(--c-text-muted); font-size: 0.8rem; font-weight: 600; text-transform: uppercase; }
    .kpi strong { font: 600 1.4rem var(--font-display); }
    .kpi small { color: var(--c-text-muted); }
    .danger { color: var(--c-danger); font-weight: 600; }
    .narrow { width: 170px; }
    code { background: var(--c-surface-alt); padding: 1px 5px; border-radius: 4px; }
  `,
})
export class ChannelPage {
  private readonly api = inject(AdminApiService);
  protected readonly action = useAction();
  protected readonly status = apiResource({ stream: () => this.api.beds24Status() });
  protected readonly statusError = computed(() => problemMessage(this.status.error()));
  protected readonly showRemote = signal(false);
  protected readonly remote = apiResource({
    params: () => this.showRemote() || undefined,
    stream: () => (this.showRemote() ? this.api.beds24Rooms() : of([])),
  });
  protected readonly remoteError = computed(() => problemMessage(this.remote.error()));
  protected readonly lastSummary = signal<string | null>(null);
  protected inviteCode = '';
  protected bookingId: number | null = null;

  protected async connect(): Promise<void> {
    const s = await this.action.run(() => this.api.beds24Connect(this.inviteCode.trim()), 'Beds24 conectado; enviando inventario');
    if (s) {
      this.inviteCode = '';
      this.status.set(s);
    }
  }

  protected async sync(): Promise<void> {
    await this.action.run(() => this.api.beds24Sync(), (r) => `Sincronización encolada para ${r.roomTypesEnqueued} tipologías`);
    this.status.reload();
  }

  protected async poll(): Promise<void> {
    this.describe(await this.action.run(() => this.api.beds24Poll()));
  }

  protected async importUpcoming(): Promise<void> {
    this.describe(await this.action.run(() => this.api.beds24ImportUpcoming()));
  }

  protected async importOne(): Promise<void> {
    const id = Number(this.bookingId);
    const r = await this.action.run(() => this.api.beds24ImportBooking(id));
    if (r) this.lastSummary.set(`Reserva ${id}: ${RESULT_LABEL[r.result]}`);
  }

  private describe(summary: Beds24PollSummary | null): void {
    if (!summary) return;
    const parts = Object.entries(summary.counts).map(([k, v]) => `${v} ${RESULT_LABEL[k as ImportResult]}`);
    this.lastSummary.set(`${summary.total} reservas revisadas${parts.length ? ': ' + parts.join(', ') : ''}`
      + (summary.deferred ? ` · ${summary.deferred} pendientes de reintento` : ''));
    this.status.reload();
  }
}
