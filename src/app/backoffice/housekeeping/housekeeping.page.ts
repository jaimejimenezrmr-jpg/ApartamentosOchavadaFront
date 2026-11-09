import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BackofficeApiService } from '../../core/api/backoffice-api.service';
import { HousekeepingStatus, RoomBoardItem, TaskResponse, TaskType } from '../../core/api/models';
import { problemMessage } from '../../core/api/problem';
import { StaffSessionService } from '../../core/auth/staff-session.service';
import { addDays, todayInProperty } from '../../core/util/dates';
import {
  HOUSEKEEPING_FLOW,
  HOUSEKEEPING_STATUS,
  HOUSEKEEPING_STATUS_SHORT,
  TASK_STATUS,
  TASK_TYPE,
  housekeepingTone,
} from '../../shared/labels';
import { useAction } from '../../shared/ui/action';
import { apiResource } from '../../shared/ui/api-resource';

type Scope = 'mine' | 'all';

/**
 * Tablero de limpieza (pensado para el móvil): mis tareas del día, limpiezas pendientes de inspección y el
 * estado de cada unidad (pendiente, en limpieza, limpio por inspeccionar, LISTO), con ocupación y movimientos.
 */
@Component({
  selector: 'app-housekeeping-page',
  imports: [DatePipe, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row row--between head">
      <h1>Limpieza</h1>
      <div class="row">
        <button type="button" class="btn btn--secondary btn--sm" (click)="date.set(shift(-1))" aria-label="Día anterior">‹</button>
        <input type="date" [ngModel]="date()" (ngModelChange)="$event && date.set($event)" aria-label="Fecha">
        <button type="button" class="btn btn--secondary btn--sm" (click)="date.set(shift(1))" aria-label="Día siguiente">›</button>
        <button type="button" class="btn btn--ghost btn--sm" (click)="refresh()">Actualizar</button>
      </div>
    </div>

    <div class="segmented" role="group" aria-label="Qué tareas ver">
      <button type="button" [class.is-active]="scope() === 'mine'" (click)="scope.set('mine')">Mis tareas</button>
      <button type="button" [class.is-active]="scope() === 'all'" (click)="scope.set('all')">Todas</button>
    </div>

    @if (tasks.error()) { <div class="alert alert--danger">{{ tasksError() }}</div> }

    <section>
      <h2>Por hacer <span class="muted">({{ todo().length }})</span></h2>
      <div class="tasks">
        @for (t of todo(); track t.id) {
          <a class="card task" [routerLink]="['tareas', t.id]" [class.task--urgent]="t.priority <= 1 || isLate(t)">
            <div class="row row--between">
              <strong class="task__room">{{ t.roomNumber }}</strong>
              <span class="badge badge--{{ t.status === 'IN_PROGRESS' ? 'warning' : 'danger' }}">{{ statusLabel[t.status] }}</span>
            </div>
            @if (t.roomName) { <span class="small muted">{{ t.roomName }}</span> }
            <span class="small">{{ typeLabel[t.taskType] }}@if (t.dueBy) { · antes de las {{ t.dueBy | date: 'HH:mm' }} }</span>
            @if (t.rejectionCount && t.status === 'PENDING') { <span class="badge badge--warning">Devuelta: {{ t.rejectionReason }}</span> }
            @if (t.checksTotal) {
              <span class="small muted">Lista {{ t.checksDone }}/{{ t.checksTotal }}@if (t.photosMissing) { · {{ t.photosMissing }} foto(s) pendiente(s) }</span>
            }
            @if (scope() === 'all') { <span class="small muted">{{ t.assignedUserName ?? 'Sin asignar' }}</span> }
          </a>
        } @empty { <p class="empty small">Nada pendiente.</p> }
      </div>
    </section>

    <section>
      <h2>Por inspeccionar <span class="muted">({{ toInspect().length }})</span></h2>
      <div class="tasks">
        @for (t of toInspect(); track t.id) {
          <a class="card task" [routerLink]="['tareas', t.id]">
            <div class="row row--between">
              <strong class="task__room">{{ t.roomNumber }}</strong>
              <span class="badge badge--info">{{ statusLabel[t.status] }}</span>
            </div>
            <span class="small">{{ typeLabel[t.taskType] }} · terminada {{ t.completedAt | date: 'HH:mm' }}@if (t.durationMinutes !== null) { ({{ t.durationMinutes }} min) }</span>
            @if (t.assignedUserName) { <span class="small muted">{{ t.assignedUserName }}</span> }
          </a>
        } @empty { <p class="empty small">Nada que inspeccionar.</p> }
      </div>
    </section>

    @if (done().length) {
      <details class="done">
        <summary>Inspeccionadas hoy ({{ done().length }})</summary>
        <div class="tasks">
          @for (t of done(); track t.id) {
            <a class="card task task--done" [routerLink]="['tareas', t.id]">
              <strong class="task__room">{{ t.roomNumber }}</strong>
              <span class="small muted">{{ typeLabel[t.taskType] }} · {{ t.verifiedAt | date: 'HH:mm' }}</span>
            </a>
          }
        </div>
      </details>
    }

    @if (isReception()) {
      <form class="card row new-task" (ngSubmit)="create()">
        <h3 class="grow">Nueva tarea</h3>
        <select name="room" [(ngModel)]="newRoom" aria-label="Unidad" required>
          <option value="">Unidad…</option>
          @for (r of rooms.data() ?? []; track r.roomId) { <option [value]="r.roomId">{{ r.number }}{{ r.name ? ' · ' + r.name : '' }}</option> }
        </select>
        <select name="type" [(ngModel)]="newType" aria-label="Tipo">
          @for (t of taskTypes; track t) { <option [value]="t">{{ typeLabel[t] }}</option> }
        </select>
        <select name="prio" [(ngModel)]="newPriority" aria-label="Prioridad">
          <option [ngValue]="3">Normal</option><option [ngValue]="2">Alta</option><option [ngValue]="1">Urgente</option>
        </select>
        <input name="notes" [(ngModel)]="newNotes" placeholder="Notas" maxlength="1000">
        <button type="submit" class="btn btn--sm" [disabled]="!newRoom || action.busy()">Crear</button>
      </form>
    }

    <section class="card">
      <div class="row row--between">
        <h2>Estado de las unidades</h2>
        <div class="row legend">
          @for (s of flow; track s) {
            <span class="badge badge--{{ hkTone(s) }}">{{ hkShort[s] }}: {{ countByStatus()[s] ?? 0 }}</span>
          }
        </div>
      </div>
      <div class="rooms">
        @for (r of rooms.data() ?? []; track r.roomId) {
          <div class="room room--{{ hkTone(r.housekeepingStatus) }}">
            <div class="row row--between">
              <strong class="room__number">{{ r.number }}</strong>
              @if (r.openIncidents) { <span class="badge badge--warning" title="Incidencias abiertas">⚠ {{ r.openIncidents }}</span> }
            </div>
            <span class="small muted">{{ r.name ?? r.roomTypeName }}</span>
            <div class="chips">
              @if (r.occupied) { <span class="chip">Ocupado</span> }
              @if (r.departureToday) { <span class="chip">Sale hoy</span> }
              @if (r.arrivalToday) { <span class="chip chip--strong">Llega hoy</span> }
              @if (r.status !== 'ACTIVE') { <span class="chip">No operativa</span> }
            </div>
            <select [ngModel]="r.housekeepingStatus" (ngModelChange)="setRoomStatus(r, $event)" [attr.aria-label]="'Estado de ' + r.number">
              @for (s of statusOptions(r); track s) { <option [value]="s">{{ hkLabel[s] }}</option> }
            </select>
          </div>
        }
      </div>
    </section>
  `,
  styles: `
    .head { margin-bottom: 12px; }
    .head h1 { margin: 0; }
    .head input { width: auto; min-height: 32px; }
    h2 { font-size: 1.1rem; margin: 18px 0 8px; }
    .segmented { display: inline-flex; border: 1px solid var(--c-border); border-radius: var(--radius-sm); overflow: hidden; }
    .segmented button { border: 0; background: var(--c-surface); padding: 8px 16px; font: inherit; cursor: pointer; min-height: 40px; }
    .segmented button.is-active { background: var(--c-brand); color: #fff; }
    .tasks { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); }
    .task { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; margin: 0 !important; text-decoration: none;
      color: inherit; border-left: 4px solid var(--c-border); }
    .task:hover { border-left-color: var(--c-brand); }
    .task--urgent { border-left-color: var(--c-danger); }
    .task--done { opacity: 0.8; }
    .task__room { font: 600 1.3rem var(--font-display); }
    .done { margin-top: 14px; }
    .done summary { cursor: pointer; font-weight: 600; margin-bottom: 8px; }
    .new-task { margin: 16px 0; align-items: center; }
    .new-task select, .new-task input { width: auto; }
    section.card { margin-top: 18px; }
    .legend { gap: 6px; flex-wrap: wrap; }
    .rooms { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); margin-top: 10px; }
    .room { display: flex; flex-direction: column; gap: 4px; border: 1px solid var(--c-border); border-left-width: 5px;
      border-radius: var(--radius-sm); padding: 10px; }
    .room--success { border-left-color: var(--c-success); }
    .room--info { border-left-color: var(--c-info); }
    .room--warning { border-left-color: var(--c-warning); }
    .room--danger { border-left-color: var(--c-danger); }
    .room__number { font: 600 1.15rem var(--font-display); }
    .chips { display: flex; flex-wrap: wrap; gap: 4px; min-height: 22px; }
    .chip { font-size: 0.75rem; padding: 2px 8px; border-radius: 999px; background: var(--c-surface-alt); }
    .chip--strong { background: var(--c-brand-soft); color: var(--c-brand-strong); font-weight: 600; }
  `,
})
export class HousekeepingPage {
  private readonly api = inject(BackofficeApiService);
  private readonly session = inject(StaffSessionService);
  protected readonly action = useAction();
  protected readonly statusLabel = TASK_STATUS;
  protected readonly typeLabel = TASK_TYPE;
  protected readonly hkLabel = HOUSEKEEPING_STATUS;
  protected readonly hkShort = HOUSEKEEPING_STATUS_SHORT;
  protected readonly hkTone = housekeepingTone;
  protected readonly flow = HOUSEKEEPING_FLOW;
  protected readonly taskTypes: TaskType[] = ['CHECKOUT_CLEAN', 'STAYOVER_CLEAN', 'DEEP_CLEAN', 'LINEN_CHANGE', 'INSPECTION', 'MAINTENANCE'];

  protected readonly date = signal(todayInProperty());
  protected readonly isReception = computed(() => {
    this.session.user();
    return this.session.hasRole('RECEPTIONIST');
  });
  /** Limpieza ve por defecto sus tareas (y las sin asignar); recepción, todas. */
  protected readonly scope = signal<Scope>(this.session.hasRole('RECEPTIONIST') ? 'all' : 'mine');

  protected readonly tasks = apiResource({ params: () => this.date(), stream: ({ params }) => this.api.tasks(params, null) });
  protected readonly rooms = apiResource({ stream: () => this.api.housekeepingRooms() });
  protected readonly tasksError = computed(() => problemMessage(this.tasks.error()));

  private readonly visible = computed(() => {
    const me = this.session.user()?.id;
    const all = this.tasks.data() ?? [];
    return this.scope() === 'all' ? all : all.filter((t) => !t.assignedUserId || t.assignedUserId === me);
  });
  protected readonly todo = computed(() =>
    this.visible()
      .filter((t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS')
      .sort((a, b) => a.priority - b.priority || (a.dueBy ?? '9').localeCompare(b.dueBy ?? '9') || a.roomNumber.localeCompare(b.roomNumber)),
  );
  /** Las limpiezas por inspeccionar se muestran a todos: cualquiera puede inspeccionar las de otra persona. */
  protected readonly toInspect = computed(() => (this.tasks.data() ?? []).filter((t) => t.status === 'DONE'));
  protected readonly done = computed(() => this.visible().filter((t) => t.status === 'VERIFIED'));
  protected readonly countByStatus = computed(() => {
    const counts: Partial<Record<HousekeepingStatus, number>> = {};
    for (const r of this.rooms.data() ?? []) counts[r.housekeepingStatus] = (counts[r.housekeepingStatus] ?? 0) + 1;
    return counts;
  });

  protected newRoom = '';
  protected newType: TaskType = 'STAYOVER_CLEAN';
  protected newPriority = 3;
  protected newNotes = '';

  protected shift(days: number): string {
    return addDays(this.date(), days);
  }

  protected isLate(t: TaskResponse): boolean {
    return !!t.dueBy && new Date(t.dueBy).getTime() < Date.now();
  }

  /** Limpieza no puede dar una unidad por LISTA ni ponerla fuera de servicio a mano. */
  protected statusOptions(r: RoomBoardItem): HousekeepingStatus[] {
    if (this.isReception()) return this.flow;
    const allowed: HousekeepingStatus[] = ['DIRTY', 'IN_PROGRESS', 'CLEAN'];
    return allowed.includes(r.housekeepingStatus) ? allowed : [r.housekeepingStatus, ...allowed];
  }

  protected async create(): Promise<void> {
    const created = await this.action.run(() => this.api.createTask({
      roomId: this.newRoom,
      reservationId: null,
      taskType: this.newType,
      scheduledDate: this.date(),
      priority: this.newPriority,
      dueBy: null,
      assignedUserId: null,
      notes: this.newNotes.trim() || null,
    }), 'Tarea creada');
    if (created) {
      this.newRoom = '';
      this.newNotes = '';
      this.tasks.reload();
    }
  }

  protected async setRoomStatus(room: RoomBoardItem, status: HousekeepingStatus): Promise<void> {
    if (status === room.housekeepingStatus) return;
    if (await this.action.run(() => this.api.changeRoomHousekeeping(room.roomId, status), `Unidad ${room.number}: ${HOUSEKEEPING_STATUS[status]}`)) {
      this.refresh();
    } else {
      this.rooms.reload();
    }
  }

  protected refresh(): void {
    this.tasks.reload();
    this.rooms.reload();
  }
}
