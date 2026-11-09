import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BackofficeApiService } from '../../core/api/backoffice-api.service';
import { IncidentOrigin, IncidentPriority, IncidentResponse, IncidentStatus } from '../../core/api/models';
import { problemMessage } from '../../core/api/problem';
import { elapsedSince } from '../../core/util/dates';
import {
  INCIDENT_ORIGIN,
  INCIDENT_PRIORITY,
  INCIDENT_PRIORITY_HELP,
  INCIDENT_STATUS,
  incidentTone,
} from '../../shared/labels';
import { useAction } from '../../shared/ui/action';
import { apiResource } from '../../shared/ui/api-resource';
import { PhotoButtonComponent } from '../../shared/ui/photo-button.component';
import { ProtectedImageComponent } from '../../shared/ui/protected-image.component';

/**
 * Centro de incidencias: de un vistazo, qué ocurre, dónde, desde cuándo y en qué estado. Ordenadas por prioridad
 * (P1 emergencia … P4 mejora) y antigüedad.
 */
@Component({
  selector: 'app-incidents-page',
  imports: [DatePipe, FormsModule, RouterLink, PhotoButtonComponent, ProtectedImageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row row--between head">
      <h1>Incidencias</h1>
      <button type="button" class="btn btn--sm" (click)="creating.set(!creating())">{{ creating() ? 'Cancelar' : 'Nueva incidencia' }}</button>
    </div>

    @if (creating()) {
      <form class="card stack" (ngSubmit)="create()">
        <div class="grid-3">
          <div class="field"><label for="ni-room">Unidad</label>
            <select id="ni-room" name="room" [(ngModel)]="newRoom">
              <option value="">Zona común / sin unidad</option>
              @for (r of rooms.data() ?? []; track r.roomId) { <option [value]="r.roomId">{{ r.number }}{{ r.name ? ' · ' + r.name : '' }}</option> }
            </select></div>
          <div class="field"><label for="ni-prio">Prioridad</label>
            <select id="ni-prio" name="prio" [(ngModel)]="newPriority">
              @for (p of priorities; track p) { <option [value]="p">{{ priorityLabel[p] }}</option> }
            </select>
            <span class="field__hint">{{ priorityHelp[newPriority] }}</span></div>
          <div class="field"><label for="ni-origin">Origen</label>
            <select id="ni-origin" name="origin" [(ngModel)]="newOrigin">
              <option value="STAFF">Detectada por el personal</option><option value="GUEST">Comunicada por un huésped</option>
            </select></div>
        </div>
        <div class="field"><label for="ni-title">Incidencia *</label>
          <input id="ni-title" name="title" [(ngModel)]="newTitle" maxlength="150" required placeholder="p. ej. No enfría el aire acondicionado"></div>
        <div class="field"><label for="ni-desc">Detalles</label>
          <textarea id="ni-desc" name="desc" [(ngModel)]="newDescription" rows="2" maxlength="4000"></textarea></div>
        <div class="row row--end">
          <button type="submit" class="btn btn--sm" [disabled]="action.busy() || !newTitle.trim()">Crear incidencia</button>
        </div>
      </form>
    }

    <div class="row filters">
      <label class="check"><input type="checkbox" [ngModel]="activeOnly()" (ngModelChange)="activeOnly.set($event)"> Solo abiertas</label>
      <select [ngModel]="priority() ?? ''" (ngModelChange)="priority.set($event || null)" aria-label="Prioridad">
        <option value="">Todas las prioridades</option>
        @for (p of priorities; track p) { <option [value]="p">{{ priorityLabel[p] }}</option> }
      </select>
      <button type="button" class="btn btn--ghost btn--sm" (click)="list.reload()">Actualizar</button>
    </div>

    @if (list.error()) {
      <div class="alert alert--danger">{{ error() }}</div>
    } @else {
      <section class="card table-wrap">
        <table class="table">
          <thead><tr><th>Prioridad</th><th>Unidad</th><th>Incidencia</th><th>Origen</th><th>Tiempo</th><th>Estado</th></tr></thead>
          <tbody>
            @for (i of list.data() ?? []; track i.id) {
              <tr class="is-link" (click)="toggle(i)" [class.is-open]="openId() === i.id">
                <td><span class="badge badge--{{ tone(i.priority) }}">{{ i.priority }}</span></td>
                <td>{{ i.roomNumber ?? '—' }}</td>
                <td><strong>{{ i.title }}</strong><br><span class="small muted">{{ i.code }}@if (i.reportedByName) { · {{ i.reportedByName }} }</span></td>
                <td class="small">{{ originLabel[i.origin] }}</td>
                <td class="small nowrap">{{ elapsed(i) }}</td>
                <td><span class="badge badge--{{ statusTone(i.status) }}">{{ statusLabel[i.status] }}</span></td>
              </tr>
              @if (openId() === i.id) {
                <tr class="detail"><td colspan="6">
                  <div class="stack">
                    @if (i.description) { <p class="pre">{{ i.description }}</p> }
                    <p class="small muted">Creada {{ i.createdAt | date: 'd MMM y, HH:mm' }}@if (i.taskId) { · desde una <a [routerLink]="['/backoffice/limpieza/tareas', i.taskId]">limpieza</a> }@if (i.resolvedAt) { · resuelta {{ i.resolvedAt | date: 'd MMM, HH:mm' }} }</p>
                    @if (i.resolution) { <p class="pre"><strong>Resolución:</strong> {{ i.resolution }}</p> }
                    <div class="row photos">
                      @for (p of i.photos; track p.id) { <app-protected-image [mediaId]="p.id" [alt]="i.title" /> }
                      @if (i.status !== 'CLOSED' && i.status !== 'CANCELLED') { <app-photo-button (picked)="addPhoto(i, $event)" /> }
                    </div>
                    @if (i.status === 'OPEN' || i.status === 'IN_PROGRESS' || i.status === 'RESOLVED') {
                      <div class="row actions">
                        @if (i.status === 'OPEN' || i.status === 'IN_PROGRESS') {
                          <select [ngModel]="i.priority" (ngModelChange)="changePriority(i, $event)" aria-label="Cambiar prioridad">
                            @for (p of priorities; track p) { <option [value]="p">{{ priorityLabel[p] }}</option> }
                          </select>
                        }
                        <input class="grow" [(ngModel)]="notes" [placeholder]="i.status === 'RESOLVED' ? 'Motivo para reabrir' : 'Qué se ha hecho / notas'" maxlength="2000" aria-label="Notas">
                        @if (i.status === 'OPEN') { <button type="button" class="btn btn--secondary btn--sm" [disabled]="action.busy()" (click)="move(i, 'IN_PROGRESS')">En curso</button> }
                        @if (i.status === 'OPEN' || i.status === 'IN_PROGRESS') {
                          <button type="button" class="btn btn--success btn--sm" [disabled]="action.busy() || !notes.trim()" (click)="move(i, 'RESOLVED')">Resuelta</button>
                          <button type="button" class="btn btn--ghost btn--sm" [disabled]="action.busy()" (click)="move(i, 'CANCELLED')">Anular</button>
                        }
                        @if (i.status === 'RESOLVED') {
                          <button type="button" class="btn btn--success btn--sm" [disabled]="action.busy()" (click)="move(i, 'CLOSED')">Revisada · cerrar</button>
                          <button type="button" class="btn btn--secondary btn--sm" [disabled]="action.busy() || !notes.trim()" (click)="move(i, 'IN_PROGRESS')">Reabrir</button>
                        }
                      </div>
                    }
                  </div>
                </td></tr>
              }
            } @empty {
              <tr><td colspan="6" class="empty">@if (list.isLoading()) { Cargando… } @else { Sin incidencias. }</td></tr>
            }
          </tbody>
        </table>
      </section>
    }
  `,
  styles: `
    .head { margin-bottom: 12px; }
    .head h1 { margin: 0; }
    .filters { margin: 12px 0; align-items: center; }
    .filters select { width: auto; }
    tr.is-open td { background: var(--c-surface-alt); }
    tr.detail td { background: var(--c-surface-alt); border-top: 0; }
    .pre { white-space: pre-line; margin: 0; }
    .photos { gap: 8px; align-items: center; }
    .actions { align-items: center; }
    .actions select { width: auto; }
    .grid-3 { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
  `,
})
export class IncidentsPage {
  private readonly api = inject(BackofficeApiService);
  protected readonly action = useAction();
  protected readonly priorities: IncidentPriority[] = ['P1', 'P2', 'P3', 'P4'];
  protected readonly priorityLabel = INCIDENT_PRIORITY;
  protected readonly priorityHelp = INCIDENT_PRIORITY_HELP;
  protected readonly statusLabel = INCIDENT_STATUS;
  protected readonly originLabel = INCIDENT_ORIGIN;
  protected readonly tone = incidentTone;

  protected readonly activeOnly = signal(true);
  protected readonly priority = signal<IncidentPriority | null>(null);
  protected readonly list = apiResource({
    params: () => ({ activeOnly: this.activeOnly(), priority: this.priority() }),
    stream: ({ params }) => this.api.incidents(params),
  });
  protected readonly rooms = apiResource({ stream: () => this.api.housekeepingRooms() });
  protected readonly error = computed(() => problemMessage(this.list.error()));

  protected readonly openId = signal<string | null>(null);
  protected readonly creating = signal(false);
  protected notes = '';
  protected newRoom = '';
  protected newPriority: IncidentPriority = 'P3';
  protected newOrigin: IncidentOrigin = 'STAFF';
  protected newTitle = '';
  protected newDescription = '';

  protected elapsed(i: IncidentResponse): string {
    return elapsedSince(i.createdAt, i.closedAt ? new Date(i.closedAt).getTime() : i.resolvedAt ? new Date(i.resolvedAt).getTime() : Date.now());
  }

  protected statusTone(status: IncidentStatus): string {
    return status === 'OPEN' ? 'danger' : status === 'IN_PROGRESS' ? 'warning' : status === 'RESOLVED' ? 'info' : 'neutral';
  }

  protected toggle(i: IncidentResponse): void {
    this.notes = '';
    this.openId.update((id) => (id === i.id ? null : i.id));
  }

  protected async create(): Promise<void> {
    const created = await this.action.run(() => this.api.createIncident({
      roomId: this.newRoom || null,
      taskId: null,
      title: this.newTitle.trim(),
      description: this.newDescription.trim() || null,
      priority: this.newPriority,
      origin: this.newOrigin,
    }), (i) => `Incidencia ${i.code} creada`);
    if (created) {
      this.newTitle = '';
      this.newDescription = '';
      this.newRoom = '';
      this.newPriority = 'P3';
      this.creating.set(false);
      this.openId.set(created.id);
      this.list.reload();
    }
  }

  protected async move(i: IncidentResponse, status: IncidentStatus): Promise<void> {
    const notes = this.notes.trim() || null;
    if (await this.action.run(() => this.api.changeIncidentStatus(i.id, status, notes, i.version), `${i.code}: ${INCIDENT_STATUS[status]}`)) {
      this.notes = '';
      this.list.reload();
    }
  }

  protected async changePriority(i: IncidentResponse, priority: IncidentPriority): Promise<void> {
    if (priority === i.priority) return;
    if (await this.action.run(() => this.api.changeIncidentPriority(i.id, priority, i.version), `${i.code}: ${priority}`)) this.list.reload();
  }

  protected async addPhoto(i: IncidentResponse, photo: Blob): Promise<void> {
    if (await this.action.run(() => this.api.uploadIncidentPhoto(i.id, photo), 'Foto añadida')) this.list.reload();
  }
}
