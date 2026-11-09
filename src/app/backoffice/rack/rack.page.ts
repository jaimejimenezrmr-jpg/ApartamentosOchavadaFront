import { apiResource } from '../../shared/ui/api-resource';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BackofficeApiService } from '../../core/api/backoffice-api.service';
import { BlockType, IsoDate, RackBlock, RackBooking, RackRoom, Uuid } from '../../core/api/models';
import { problemMessage } from '../../core/api/problem';
import { addDays, eachDay, isWeekend, todayInProperty } from '../../core/util/dates';
import { BLOCK_TYPE, CHANNEL, HOUSEKEEPING_STATUS, RESERVATION_STATUS, housekeepingTone } from '../../shared/labels';
import { useAction } from '../../shared/ui/action';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog.component';
import { barPosition } from './rack-layout';

const MOVABLE = new Set(['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN']);

/**
 * Rack de disponibilidad (diagrama de Gantt): una fila por unidad y una columna por noche. Las reservas se
 * arrastran a otra fila para cambiar de unidad (o desde la bandeja de «sin asignar»); el backend comprueba
 * solapes y bloqueos. Los bloqueos se crean y eliminan desde aquí.
 */
@Component({
  selector: 'app-rack-page',
  imports: [DatePipe, FormsModule, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row row--between toolbar">
      <h1>Rack</h1>
      <div class="row">
        <button type="button" class="btn btn--secondary btn--sm" (click)="move(-7)">‹ Semana</button>
        <button type="button" class="btn btn--secondary btn--sm" (click)="goToday()">Hoy</button>
        <button type="button" class="btn btn--secondary btn--sm" (click)="move(7)">Semana ›</button>
        <input type="date" [ngModel]="from()" (ngModelChange)="$event && from.set($event)" aria-label="Desde">
        <select [ngModel]="span()" (ngModelChange)="span.set(+$event)" aria-label="Días visibles">
          <option [ngValue]="14">14 días</option><option [ngValue]="21">21 días</option><option [ngValue]="31">31 días</option>
        </select>
        <button type="button" class="btn btn--sm" (click)="blockOpen.set(!blockOpen())">Bloquear unidad</button>
      </div>
    </div>

    @if (blockOpen()) {
      <form class="card row block-form" (ngSubmit)="createBlock()">
        <div class="field"><label for="bl-room">Unidad</label>
          <select id="bl-room" name="room" [(ngModel)]="blockRoom" required>
            <option value="">—</option>
            @for (rt of rack.data()?.roomTypes ?? []; track rt.id) {
              <optgroup [label]="rt.name">
                @for (r of rt.rooms; track r.id) { <option [value]="r.id">{{ r.number }}</option> }
              </optgroup>
            }
          </select></div>
        <div class="field"><label for="bl-from">Primera noche</label><input id="bl-from" type="date" name="from" [(ngModel)]="blockFrom" required></div>
        <div class="field"><label for="bl-to">Hasta (exclusive)</label><input id="bl-to" type="date" name="to" [(ngModel)]="blockTo" required></div>
        <div class="field"><label for="bl-type">Motivo</label>
          <select id="bl-type" name="type" [(ngModel)]="blockType">
            @for (t of blockTypes; track t) { <option [value]="t">{{ blockLabel[t] }}</option> }
          </select></div>
        <div class="field grow"><label for="bl-reason">Detalle</label><input id="bl-reason" name="reason" [(ngModel)]="blockReason" maxlength="500"></div>
        <button type="submit" class="btn" [disabled]="action.busy() || !blockRoom || !blockFrom || !blockTo">Crear bloqueo</button>
      </form>
    }

    @if (rack.error()) {
      <div class="alert alert--danger">{{ error() }}</div>
    } @else if (rack.data(); as data) {
      @if (data.unassigned.length) {
        <section class="card unassigned" (dragover)="$event.preventDefault()">
          <h3>Sin unidad asignada ({{ data.unassigned.length }}) <span class="small muted">— arrástrelas a una unidad</span></h3>
          <div class="row">
            @for (b of data.unassigned; track b.reservationId) {
              <button type="button" class="chip" draggable="true" (dragstart)="dragStart($event, b)" (click)="open(b)"
                      [title]="tooltip(b)">
                {{ b.guestName }} · {{ b.checkIn | date: 'd/M' }}–{{ b.checkOut | date: 'd/M' }} · {{ channel[b.channel] }}
              </button>
            }
          </div>
        </section>
      }
      <div class="rack" [style.--days]="days().length" [class.is-loading]="rack.isLoading()">
        <div class="rack__corner"></div>
        @for (d of days(); track d) {
          <div class="rack__day" [class.is-weekend]="weekend(d)" [class.is-today]="d === today">
            <span>{{ d | date: 'EEEEE' }}</span><strong>{{ d | date: 'd' }}</strong>
          </div>
        }
        @for (rt of data.roomTypes; track rt.id) {
          <div class="rack__type">{{ rt.name }}</div>
          @for (room of rt.rooms; track room.id) {
            <div class="rack__room" [class.is-off]="room.status !== 'ACTIVE'">
              <span class="dot dot--{{ hkTone(room.housekeepingStatus) }}" [title]="hkLabel[room.housekeepingStatus]"></span>
              <strong>{{ room.number }}</strong>
              @if (room.status !== 'ACTIVE') { <span class="small muted">({{ room.status === 'OUT_OF_ORDER' ? 'fuera de servicio' : 'inactiva' }})</span> }
            </div>
            <div class="rack__lane" [class.is-drop]="dropTarget() === room.id"
                 (dragover)="dragOver($event, room)" (dragleave)="dropTarget.set(null)" (drop)="drop($event, room)">
              @for (d of days(); track d) { <div class="rack__cell" [class.is-weekend]="weekend(d)" [class.is-today]="d === today"></div> }
              @for (block of room.blocks; track block.id) {
                @if (blockPos(block); as p) {
                  <button type="button" class="bar bar--block" [style.grid-column]="p.column + ' / span ' + p.span"
                          [title]="blockLabel[block.blockType] + (block.reason ? ': ' + block.reason : '')" (click)="askDeleteBlock(block)">
                    {{ blockLabel[block.blockType] }}
                  </button>
                }
              }
              @for (b of room.bookings; track b.reservationId) {
                @if (bookingPos(b); as p) {
                  <button type="button" class="bar bar--{{ b.status }}" [class.clip-start]="p.clippedStart" [class.clip-end]="p.clippedEnd"
                          [style.grid-column]="p.column + ' / span ' + p.span" [title]="tooltip(b)"
                          [draggable]="movable(b)" (dragstart)="dragStart($event, b)" (click)="open(b)">
                    @if (b.balanceDue > 0) { <span aria-label="Saldo pendiente">€</span> } {{ b.guestName }}
                  </button>
                }
              }
            </div>
          }
        }
      </div>
      <p class="legend small">
        <span class="bar bar--CONFIRMED">Confirmada</span>
        <span class="bar bar--CHECKED_IN">En casa</span>
        <span class="bar bar--PENDING_PAYMENT">Pendiente de pago</span>
        <span class="bar bar--CHECKED_OUT">Salida</span>
        <span class="bar bar--block">Bloqueo</span>
        · € = saldo pendiente
      </p>
    } @else {
      <div class="loading"><span class="spinner"></span></div>
    }

    <app-confirm-dialog #deleteBlockDialog title="Eliminar bloqueo" confirmLabel="Eliminar" [danger]="true"
                        message="La unidad volverá a estar a la venta en esas fechas." (confirmed)="deleteBlock()" />
  `,
  styles: `
    .toolbar { margin-bottom: 12px; }
    .toolbar h1 { margin: 0; }
    .toolbar input, .toolbar select { width: auto; min-height: 32px; }
    .block-form { align-items: flex-end; margin-bottom: 12px; }
    .block-form .field { min-width: 140px; }
    .unassigned { margin-bottom: 12px; padding: 12px 16px; }
    .unassigned h3 { margin-bottom: 8px; }
    .chip { border: 1px dashed var(--c-warning); background: var(--c-warning-soft); color: var(--c-text); border-radius: 999px;
      padding: 4px 12px; cursor: grab; font: inherit; font-size: 0.84rem; }
    .rack { display: grid; grid-template-columns: 150px repeat(var(--days), minmax(38px, 1fr)); background: var(--c-surface);
      border: 1px solid var(--c-border); border-radius: var(--radius); overflow-x: auto; font-size: 0.82rem; }
    .rack.is-loading { opacity: 0.6; }
    .rack__corner, .rack__room, .rack__type { position: sticky; left: 0; background: var(--c-surface); z-index: 2; }
    .rack__day { text-align: center; padding: 6px 0; border-bottom: 1px solid var(--c-border); display: flex; flex-direction: column; line-height: 1.1; }
    .rack__day span { color: var(--c-text-muted); text-transform: uppercase; font-size: 0.7rem; }
    .rack__day.is-weekend, .rack__cell.is-weekend { background: var(--c-surface-alt); }
    .rack__day.is-today { color: var(--c-brand); }
    .rack__type { grid-column: 1 / -1; padding: 8px 10px; font-weight: 600; background: var(--c-brand-soft); color: var(--c-brand-strong); }
    .rack__room { padding: 6px 10px; border-bottom: 1px solid var(--c-border); display: flex; gap: 6px; align-items: center; }
    .rack__room.is-off { opacity: 0.6; }
    .rack__lane { grid-column: 2 / -1; display: grid; grid-template-columns: repeat(var(--days), minmax(38px, 1fr));
      grid-template-rows: 34px; border-bottom: 1px solid var(--c-border); position: relative; }
    .rack__lane.is-drop { outline: 2px dashed var(--c-accent); outline-offset: -2px; }
    .rack__cell { grid-row: 1; border-left: 1px solid #efe7de; }
    .rack__cell.is-today { background: rgba(197, 139, 58, 0.12); }
    .bar { grid-row: 1; margin: 4px 1px; border: 0; border-radius: 6px; padding: 0 6px; font: 600 0.78rem var(--font-text);
      color: #fff; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; z-index: 1; }
    .bar[draggable='true'] { cursor: grab; }
    .bar--CONFIRMED { background: var(--c-info); }
    .bar--CHECKED_IN { background: var(--c-success); }
    .bar--PENDING_PAYMENT { background: var(--c-warning); }
    .bar--CHECKED_OUT, .bar--NO_SHOW { background: #9a8f86; }
    .bar--block { background: repeating-linear-gradient(45deg, #6d6058, #6d6058 6px, #857970 6px, #857970 12px); }
    .clip-start { border-top-left-radius: 0; border-bottom-left-radius: 0; }
    .clip-end { border-top-right-radius: 0; border-bottom-right-radius: 0; }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: #bbb; flex: 0 0 auto; }
    .dot--success { background: var(--c-success); }
    .dot--danger { background: var(--c-danger); }
    .dot--warning { background: var(--c-warning); }
    .dot--info { background: var(--c-info); }
    .legend { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; color: var(--c-text-muted); }
    .legend .bar { display: inline-block; padding: 3px 8px; margin: 0; cursor: default; }
  `,
})
export class RackPage {
  private readonly api = inject(BackofficeApiService);
  private readonly router = inject(Router);
  protected readonly action = useAction();
  private readonly deleteDialog = viewChild.required<ConfirmDialogComponent>('deleteBlockDialog');

  protected readonly channel = CHANNEL;
  protected readonly blockLabel = BLOCK_TYPE;
  protected readonly hkLabel = HOUSEKEEPING_STATUS;
  protected readonly hkTone = housekeepingTone;
  protected readonly blockTypes: BlockType[] = ['MAINTENANCE', 'OWNER_USE', 'OUT_OF_ORDER', 'OTHER'];
  protected readonly weekend = isWeekend;
  protected readonly today = todayInProperty();

  protected readonly from = signal<IsoDate>(addDays(this.today, -2));
  protected readonly span = signal(21);
  protected readonly to = computed(() => addDays(this.from(), this.span()));
  protected readonly days = computed(() => eachDay(this.from(), this.to()));

  protected readonly rack = apiResource({
    params: () => ({ from: this.from(), to: this.to() }),
    stream: ({ params }) => this.api.rack(params.from, params.to),
  });
  protected readonly error = computed(() => problemMessage(this.rack.error()));

  protected readonly dropTarget = signal<Uuid | null>(null);
  private dragged: RackBooking | null = null;
  private pendingBlock: RackBlock | null = null;

  protected readonly blockOpen = signal(false);
  protected blockRoom = '';
  protected blockFrom = this.today;
  protected blockTo = addDays(this.today, 1);
  protected blockType: BlockType = 'MAINTENANCE';
  protected blockReason = '';

  protected move(days: number): void {
    this.from.set(addDays(this.from(), days));
  }

  protected goToday(): void {
    this.from.set(addDays(this.today, -2));
  }

  protected bookingPos(b: RackBooking) {
    return barPosition(b.checkIn, b.checkOut, this.from(), this.to());
  }

  protected blockPos(b: RackBlock) {
    return barPosition(b.startDate, b.endDate, this.from(), this.to());
  }

  protected movable(b: RackBooking): boolean {
    return MOVABLE.has(b.status);
  }

  protected tooltip(b: RackBooking): string {
    const guests = `${b.adults} ad.${b.children ? ` + ${b.children} niños` : ''}`;
    return `${b.code} · ${b.guestName} · ${b.checkIn} → ${b.checkOut} · ${guests} · ${RESERVATION_STATUS[b.status]} · ${CHANNEL[b.channel]}`;
  }

  protected open(b: RackBooking): void {
    void this.router.navigate(['/backoffice/reservas', b.reservationId]);
  }

  protected dragStart(event: DragEvent, b: RackBooking): void {
    if (!this.movable(b)) {
      event.preventDefault();
      return;
    }
    this.dragged = b;
    event.dataTransfer?.setData('text/plain', b.reservationId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  protected dragOver(event: DragEvent, room: RackRoom): void {
    if (!this.dragged || room.status !== 'ACTIVE') return;
    event.preventDefault();
    this.dropTarget.set(room.id);
  }

  protected async drop(event: DragEvent, room: RackRoom): Promise<void> {
    event.preventDefault();
    this.dropTarget.set(null);
    const booking = this.dragged;
    this.dragged = null;
    if (!booking || room.bookings.some((b) => b.reservationId === booking.reservationId)) return;
    const result = await this.action.run(
      () => this.api.assignRoom(booking.reservationId, room.id),
      `${booking.guestName} → unidad ${room.number}`,
    );
    if (result) this.rack.reload();
  }

  protected async createBlock(): Promise<void> {
    const result = await this.action.run(
      () => this.api.createBlock({
        roomId: this.blockRoom,
        startDate: this.blockFrom,
        endDate: this.blockTo,
        blockType: this.blockType,
        reason: this.blockReason.trim() || null,
      }),
      'Bloqueo creado',
    );
    if (result) {
      this.blockOpen.set(false);
      this.blockReason = '';
      this.rack.reload();
    }
  }

  protected askDeleteBlock(block: RackBlock): void {
    this.pendingBlock = block;
    this.deleteDialog().open();
  }

  protected async deleteBlock(): Promise<void> {
    const block = this.pendingBlock;
    this.pendingBlock = null;
    if (!block) return;
    if (await this.action.runOk(() => this.api.deleteBlock(block.id), 'Bloqueo eliminado')) {
      this.rack.reload();
    }
  }
}
