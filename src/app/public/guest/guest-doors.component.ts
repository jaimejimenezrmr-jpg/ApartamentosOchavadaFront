import { apiResource } from '../../shared/ui/api-resource';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Door, DoorKind } from '../../core/api/models';
import { GuestApiService } from '../../core/api/guest-api.service';
import { problemMessage } from '../../core/api/problem';
import { DOOR_REASON, SELF_CHECKIN_BLOCKER } from './guest-labels';

/** Autocheck-in y botones «Abrir Entrada Principal» / «Abrir Mi Habitación». */
@Component({
  selector: 'app-guest-doors',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (doors.isLoading() && !doors.data()) {
      <div class="loading"><span class="spinner"></span></div>
    } @else if (doors.error()) {
      <div class="alert alert--danger">{{ loadError() }}</div>
    } @else if (doors.data(); as d) {
      <div class="stack">
        @if (d.status === 'CONFIRMED') {
          <section class="card stack">
            <h2>Check-in</h2>
            @if (d.selfCheckIn.available) {
              <p>Todo está listo. Haga el check-in para activar las llaves digitales.</p>
              <button type="button" class="btn btn--lg btn--success" [disabled]="busy()" (click)="selfCheckIn()">Hacer el check-in</button>
            } @else {
              <ul class="blockers">
                @for (b of d.selfCheckIn.blockers; track b) { <li>{{ blocker(b) }}</li> }
              </ul>
            }
          </section>
        }
        @if (d.accessFrom && d.accessUntil) {
          <p class="muted small">Llaves activas del {{ d.accessFrom | date: 'd MMM, HH:mm' }} al {{ d.accessUntil | date: 'd MMM, HH:mm' }}.</p>
        }
        <div class="doors">
          @for (door of d.doors; track door.kind) {
            <section class="card door" [class.door--off]="!door.available">
              <h3>{{ door.kind === 'MAIN_ENTRANCE' ? 'Entrada principal' : 'Mi apartamento' }}</h3>
              <p class="muted small">{{ door.name }}</p>
              <button type="button" class="btn btn--lg btn--block" [disabled]="!door.available || busy()" (click)="unlock(door)">
                @if (opening() === door.kind) { <span class="spinner"></span> }
                {{ door.kind === 'MAIN_ENTRANCE' ? 'Abrir Entrada Principal' : 'Abrir Mi Habitación' }}
              </button>
              @if (!door.available && door.reason) { <p class="small muted">{{ reason(door.reason) }}</p> }
              @if (opened()?.kind === door.kind) {
                <p class="alert alert--success small" role="status">Puerta abierta a las {{ opened()!.at | date: 'HH:mm:ss' }}. Empuje para entrar.</p>
              }
            </section>
          }
        </div>
        @if (error()) { <div class="alert alert--danger" role="alert">{{ error() }}</div> }
        <p class="small muted">La apertura se envía a la cerradura por internet y puede tardar unos segundos.</p>
      </div>
    }
  `,
  styles: `
    .doors { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
    .door { text-align: center; }
    .door--off { opacity: 0.75; }
    .blockers { margin: 0; padding-left: 18px; }
  `,
})
export class GuestDoorsComponent {
  private readonly api = inject(GuestApiService);
  readonly checkedIn = output<void>();

  protected readonly doors = apiResource({ stream: () => this.api.doors() });
  protected readonly loadError = computed(() => problemMessage(this.doors.error()));
  protected readonly busy = signal(false);
  protected readonly opening = signal<DoorKind | null>(null);
  protected readonly opened = signal<{ kind: DoorKind; at: string } | null>(null);
  protected readonly error = signal<string | null>(null);

  protected blocker(code: string): string {
    return SELF_CHECKIN_BLOCKER[code] ?? code;
  }

  protected reason(code: string): string {
    return DOOR_REASON[code] ?? code;
  }

  protected async selfCheckIn(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      this.doors.set(await firstValueFrom(this.api.selfCheckIn()));
      this.checkedIn.emit();
    } catch (e) {
      this.error.set(problemMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async unlock(door: Door): Promise<void> {
    this.busy.set(true);
    this.opening.set(door.kind);
    this.error.set(null);
    this.opened.set(null);
    try {
      const result = await firstValueFrom(this.api.unlock(door.kind));
      this.opened.set({ kind: door.kind, at: result.openedAt });
    } catch (e) {
      this.error.set(problemMessage(e));
      this.doors.reload();
    } finally {
      this.busy.set(false);
      this.opening.set(null);
    }
  }
}
