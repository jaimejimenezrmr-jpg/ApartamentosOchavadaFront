import { apiResource } from '../../shared/ui/api-resource';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BackofficeApiService } from '../../core/api/backoffice-api.service';
import { HousekeepingStatus, RoomResponse, TaskResponse, TaskStatus, TaskType } from '../../core/api/models';
import { problemMessage } from '../../core/api/problem';
import { StaffSessionService } from '../../core/auth/staff-session.service';
import { addDays, todayInProperty } from '../../core/util/dates';
import { HOUSEKEEPING_STATUS, TASK_STATUS, TASK_TYPE, housekeepingTone } from '../../shared/labels';
import { useAction } from '../../shared/ui/action';

/**
 * Tablero de limpieza: tareas del día por estado y estado de cada unidad. Pensado para móvil (el personal
 * lo usa en el pasillo): botones grandes y una tarjeta por tarea.
 */
@Component({
  selector: 'app-housekeeping-page',
  imports: [DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row row--between head">
      <h1>Limpieza</h1>
      <div class="row">
        <button type="button" class="btn btn--secondary btn--sm" (click)="date.set(shift(-1))">‹</button>
        <input type="date" [ngModel]="date()" (ngModelChange)="$event && date.set($event)" aria-label="Fecha">
        <button type="button" class="btn btn--secondary btn--sm" (click)="date.set(shift(1))">›</button>
        <button type="button" class="btn btn--ghost btn--sm" (click)="tasks.reload(); rooms.reload()">Actualizar</button>
      </div>
    </div>

    @if (tasks.error()) { <div class="alert alert--danger">{{ tasksError() }}</div> }
    <div class="board">
      @for (col of columns; track col) {
        <section class="column">
          <h3>{{ statusLabel[col] }} <span class="muted">({{ byStatus()[col].length }})</span></h3>
          @for (t of byStatus()[col]; track t.id) {
            <article class="card task" [class.task--urgent]="t.priority >= 3">
              <div class="row row--between">
                <strong class="task__room">{{ t.roomNumber }}</strong>
                <span class="badge badge--{{ hkTone(t.roomHousekeepingStatus) }}">{{ hkLabel[t.roomHousekeepingStatus] }}</span>
              </div>
              <p class="small">{{ typeLabel[t.taskType] }}@if (t.dueBy) { · antes de las {{ t.dueBy | date: 'HH:mm' }} }</p>
              @if (t.notes) { <p class="small muted">{{ t.notes }}</p> }
              <div class="row">
                @if (t.status === 'PENDING') {
                  <button type="button" class="btn btn--sm" [disabled]="action.busy()" (click)="start(t)">Empezar</button>
                }
                @if (t.status === 'PENDING' || t.status === 'IN_PROGRESS') {
                  <button type="button" class="btn btn--success btn--sm" [disabled]="action.busy()" (click)="complete(t)">Terminada</button>
                }
                @if (t.status === 'DONE' && isReception()) {
                  <button type="button" class="btn btn--sm" [disabled]="action.busy()" (click)="verify(t)">Verificar</button>
                }
                @if ((t.status === 'PENDING' || t.status === 'IN_PROGRESS') && isReception()) {
                  <button type="button" class="btn btn--ghost btn--sm" [disabled]="action.busy()" (click)="cancel(t)">Anular</button>
                }
              </div>
            </article>
          } @empty { <p class="empty small">—</p> }
        </section>
      }
    </div>

    @if (isReception()) {
      <form class="card row new-task" (ngSubmit)="create()">
        <h3 class="grow">Nueva tarea</h3>
        <select name="room" [(ngModel)]="newRoom" aria-label="Unidad" required>
          <option value="">Unidad…</option>
          @for (r of rooms.data() ?? []; track r.id) { <option [value]="r.id">{{ r.number }}</option> }
        </select>
        <select name="type" [(ngModel)]="newType" aria-label="Tipo">
          @for (t of taskTypes; track t) { <option [value]="t">{{ typeLabel[t] }}</option> }
        </select>
        <select name="prio" [(ngModel)]="newPriority" aria-label="Prioridad">
          <option [ngValue]="1">Normal</option><option [ngValue]="2">Alta</option><option [ngValue]="3">Urgente</option>
        </select>
        <input name="notes" [(ngModel)]="newNotes" placeholder="Notas" maxlength="1000">
        <button type="submit" class="btn btn--sm" [disabled]="!newRoom || action.busy()">Crear</button>
      </form>
    }

    <section class="card">
      <h3>Estado de las unidades</h3>
      <div class="rooms">
        @for (r of rooms.data() ?? []; track r.id) {
          <div class="room">
            <strong>{{ r.number }}</strong>
            <span class="small muted">{{ r.roomTypeName }}</span>
            <select [ngModel]="r.housekeepingStatus" (ngModelChange)="setRoomStatus(r, $event)" [attr.aria-label]="'Estado de ' + r.number"
                    class="hk hk--{{ hkTone(r.housekeepingStatus) }}">
              @for (s of hkStatuses; track s) { <option [value]="s">{{ hkLabel[s] }}</option> }
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
    .board { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); align-items: start; }
    .column { background: var(--c-surface-alt); border-radius: var(--radius); padding: 10px; display: flex; flex-direction: column; gap: 8px; }
    .column h3 { margin: 4px 4px 0; font-size: 1rem; }
    .task { padding: 12px; margin: 0 !important; }
    .task p { margin: 4px 0 8px; }
    .task--urgent { border-left: 4px solid var(--c-danger); }
    .task__room { font: 600 1.2rem var(--font-display); }
    .new-task { margin: 16px 0; align-items: center; }
    .new-task select, .new-task input { width: auto; }
    .rooms { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }
    .room { display: flex; flex-direction: column; gap: 4px; border: 1px solid var(--c-border); border-radius: var(--radius-sm); padding: 10px; }
    .hk--success { border-color: var(--c-success); }
    .hk--danger { border-color: var(--c-danger); }
    .hk--warning { border-color: var(--c-warning); }
  `,
})
export class HousekeepingPage {
  private readonly api = inject(BackofficeApiService);
  private readonly session = inject(StaffSessionService);
  protected readonly action = useAction();
  protected readonly statusLabel = TASK_STATUS;
  protected readonly typeLabel = TASK_TYPE;
  protected readonly hkLabel = HOUSEKEEPING_STATUS;
  protected readonly hkTone = housekeepingTone;
  protected readonly columns: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'DONE', 'VERIFIED'];
  protected readonly taskTypes: TaskType[] = ['CHECKOUT_CLEAN', 'STAYOVER_CLEAN', 'DEEP_CLEAN', 'LINEN_CHANGE', 'INSPECTION', 'MAINTENANCE'];
  protected readonly hkStatuses: HousekeepingStatus[] = ['DIRTY', 'IN_PROGRESS', 'CLEAN', 'INSPECTED', 'OUT_OF_SERVICE'];

  protected readonly date = signal(todayInProperty());
  protected readonly tasks = apiResource({ params: () => this.date(), stream: ({ params }) => this.api.tasks(params, null) });
  protected readonly rooms = apiResource({ stream: () => this.api.rooms() });
  protected readonly tasksError = computed(() => problemMessage(this.tasks.error()));
  protected readonly isReception = computed(() => {
    this.session.user();
    return this.session.hasRole('RECEPTIONIST');
  });
  protected readonly byStatus = computed(() => {
    const groups: Record<TaskStatus, TaskResponse[]> = { PENDING: [], IN_PROGRESS: [], DONE: [], VERIFIED: [], CANCELLED: [] };
    for (const t of this.tasks.data() ?? []) groups[t.status].push(t);
    for (const list of Object.values(groups)) list.sort((a, b) => b.priority - a.priority || a.roomNumber.localeCompare(b.roomNumber));
    return groups;
  });

  protected newRoom = '';
  protected newType: TaskType = 'STAYOVER_CLEAN';
  protected newPriority = 1;
  protected newNotes = '';

  protected shift(days: number): string {
    return addDays(this.date(), days);
  }

  protected async start(t: TaskResponse): Promise<void> {
    if (await this.action.run(() => this.api.startTask(t.id))) this.refresh();
  }

  protected async complete(t: TaskResponse): Promise<void> {
    if (await this.action.run(() => this.api.completeTask(t.id, null), `Unidad ${t.roomNumber} terminada`)) this.refresh();
  }

  protected async verify(t: TaskResponse): Promise<void> {
    if (await this.action.run(() => this.api.verifyTask(t.id), `Unidad ${t.roomNumber} verificada`)) this.refresh();
  }

  protected async cancel(t: TaskResponse): Promise<void> {
    if (await this.action.run(() => this.api.cancelTask(t.id), 'Tarea anulada')) this.refresh();
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

  protected async setRoomStatus(room: RoomResponse, status: HousekeepingStatus): Promise<void> {
    if (status === room.housekeepingStatus) return;
    if (await this.action.run(() => this.api.changeRoomHousekeeping(room.id, status), `Unidad ${room.number}: ${HOUSEKEEPING_STATUS[status]}`)) {
      this.refresh();
    }
  }

  private refresh(): void {
    this.tasks.reload();
    this.rooms.reload();
  }
}
