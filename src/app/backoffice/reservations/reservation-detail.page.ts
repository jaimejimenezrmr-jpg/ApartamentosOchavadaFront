import { apiResource } from '../../shared/ui/api-resource';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BackofficeApiService } from '../../core/api/backoffice-api.service';
import { PaymentLine, PaymentProvider, ReservationDetail } from '../../core/api/models';
import { problemMessage, toProblem } from '../../core/api/problem';
import { StaffSessionService } from '../../core/auth/staff-session.service';
import { todayInProperty } from '../../core/util/dates';
import {
  CHANNEL,
  INVOICE_TYPE,
  PAYMENT_MODE,
  PAYMENT_PROVIDER,
  PAYMENT_STATUS,
  RESERVATION_STATUS,
  SES_OPERATION,
  SES_STATUS,
  SES_TYPE,
  reservationTone,
  sesTone,
} from '../../shared/labels';
import { useAction } from '../../shared/ui/action';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog.component';
import { ToastService } from '../../shared/ui/toast.service';
import { TravelersFormComponent } from '../../shared/travelers/travelers-form.component';

/** Conflictos que recepción puede saltarse conscientemente (repetir con `force`). */
const FORCEABLE = new Set(['reservation.room_not_ready', 'reservation.travelers_incomplete', 'reservation.balance_due']);

type Tab = 'summary' | 'travelers' | 'payments' | 'invoices' | 'ses' | 'access';

@Component({
  selector: 'app-reservation-detail-page',
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink, ConfirmDialogComponent, TravelersFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (reservation.error()) {
      <div class="alert alert--danger">{{ loadError() }}</div>
    } @else if (r(); as r) {
      <header class="row row--between head">
        <div>
          <p class="muted small">{{ channel[r.channel] }}@if (r.channelReference) { · ref. {{ r.channelReference }}} · creada el {{ r.createdAt | date: 'd MMM y, HH:mm' }}</p>
          <h1><span class="mono">{{ r.code }}</span> · {{ r.holder.fullName }}
            <span class="badge badge--{{ tone(r.status) }}">{{ statusLabel[r.status] }}</span></h1>
        </div>
        <div class="row">
          @if (r.status === 'CONFIRMED') {
            <button type="button" class="btn btn--success" [disabled]="action.busy()" (click)="checkIn(false)">Check-in</button>
            @if (r.checkIn <= today) {
              <button type="button" class="btn btn--secondary" [disabled]="action.busy()" (click)="noShowDialog.open()">No presentado</button>
            }
          }
          @if (r.status === 'CHECKED_IN') {
            <button type="button" class="btn btn--success" [disabled]="action.busy()" (click)="checkOut(false)">Check-out</button>
          }
          @if (r.status === 'CONFIRMED' || r.status === 'PENDING_PAYMENT') {
            <button type="button" class="btn btn--danger" [disabled]="action.busy()" (click)="cancelDialog.open()">Cancelar</button>
          }
        </div>
      </header>

      @if (r.channelSyncNote) { <div class="alert alert--warning">⚠ {{ r.channelSyncNote }}</div> }
      @if (r.status === 'PENDING_PAYMENT' && r.holdExpiresAt) {
        <div class="alert alert--info">Reserva web esperando el pago hasta las {{ r.holdExpiresAt | date: 'HH:mm' }}.</div>
      }
      @if (r.status === 'CANCELLED') {
        <div class="alert alert--danger">Cancelada el {{ r.cancelledAt | date: 'd MMM y, HH:mm' }}: {{ r.cancellationReason }}</div>
      }

      <nav class="tabs">
        <button type="button" [class.is-active]="tab() === 'summary'" (click)="tab.set('summary')">Resumen</button>
        <button type="button" [class.is-active]="tab() === 'travelers'" (click)="tab.set('travelers')">Viajeros</button>
        <button type="button" [class.is-active]="tab() === 'payments'" (click)="tab.set('payments')">Cobros</button>
        <button type="button" [class.is-active]="tab() === 'invoices'" (click)="tab.set('invoices')">Facturas ({{ r.invoices.length }})</button>
        <button type="button" [class.is-active]="tab() === 'ses'" (click)="tab.set('ses')">SES.HOSPEDAJES</button>
        <button type="button" [class.is-active]="tab() === 'access'" (click)="tab.set('access')">Aperturas</button>
      </nav>

      @switch (tab()) {
        @case ('summary') {
          <div class="cols">
            <section class="card">
              <div class="card__title"><h3>Estancia</h3>
                @if (r.status === 'CONFIRMED' || r.status === 'CHECKED_IN') {
                  <button type="button" class="btn btn--ghost btn--sm" (click)="startStayEdit(r)">Cambiar</button>
                }
              </div>
              @if (editingStay()) {
                <form class="stack" (ngSubmit)="saveStay(r)">
                  <div class="grid-2">
                    <div class="field"><label for="st-in">Llegada</label>
                      <input id="st-in" type="date" name="in" [(ngModel)]="stay.checkIn" [disabled]="r.status === 'CHECKED_IN'"></div>
                    <div class="field"><label for="st-out">Salida</label><input id="st-out" type="date" name="out" [(ngModel)]="stay.checkOut"></div>
                    <div class="field"><label for="st-ad">Adultos</label><input id="st-ad" type="number" min="1" name="ad" [(ngModel)]="stay.adults"></div>
                    <div class="field"><label for="st-ch">Niños</label><input id="st-ch" type="number" min="0" name="ch" [(ngModel)]="stay.children"></div>
                    <div class="field"><label for="st-tot">Precio pactado (€)</label>
                      <input id="st-tot" type="number" min="0" step="0.01" name="tot" [(ngModel)]="stay.total" placeholder="Recalcular con la tarifa"></div>
                  </div>
                  <label class="check"><input type="checkbox" name="ovr" [(ngModel)]="stay.override"> Ignorar restricciones de la tarifa</label>
                  <div class="row row--end">
                    <button type="button" class="btn btn--secondary btn--sm" (click)="editingStay.set(false)">Descartar</button>
                    <button type="submit" class="btn btn--sm" [disabled]="action.busy()">Guardar</button>
                  </div>
                </form>
              } @else {
                <dl class="kv">
                  <dt>Llegada</dt><dd>{{ r.checkIn | date: 'EEE d MMM y' }}@if (r.expectedArrivalTime) { · {{ r.expectedArrivalTime.slice(0, 5) }} }</dd>
                  <dt>Salida</dt><dd>{{ r.checkOut | date: 'EEE d MMM y' }}</dd>
                  <dt>Noches</dt><dd>{{ r.nights }}</dd>
                  <dt>Huéspedes</dt><dd>{{ r.adults }} adultos@if (r.children) {, {{ r.children }} niños}</dd>
                  <dt>Tipología</dt><dd>{{ r.roomType.name }}</dd>
                  <dt>Tarifa</dt><dd>{{ r.ratePlan?.name ?? 'Precio pactado' }}</dd>
                  @if (r.checkedInAt) { <dt>Entrada</dt><dd>{{ r.checkedInAt | date: 'd MMM, HH:mm' }}</dd> }
                  @if (r.checkedOutAt) { <dt>Salida real</dt><dd>{{ r.checkedOutAt | date: 'd MMM, HH:mm' }}</dd> }
                </dl>
              }
            </section>

            <section class="card">
              <h3>Unidad</h3>
              <p>@if (r.room) { <strong>{{ r.room.name }}</strong> } @else { <span class="badge badge--warning">Sin asignar</span> }</p>
              @if (r.status === 'CONFIRMED' || r.status === 'CHECKED_IN' || r.status === 'PENDING_PAYMENT') {
                <div class="row">
                  <select [(ngModel)]="roomChoice" aria-label="Nueva unidad" class="grow">
                    <option value="">Elegir unidad…</option>
                    @for (room of rooms.data() ?? []; track room.id) {
                      <option [value]="room.id" [disabled]="room.status !== 'ACTIVE' || room.id === r.room?.id">
                        {{ room.number }} · {{ room.roomTypeName }}
                      </option>
                    }
                  </select>
                  <button type="button" class="btn btn--secondary btn--sm" [disabled]="!roomChoice || action.busy()" (click)="assignRoom(r)">Asignar</button>
                </div>
                <p class="small muted">El sistema comprueba solapes y bloqueos. Durante la estancia, la unidad anterior queda pendiente de limpieza.</p>
              }
            </section>

            <section class="card">
              <div class="card__title"><h3>Titular</h3><a [routerLink]="['/backoffice/huespedes', r.holder.id]" class="small">Ficha</a></div>
              <dl class="kv">
                <dt>Nombre</dt><dd>{{ r.holder.fullName }}</dd>
                @if (r.holder.email) { <dt>Email</dt><dd><a [href]="'mailto:' + r.holder.email">{{ r.holder.email }}</a></dd> }
                @if (r.holder.phone) { <dt>Teléfono</dt><dd><a [href]="'tel:' + r.holder.phone">{{ r.holder.phone }}</a></dd> }
                @if (r.holder.documentNumber) { <dt>Documento</dt><dd>{{ r.holder.documentNumber }}</dd> }
              </dl>
            </section>

            <section class="card">
              <h3>Importes</h3>
              <dl class="kv">
                <dt>Total</dt><dd>{{ r.totalAmount | currency: r.currency }}</dd>
                <dt>Cobrado</dt><dd>{{ r.paidAmount | currency: r.currency }}</dd>
                <dt>Pendiente</dt><dd><strong [class.due]="r.balanceDue > 0">{{ r.balanceDue | currency: r.currency }}</strong></dd>
                <dt>Forma de pago</dt><dd>{{ paymentMode[r.paymentMode] }}</dd>
                @if (r.commissionAmount > 0) { <dt>Comisión OTA</dt><dd>{{ r.commissionAmount | currency: r.currency }}</dd> }
              </dl>
              <details class="nights">
                <summary class="small">Desglose por noches</summary>
                <dl class="kv small">
                  @for (n of r.nightCharges; track n.date) { <dt>{{ n.date | date: 'EEE d MMM' }}</dt><dd>{{ n.price | currency: r.currency }}</dd> }
                </dl>
              </details>
            </section>

            <section class="card wide">
              <h3>Notas</h3>
              <form class="stack" (ngSubmit)="saveNotes(r)">
                <div class="grid-2">
                  <div class="field"><label for="nt-sr">Peticiones del huésped</label><textarea id="nt-sr" name="sr" [(ngModel)]="notes.specialRequests" maxlength="2000"></textarea></div>
                  <div class="field"><label for="nt-in">Notas internas</label><textarea id="nt-in" name="in" [(ngModel)]="notes.internalNotes" maxlength="4000"></textarea></div>
                  <div class="field"><label for="nt-eta">Hora prevista de llegada</label><input id="nt-eta" type="time" name="eta" [(ngModel)]="notes.expectedArrivalTime"></div>
                  <div class="field"><label for="nt-ref">Referencia del canal</label><input id="nt-ref" name="ref" [(ngModel)]="notes.channelReference" maxlength="100"></div>
                </div>
                <div class="row row--end"><button type="submit" class="btn btn--secondary btn--sm" [disabled]="action.busy()">Guardar notas</button></div>
              </form>
            </section>
          </div>
        }

        @case ('travelers') {
          <app-travelers-form [reservationId]="r.id" (saved)="reservation.reload()" />
        }

        @case ('payments') {
          <section class="card">
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Fecha</th><th>Medio</th><th>Estado</th><th>Referencia</th><th class="num">Importe</th><th class="num">Reembolsado</th><th></th></tr></thead>
                <tbody>
                  @for (p of r.payments; track p.id) {
                    <tr>
                      <td>{{ p.paidAt ? (p.paidAt | date: 'd MMM y, HH:mm') : '—' }}</td>
                      <td>{{ providerLabel[p.provider] }}@if (p.cardLast4) { · ****{{ p.cardLast4 }} }</td>
                      <td>{{ paymentStatus[p.status] }}@if (p.failureMessage) { <br><span class="small field__error">{{ p.failureMessage }}</span> }</td>
                      <td class="small">{{ p.reference ?? '' }}</td>
                      <td class="num">{{ p.amount | currency: r.currency }}</td>
                      <td class="num">{{ p.refundedAmount > 0 ? (p.refundedAmount | currency: r.currency) : '—' }}</td>
                      <td class="right">
                        @if (isAdmin() && refundable(p)) {
                          <button type="button" class="btn btn--ghost btn--sm" (click)="startRefund(p)">Reembolsar</button>
                        }
                      </td>
                    </tr>
                  } @empty { <tr><td colspan="7" class="empty">Sin cobros registrados.</td></tr> }
                </tbody>
              </table>
            </div>
          </section>
          @if (refunding(); as p) {
            <form class="card stack" (ngSubmit)="refund(p)">
              <h3>Reembolso del cobro de {{ p.amount | currency: r.currency }}</h3>
              <div class="grid-2">
                <div class="field"><label for="rf-a">Importe (€)</label>
                  <input id="rf-a" type="number" step="0.01" min="0.01" [max]="p.amount - p.refundedAmount" name="a" [(ngModel)]="refundAmount" required></div>
                <div class="field"><label for="rf-r">Motivo</label><input id="rf-r" name="r" [(ngModel)]="refundReason" maxlength="500" required></div>
              </div>
              <p class="small muted">Los cobros con tarjeta online se devuelven automáticamente por Stripe; el resto se registra como devuelto.</p>
              <div class="row row--end">
                <button type="button" class="btn btn--secondary btn--sm" (click)="refunding.set(null)">Descartar</button>
                <button type="submit" class="btn btn--danger btn--sm" [disabled]="action.busy() || !refundAmount || !refundReason.trim()">Reembolsar</button>
              </div>
            </form>
          }
          @if (r.status !== 'CANCELLED' && r.balanceDue > 0) {
            <form class="card stack" (ngSubmit)="registerPayment(r)">
              <h3>Registrar cobro en el alojamiento</h3>
              <div class="grid-3">
                <div class="field"><label for="py-p">Medio</label>
                  <select id="py-p" name="p" [(ngModel)]="payProvider">
                    @for (p of propertyProviders; track p) { <option [value]="p">{{ providerLabel[p] }}</option> }
                  </select></div>
                <div class="field"><label for="py-a">Importe (€)</label>
                  <input id="py-a" type="number" step="0.01" min="0.01" name="a" [(ngModel)]="payAmount" required></div>
                <div class="field"><label for="py-r">Referencia</label><input id="py-r" name="r" [(ngModel)]="payReference" maxlength="100"></div>
              </div>
              <div class="row row--end"><button type="submit" class="btn btn--sm" [disabled]="action.busy() || !payAmount">Registrar cobro</button></div>
            </form>
          }
        }

        @case ('invoices') {
          <section class="card">
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Número</th><th>Tipo</th><th>Fecha</th><th>Estado</th><th class="num">Total</th></tr></thead>
                <tbody>
                  @for (i of r.invoices; track i.id) {
                    <tr class="is-link" [routerLink]="['/backoffice/facturas', i.id]">
                      <td class="mono">{{ i.fullNumber }}</td><td>{{ invoiceTypeLabel(i.invoiceType) }}</td>
                      <td>{{ i.issueDate | date: 'd MMM y' }}</td><td>{{ i.status === 'RECTIFIED' ? 'Rectificada' : 'Emitida' }}</td>
                      <td class="num">{{ i.totalAmount | currency: r.currency }}</td>
                    </tr>
                  } @empty { <tr><td colspan="5" class="empty">Sin facturas.</td></tr> }
                </tbody>
              </table>
            </div>
          </section>
          @if (r.status !== 'CANCELLED' && r.status !== 'PENDING_PAYMENT') {
            <form class="card stack" (ngSubmit)="issueInvoice(r)">
              <h3>Emitir factura</h3>
              <div class="row">
                <label class="check"><input type="radio" name="t" value="F2" [(ngModel)]="invoiceType"> Simplificada (ticket)</label>
                <label class="check"><input type="radio" name="t" value="F1" [(ngModel)]="invoiceType"> Completa (con NIF del cliente)</label>
              </div>
              @if (invoiceType === 'F1') {
                <div class="grid-2">
                  <div class="field"><label for="iv-n">Razón social / nombre *</label><input id="iv-n" name="n" [(ngModel)]="invoice.name" maxlength="200" required></div>
                  <div class="field"><label for="iv-t">NIF / VAT *</label><input id="iv-t" name="t2" [(ngModel)]="invoice.taxId" maxlength="30" required></div>
                  <div class="field"><label for="iv-a">Dirección *</label><input id="iv-a" name="a" [(ngModel)]="invoice.address" maxlength="300" required></div>
                  <div class="field"><label for="iv-c">País (ISO alfa-3)</label><input id="iv-c" name="c" [(ngModel)]="invoice.country" maxlength="3"></div>
                </div>
              }
              <div class="field"><label for="iv-no">Observaciones</label><input id="iv-no" name="no" [(ngModel)]="invoice.notes" maxlength="500"></div>
              <div class="row row--end"><button type="submit" class="btn btn--sm" [disabled]="action.busy()">Emitir</button></div>
            </form>
          }
        }

        @case ('ses') {
          <section class="card table-wrap">
            <table class="table">
              <thead><tr><th>Tipo</th><th>Operación</th><th>Estado</th><th>Plazo</th><th>Código</th><th>Error</th></tr></thead>
              <tbody>
                @for (s of ses.data() ?? []; track s.id) {
                  <tr class="is-link" [routerLink]="['/backoffice/ses']" [queryParams]="{ informe: s.id }">
                    <td>{{ sesType[s.type] }}</td><td>{{ sesOperation[s.operation] }}</td>
                    <td><span class="badge badge--{{ sesToneFn(s.status) }}">{{ sesStatus[s.status] }}</span>@if (s.overdue) { <span class="badge badge--danger">Fuera de plazo</span> }</td>
                    <td>{{ s.deadlineAt ? (s.deadlineAt | date: 'd MMM, HH:mm') : '—' }}</td>
                    <td class="mono">{{ s.communicationCode ?? '—' }}</td>
                    <td class="small">{{ s.errorMessage ?? '' }}</td>
                  </tr>
                } @empty { <tr><td colspan="6" class="empty">Sin comunicaciones.</td></tr> }
              </tbody>
            </table>
          </section>
        }

        @case ('access') {
          <section class="card table-wrap">
            <table class="table">
              <thead><tr><th>Fecha</th><th>Quién</th><th>Acción</th><th>Resultado</th><th>Detalle</th><th>IP</th></tr></thead>
              <tbody>
                @for (a of accessLog.data()?.content ?? []; track a.id) {
                  <tr>
                    <td class="nowrap">{{ a.occurredAt | date: 'd MMM, HH:mm:ss' }}</td>
                    <td>{{ a.actorType === 'GUEST' ? 'Huésped' : a.actorType === 'STAFF' ? 'Personal' : 'Sistema' }}</td>
                    <td>{{ a.action === 'REMOTE_UNLOCK' ? 'Apertura' : a.action }}</td>
                    <td><span class="badge" [class.badge--success]="a.result === 'SUCCESS'" [class.badge--danger]="a.result !== 'SUCCESS'">{{ a.result }}</span></td>
                    <td class="small">{{ a.denialReason ?? a.providerMessage ?? '' }}</td>
                    <td class="small mono">{{ a.clientIp ?? '' }}</td>
                  </tr>
                } @empty { <tr><td colspan="6" class="empty">Sin aperturas registradas.</td></tr> }
              </tbody>
            </table>
          </section>
        }
      }

      <app-confirm-dialog #cancelDialog title="Cancelar reserva" confirmLabel="Cancelar reserva" [danger]="true"
                          message="Se liberará el inventario y se revocará el acceso del huésped. Los cobros no se devuelven automáticamente."
                          reasonLabel="Motivo de la cancelación" (confirmed)="cancel(r, $event)" />
      <app-confirm-dialog #noShowDialog title="Marcar como no presentado" confirmLabel="Marcar no-show" [danger]="true"
                          message="El huésped no se ha presentado: se liberan las noches restantes." (confirmed)="noShow(r)" />
      <app-confirm-dialog #forceDialog title="¿Continuar de todos modos?" [message]="forceMessage()" confirmLabel="Continuar"
                          (confirmed)="forceAction()" />
    } @else {
      <div class="loading"><span class="spinner"></span></div>
    }
  `,
  styles: `
    .head { margin-bottom: 12px; align-items: flex-start; }
    .head h1 { margin: 0; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .head p { margin: 0; }
    .cols { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); align-items: start; }
    .cols .card + .card { margin-top: 0; }
    .wide { grid-column: 1 / -1; }
    .due { color: var(--c-danger); }
    .nights { margin-top: 12px; }
    .alert { margin-bottom: 12px; }
  `,
})
export class ReservationDetailPage {
  private readonly api = inject(BackofficeApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly session = inject(StaffSessionService);
  protected readonly action = useAction();

  private readonly forceDialog = viewChild.required<ConfirmDialogComponent>('forceDialog');

  protected readonly statusLabel = RESERVATION_STATUS;
  protected readonly channel = CHANNEL;
  protected readonly paymentMode = PAYMENT_MODE;
  protected readonly providerLabel = PAYMENT_PROVIDER;
  protected readonly paymentStatus = PAYMENT_STATUS;
  protected readonly sesType = SES_TYPE;
  protected readonly sesOperation = SES_OPERATION;
  protected readonly sesStatus = SES_STATUS;
  protected readonly tone = reservationTone;
  protected readonly sesToneFn = sesTone;
  protected readonly propertyProviders: PaymentProvider[] = ['CARD_TERMINAL', 'CASH', 'BANK_TRANSFER', 'OTA'];
  protected readonly today = todayInProperty();

  readonly id = input.required<string>();
  protected readonly tab = signal<Tab>('summary');

  protected readonly reservation = apiResource({ params: () => this.id(), stream: ({ params }) => this.api.reservation(params) });
  /** Último detalle conocido: las acciones devuelven el detalle actualizado sin recargar. */
  protected readonly r = signal<ReservationDetail | null>(null);
  protected readonly loadError = computed(() => problemMessage(this.reservation.error()));
  protected readonly rooms = apiResource({ stream: () => this.api.rooms() });
  protected readonly ses = apiResource({
    params: () => (this.tab() === 'ses' ? this.id() : undefined),
    stream: ({ params }) => this.api.reservationSesReports(params),
  });
  protected readonly accessLog = apiResource({
    params: () => (this.tab() === 'access' ? this.id() : undefined),
    stream: ({ params }) => this.api.reservationAccessLog(params),
  });
  protected readonly isAdmin = computed(() => {
    this.session.user();
    return this.session.hasRole('ADMIN');
  });

  // Estado de los formularios.
  protected readonly editingStay = signal(false);
  protected stay = { checkIn: '', checkOut: '', adults: 1, children: 0, total: null as number | null, override: false };
  protected notes = { specialRequests: '', internalNotes: '', expectedArrivalTime: '', channelReference: '' };
  protected roomChoice = '';
  protected payProvider: PaymentProvider = 'CARD_TERMINAL';
  protected payAmount: number | null = null;
  protected payReference = '';
  protected readonly refunding = signal<PaymentLine | null>(null);
  protected refundAmount: number | null = null;
  protected refundReason = '';
  protected invoiceType: 'F1' | 'F2' = 'F2';
  protected invoice = { name: '', taxId: '', address: '', country: 'ESP', notes: '' };

  protected readonly forceMessage = signal('');
  private forced: (() => Promise<void>) | null = null;

  constructor() {
    effect(() => {
      const value = this.reservation.data();
      if (value) this.apply(value);
    });
  }

  private apply(r: ReservationDetail): void {
    this.r.set(r);
    this.notes = {
      specialRequests: r.specialRequests ?? '',
      internalNotes: r.internalNotes ?? '',
      expectedArrivalTime: r.expectedArrivalTime?.slice(0, 5) ?? '',
      channelReference: r.channelReference ?? '',
    };
    this.payAmount = r.balanceDue > 0 ? r.balanceDue : null;
    this.roomChoice = '';
    if (!this.invoice.name) {
      this.invoice.name = r.holder.fullName;
    }
  }

  protected invoiceTypeLabel(type: string): string {
    return (INVOICE_TYPE as Record<string, string>)[type] ?? type;
  }

  protected refundable(p: PaymentLine): boolean {
    return (p.status === 'SUCCEEDED' || p.status === 'PARTIALLY_REFUNDED') && p.amount > p.refundedAmount;
  }

  // ------------------------------------------------------------------ acciones

  protected async checkIn(force: boolean): Promise<void> {
    await this.frontDesk(() => this.api.checkIn(this.id(), force), 'Check-in registrado', () => this.checkIn(true));
  }

  protected async checkOut(force: boolean): Promise<void> {
    await this.frontDesk(() => this.api.checkOut(this.id(), force), 'Check-out registrado', () => this.checkOut(true));
  }

  /** Si el backend avisa de un conflicto que puede saltarse, se pide confirmación y se repite con `force`. */
  private async frontDesk(op: () => ReturnType<BackofficeApiService['checkIn']>, success: string,
                          retry: () => Promise<void>): Promise<void> {
    try {
      this.apply(await firstValueFrom(op()));
      this.toast.success(success);
    } catch (error) {
      const problem = toProblem(error);
      if (problem.status === 409 && FORCEABLE.has(problem.code)) {
        this.forceMessage.set(problem.detail);
        this.forced = retry;
        this.forceDialog().open();
      } else {
        this.toast.error(error);
      }
    }
  }

  protected async forceAction(): Promise<void> {
    const retry = this.forced;
    this.forced = null;
    if (retry) await retry();
  }

  protected async cancel(r: ReservationDetail, reason: string): Promise<void> {
    const result = await this.action.run(() => this.api.cancel(r.id, reason), 'Reserva cancelada');
    if (result) this.apply(result);
  }

  protected async noShow(r: ReservationDetail): Promise<void> {
    const result = await this.action.run(() => this.api.noShow(r.id), 'Marcada como no presentado');
    if (result) this.apply(result);
  }

  protected startStayEdit(r: ReservationDetail): void {
    this.stay = { checkIn: r.checkIn, checkOut: r.checkOut, adults: r.adults, children: r.children, total: null, override: false };
    this.editingStay.set(true);
  }

  protected async saveStay(r: ReservationDetail): Promise<void> {
    const total = this.stay.total === null || (this.stay.total as unknown) === '' ? null : Number(this.stay.total);
    const result = await this.action.run(() => this.api.changeStay(r.id, {
      checkIn: r.status === 'CHECKED_IN' ? r.checkIn : this.stay.checkIn,
      checkOut: this.stay.checkOut,
      adults: Number(this.stay.adults),
      children: Number(this.stay.children),
      totalAmountOverride: total,
      overrideRestrictions: this.stay.override,
      version: r.version,
    }), 'Estancia modificada');
    if (result) {
      this.apply(result);
      this.editingStay.set(false);
    }
  }

  protected async assignRoom(r: ReservationDetail): Promise<void> {
    const result = await this.action.run(() => this.api.assignRoom(r.id, this.roomChoice), 'Unidad asignada');
    if (result) this.apply(result);
  }

  protected async saveNotes(r: ReservationDetail): Promise<void> {
    const result = await this.action.run(() => this.api.updateNotes(r.id, {
      specialRequests: this.notes.specialRequests.trim() || null,
      internalNotes: this.notes.internalNotes.trim() || null,
      expectedArrivalTime: this.notes.expectedArrivalTime || null,
      channelReference: this.notes.channelReference.trim() || null,
      version: r.version,
    }), 'Notas guardadas');
    if (result) this.apply(result);
  }

  protected async registerPayment(r: ReservationDetail): Promise<void> {
    const amount = Number(this.payAmount);
    if (!(amount > 0)) return;
    const result = await this.action.run(() => this.api.registerPayment(r.id, {
      provider: this.payProvider,
      amount,
      reference: this.payReference.trim() || null,
    }), 'Cobro registrado');
    if (result) {
      this.payReference = '';
      this.apply(result);
    }
  }

  protected startRefund(p: PaymentLine): void {
    this.refundAmount = Math.round((p.amount - p.refundedAmount) * 100) / 100;
    this.refundReason = '';
    this.refunding.set(p);
  }

  protected async refund(p: PaymentLine): Promise<void> {
    const result = await this.action.run(
      () => this.api.refund(p.id, { amount: Number(this.refundAmount), reason: this.refundReason.trim() }),
      'Reembolso registrado',
    );
    if (result) {
      this.refunding.set(null);
      this.apply(result);
    }
  }

  protected async issueInvoice(r: ReservationDetail): Promise<void> {
    const complete = this.invoiceType === 'F1';
    const result = await this.action.run(() => this.api.issueInvoice(r.id, {
      type: this.invoiceType,
      customerName: complete ? this.invoice.name.trim() : null,
      customerTaxId: complete ? this.invoice.taxId.trim().toUpperCase() : null,
      customerAddress: complete ? this.invoice.address.trim() : null,
      customerCountryCode: complete ? this.invoice.country.trim().toUpperCase() || null : null,
      notes: this.invoice.notes.trim() || null,
    }), (inv) => `Factura ${inv.fullNumber} emitida`);
    if (result) {
      await this.router.navigate(['/backoffice/facturas', result.id]);
    }
  }
}
