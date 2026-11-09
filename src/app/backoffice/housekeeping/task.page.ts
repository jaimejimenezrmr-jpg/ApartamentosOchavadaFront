import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BackofficeApiService } from '../../core/api/backoffice-api.service';
import { IncidentPriority, TaskCheck } from '../../core/api/models';
import { problemMessage } from '../../core/api/problem';
import { StaffSessionService } from '../../core/auth/staff-session.service';
import {
  HOUSEKEEPING_STATUS,
  INCIDENT_PRIORITY,
  INCIDENT_PRIORITY_HELP,
  INCIDENT_STATUS,
  LOST_ITEM_STATUS,
  TASK_STATUS,
  TASK_TYPE,
  housekeepingTone,
  incidentTone,
} from '../../shared/labels';
import { useAction } from '../../shared/ui/action';
import { apiResource } from '../../shared/ui/api-resource';
import { PhotoButtonComponent } from '../../shared/ui/photo-button.component';
import { ProtectedImageComponent } from '../../shared/ui/protected-image.component';
import { ToastService } from '../../shared/ui/toast.service';

interface Section {
  name: string;
  checks: TaskCheck[];
}

/**
 * Ficha de una limpieza, pensada para el móvil: empezar, recorrer la lista de comprobación (con fotos donde se
 * exigen), reportar problemas u objetos olvidados y terminar. Otra persona la inspecciona y la deja LISTA o la
 * devuelve con el motivo.
 */
@Component({
  selector: 'app-task-page',
  imports: [DatePipe, FormsModule, RouterLink, PhotoButtonComponent, ProtectedImageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/backoffice/limpieza" class="small back">‹ Limpieza</a>
    @if (detail.error()) {
      <div class="alert alert--danger">{{ error() }}</div>
    } @else if (detail.data(); as d) {
      <header class="head">
        <div>
          <h1>{{ d.task.roomNumber }}@if (d.task.roomName) { <span class="muted"> · {{ d.task.roomName }}</span> }</h1>
          <p class="muted">{{ typeLabel[d.task.taskType] }}@if (d.task.dueBy) { · lista antes de las {{ d.task.dueBy | date: 'HH:mm' }} }</p>
        </div>
        <div class="badges">
          <span class="badge badge--{{ statusTone() }}">{{ statusLabel[d.task.status] }}</span>
          <span class="badge badge--{{ hkTone(d.task.roomHousekeepingStatus) }}">{{ hkLabel[d.task.roomHousekeepingStatus] }}</span>
        </div>
      </header>

      @if (d.task.status === 'PENDING' && d.task.rejectionReason) {
        <div class="alert alert--warning">Inspección no superada: <strong>{{ d.task.rejectionReason }}</strong>. Repita y vuelva a marcar la lista.</div>
      }
      @if (d.task.notes) { <p class="small notes">{{ d.task.notes }}</p> }

      @if (d.task.status === 'PENDING') {
        <button type="button" class="btn btn--lg btn--block" [disabled]="action.busy()" (click)="start()">Empezar limpieza</button>
      }

      @if (d.checks.length) {
        <section class="card">
          <div class="row row--between"><h2>Lista de comprobación</h2><span class="small muted">{{ d.task.checksDone }}/{{ d.task.checksTotal }}</span></div>
          <div class="progress" aria-hidden="true"><span [style.width.%]="progress()"></span></div>
          @for (section of sections(); track section.name) {
            @if (section.name) { <h3 class="section">{{ section.name }}</h3> }
            <ul class="checks">
              @for (c of section.checks; track c.id) {
                <li class="check" [class.is-done]="c.checked">
                  <label class="check__main">
                    <input type="checkbox" [checked]="c.checked" [disabled]="!editable() || action.busy()" (change)="toggle(c, $any($event.target).checked)">
                    <span>{{ c.label }}</span>
                    @if (c.photoRequired) {
                      <span class="badge badge--{{ c.photos.length ? 'success' : 'warning' }}">{{ c.photos.length ? 'Foto ✓' : 'Foto obligatoria' }}</span>
                    }
                  </label>
                  @if (c.photos.length || editable()) {
                    <div class="row photos">
                      @for (p of c.photos; track p.id) { <app-protected-image [mediaId]="p.id" [alt]="c.label" /> }
                      @if (editable()) { <app-photo-button (picked)="addPhoto(c, $event)" /> }
                    </div>
                  }
                  @if (editable()) {
                    <input class="comment" [ngModel]="c.comment ?? ''" (blur)="saveComment(c, $any($event.target).value)"
                           maxlength="500" placeholder="Comentario (opcional)" [attr.aria-label]="'Comentario: ' + c.label">
                  } @else if (c.comment) {
                    <p class="small muted">{{ c.comment }}</p>
                  }
                </li>
              }
            </ul>
          }
        </section>
      } @else if (d.task.status === 'IN_PROGRESS') {
        <p class="small muted">Esta unidad no tiene lista de comprobación: termine cuando esté limpia.</p>
      }

      @if (d.task.status === 'IN_PROGRESS') {
        <section class="card stack">
          @if (missing().length) {
            <p class="small">Falta: {{ missing().join(', ') }}</p>
          }
          <input [(ngModel)]="completionNotes" maxlength="2000" placeholder="Notas para recepción (opcional)" aria-label="Notas">
          <button type="button" class="btn btn--success btn--lg btn--block" [disabled]="action.busy() || missing().length > 0" (click)="complete()">
            Terminar limpieza
          </button>
        </section>
      }

      @if (d.task.status === 'DONE') {
        <section class="card stack">
          <h2>Inspección</h2>
          <p class="small muted">Limpieza terminada {{ d.task.completedAt | date: 'HH:mm' }}@if (d.task.durationMinutes !== null) { en {{ d.task.durationMinutes }} min}@if (d.task.assignedUserName) { por {{ d.task.assignedUserName }}}.</p>
          @if (canInspect()) {
            <button type="button" class="btn btn--success btn--lg btn--block" [disabled]="action.busy()" (click)="approve()">Inspección correcta · LISTO</button>
            <textarea [(ngModel)]="rejectReason" rows="2" maxlength="500" placeholder="Si algo no está bien, indique qué hay que repetir" aria-label="Motivo del rechazo"></textarea>
            <button type="button" class="btn btn--danger btn--block" [disabled]="action.busy() || !rejectReason.trim()" (click)="reject()">Devolver a limpieza</button>
          } @else {
            <p class="alert alert--info">La inspección la hace otra persona del equipo.</p>
          }
        </section>
      }

      @if (d.task.status === 'VERIFIED') {
        <p class="alert alert--success">Inspeccionada {{ d.task.verifiedAt | date: 'd MMM, HH:mm' }}: la unidad está LISTA.</p>
      }

      <section class="card stack">
        <div class="row">
          <button type="button" class="btn btn--secondary grow" (click)="toggleForm('incident')">⚠ Reportar problema</button>
          <button type="button" class="btn btn--secondary grow" (click)="toggleForm('lost')">🧳 Objeto olvidado</button>
        </div>

        @if (form() === 'incident') {
          <form class="stack" (ngSubmit)="reportIncident()">
            <div class="field"><label for="in-title">¿Qué ocurre?</label>
              <input id="in-title" name="title" [(ngModel)]="incidentTitle" maxlength="150" required placeholder="p. ej. La lámpara de la mesilla no funciona"></div>
            <div class="field"><label for="in-prio">Prioridad</label>
              <select id="in-prio" name="prio" [(ngModel)]="incidentPriority">
                @for (p of priorities; track p) { <option [value]="p">{{ priorityLabel[p] }}</option> }
              </select>
              <span class="field__hint">{{ priorityHelp[incidentPriority] }}</span></div>
            <div class="field"><label for="in-desc">Detalles</label>
              <textarea id="in-desc" name="desc" [(ngModel)]="incidentDescription" rows="2" maxlength="4000"></textarea></div>
            <div class="row">
              <app-photo-button [label]="incidentPhoto() ? '📷 Cambiar foto' : '📷 Añadir foto'" (picked)="incidentPhoto.set($event)" />
              @if (incidentPhoto()) { <span class="small muted">Foto preparada</span> }
              <button type="submit" class="btn grow" [disabled]="action.busy() || !incidentTitle.trim()">Enviar</button>
            </div>
          </form>
        }

        @if (form() === 'lost') {
          <form class="stack" (ngSubmit)="reportLost()">
            <div class="field"><label for="lo-desc">Objeto</label>
              <input id="lo-desc" name="desc" [(ngModel)]="lostDescription" maxlength="300" required placeholder="p. ej. Cargador de móvil blanco"></div>
            <div class="field"><label for="lo-where">Dónde se guarda</label>
              <input id="lo-where" name="where" [(ngModel)]="lostLocation" maxlength="120" placeholder="p. ej. Recepción, cajón 2"></div>
            <div class="row">
              <app-photo-button [label]="lostPhoto() ? '📷 Cambiar foto' : '📷 Añadir foto'" (picked)="lostPhoto.set($event)" />
              @if (lostPhoto()) { <span class="small muted">Foto preparada</span> }
              <button type="submit" class="btn grow" [disabled]="action.busy() || !lostDescription.trim()">Registrar</button>
            </div>
          </form>
        }

        @for (i of d.incidents; track i.id) {
          <div class="reported">
            <span class="badge badge--{{ incTone(i.priority) }}">{{ i.priority }}</span>
            <span class="grow">{{ i.title }} <span class="small muted">· {{ i.code }} · {{ incidentStatus[i.status] }}</span></span>
            @for (p of i.photos; track p.id) { <app-protected-image [mediaId]="p.id" [alt]="i.title" /> }
          </div>
        }
        @for (l of d.lostItems; track l.id) {
          <div class="reported">
            <span class="badge badge--info">Objeto</span>
            <span class="grow">{{ l.description }} <span class="small muted">· {{ l.code }} · {{ lostStatus[l.status] }}</span></span>
            @for (p of l.photos; track p.id) { <app-protected-image [mediaId]="p.id" [alt]="l.description" /> }
          </div>
        }
      </section>
    } @else {
      <div class="loading"><span class="spinner"></span></div>
    }
  `,
  styles: `
    :host { display: block; max-width: 760px; }
    .back { display: inline-block; margin-bottom: 8px; }
    .head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; flex-wrap: wrap; margin-bottom: 12px; }
    .head h1 { margin: 0; }
    .head p { margin: 2px 0 0; }
    .badges { display: flex; gap: 6px; flex-wrap: wrap; }
    .notes { white-space: pre-line; }
    .btn--lg { min-height: 52px; font-size: 1.05rem; }
    .btn--block { width: 100%; justify-content: center; }
    .progress { height: 6px; background: var(--c-surface-alt); border-radius: 3px; overflow: hidden; margin: 6px 0 4px; }
    .progress span { display: block; height: 100%; background: var(--c-success); transition: width 0.2s; }
    .section { margin: 16px 0 4px; font-size: 0.95rem; color: var(--c-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .checks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .check { border: 1px solid var(--c-border); border-radius: var(--radius-sm); padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
    .check.is-done { border-color: var(--c-success); background: var(--c-success-soft); }
    .check__main { display: flex; align-items: center; gap: 12px; font-weight: 500; cursor: pointer; min-height: 32px; }
    .check__main input { width: 26px; height: 26px; flex: 0 0 auto; accent-color: var(--c-success); }
    .check__main span:first-of-type { flex: 1; }
    .photos { gap: 8px; align-items: center; }
    .comment { font-size: 0.9rem; width: 100%; min-height: 36px; }
    .reported { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; border-top: 1px solid var(--c-border); padding-top: 8px; }
    .card + .card { margin-top: 12px; }
    section.card { margin-top: 12px; }
  `,
})
export class TaskPage {
  private readonly api = inject(BackofficeApiService);
  private readonly session = inject(StaffSessionService);
  private readonly toast = inject(ToastService);
  protected readonly action = useAction();
  readonly id = input.required<string>();

  protected readonly statusLabel = TASK_STATUS;
  protected readonly typeLabel = TASK_TYPE;
  protected readonly hkLabel = HOUSEKEEPING_STATUS;
  protected readonly hkTone = housekeepingTone;
  protected readonly incTone = incidentTone;
  protected readonly priorityLabel = INCIDENT_PRIORITY;
  protected readonly priorityHelp = INCIDENT_PRIORITY_HELP;
  protected readonly incidentStatus = INCIDENT_STATUS;
  protected readonly lostStatus = LOST_ITEM_STATUS;
  protected readonly priorities: IncidentPriority[] = ['P1', 'P2', 'P3', 'P4'];

  protected readonly detail = apiResource({ params: () => this.id(), stream: ({ params }) => this.api.task(params) });
  protected readonly error = computed(() => problemMessage(this.detail.error()));

  protected readonly editable = computed(() => this.detail.data()?.task.status === 'IN_PROGRESS');
  protected readonly sections = computed<Section[]>(() => {
    const result: Section[] = [];
    for (const c of this.detail.data()?.checks ?? []) {
      const name = c.section ?? '';
      const last = result.at(-1);
      if (last && last.name === name) last.checks.push(c);
      else result.push({ name, checks: [c] });
    }
    return result;
  });
  protected readonly progress = computed(() => {
    const t = this.detail.data()?.task;
    return t && t.checksTotal ? Math.round((t.checksDone / t.checksTotal) * 100) : 0;
  });
  protected readonly missing = computed(() =>
    (this.detail.data()?.checks ?? []).flatMap((c) =>
      !c.checked ? [c.label] : c.photoRequired && !c.photos.length ? [`${c.label} (foto)`] : [],
    ),
  );
  protected readonly canInspect = computed(() => {
    const t = this.detail.data()?.task;
    const me = this.session.user();
    return !!t && !!me && (t.completedByUserId !== me.id || me.role === 'ADMIN');
  });
  protected readonly statusTone = computed(() => {
    switch (this.detail.data()?.task.status) {
      case 'VERIFIED': return 'success';
      case 'DONE': return 'info';
      case 'IN_PROGRESS': return 'warning';
      case 'CANCELLED': return 'neutral';
      default: return 'danger';
    }
  });

  protected readonly form = signal<'incident' | 'lost' | null>(null);
  protected completionNotes = '';
  protected rejectReason = '';
  protected incidentTitle = '';
  protected incidentPriority: IncidentPriority = 'P3';
  protected incidentDescription = '';
  protected readonly incidentPhoto = signal<Blob | null>(null);
  protected lostDescription = '';
  protected lostLocation = '';
  protected readonly lostPhoto = signal<Blob | null>(null);

  protected async start(): Promise<void> {
    if (await this.action.run(() => this.api.startTask(this.id()), 'Limpieza empezada')) this.detail.reload();
  }

  protected async toggle(c: TaskCheck, checked: boolean): Promise<void> {
    if (await this.action.run(() => this.api.markCheck(this.id(), c.id, checked, c.comment))) this.detail.reload();
    else this.detail.reload();
  }

  protected async saveComment(c: TaskCheck, value: string): Promise<void> {
    const comment = value.trim() || null;
    if (comment === (c.comment ?? null)) return;
    if (await this.action.run(() => this.api.markCheck(this.id(), c.id, c.checked, comment))) this.detail.reload();
  }

  protected async addPhoto(c: TaskCheck, photo: Blob): Promise<void> {
    if (await this.action.run(() => this.api.uploadCheckPhoto(this.id(), c.id, photo), 'Foto guardada')) this.detail.reload();
  }

  protected async complete(): Promise<void> {
    const done = await this.action.run(() => this.api.completeTask(this.id(), this.completionNotes.trim() || null),
      'Limpieza terminada: pendiente de inspección');
    if (done) {
      this.completionNotes = '';
      this.detail.reload();
    }
  }

  protected async approve(): Promise<void> {
    if (await this.action.run(() => this.api.verifyTask(this.id()), 'Unidad LISTA')) this.detail.reload();
  }

  protected async reject(): Promise<void> {
    if (await this.action.run(() => this.api.rejectTask(this.id(), this.rejectReason.trim()), 'Devuelta a limpieza')) {
      this.rejectReason = '';
      this.detail.reload();
    }
  }

  protected toggleForm(kind: 'incident' | 'lost'): void {
    this.form.update((current) => (current === kind ? null : kind));
  }

  protected async reportIncident(): Promise<void> {
    const photo = this.incidentPhoto();
    const created = await this.action.run(() => this.api.createIncident({
      roomId: null,
      taskId: this.id(),
      title: this.incidentTitle.trim(),
      description: this.incidentDescription.trim() || null,
      priority: this.incidentPriority,
    }), (i) => `Incidencia ${i.code} enviada`);
    if (!created) return;
    if (photo) await this.uploadAfterCreate(() => firstValueFrom(this.api.uploadIncidentPhoto(created.id, photo)));
    this.incidentTitle = '';
    this.incidentDescription = '';
    this.incidentPriority = 'P3';
    this.incidentPhoto.set(null);
    this.form.set(null);
    this.detail.reload();
  }

  protected async reportLost(): Promise<void> {
    const photo = this.lostPhoto();
    const created = await this.action.run(() => this.api.createLostItem({
      roomId: null,
      taskId: this.id(),
      description: this.lostDescription.trim(),
      storageLocation: this.lostLocation.trim() || null,
    }), (l) => `Objeto ${l.code} registrado`);
    if (!created) return;
    if (photo) await this.uploadAfterCreate(() => firstValueFrom(this.api.uploadLostItemPhoto(created.id, photo)));
    this.lostDescription = '';
    this.lostLocation = '';
    this.lostPhoto.set(null);
    this.form.set(null);
    this.detail.reload();
  }

  /** El registro ya está creado: si la foto falla, se avisa sin perderlo. */
  private async uploadAfterCreate(upload: () => Promise<unknown>): Promise<void> {
    try {
      await upload();
    } catch (e) {
      this.toast.error(`Registrado, pero la foto no se pudo subir: ${problemMessage(e)}`);
    }
  }
}
