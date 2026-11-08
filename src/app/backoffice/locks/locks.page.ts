import { apiResource } from '../../shared/ui/api-resource';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { AdminApiService } from '../../core/api/admin-api.service';
import { BackofficeApiService } from '../../core/api/backoffice-api.service';
import { LockRequest, LockResponse, LockType, ProviderLock } from '../../core/api/models';
import { StaffSessionService } from '../../core/auth/staff-session.service';
import { addDays, startOfDayInstant, todayInProperty } from '../../core/util/dates';
import { LOCK_TYPE } from '../../shared/labels';
import { useAction } from '../../shared/ui/action';

/** Cerraduras TTLock: apertura remota por el personal, auditoría y (ADMIN) alta y vinculación. */
@Component({
  selector: 'app-locks-page',
  imports: [DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row row--between">
      <h1>Cerraduras</h1>
      @if (isAdmin()) {
        <div class="row">
          <button type="button" class="btn btn--secondary btn--sm" [disabled]="action.busy()" (click)="sync()">Sincronizar batería</button>
          <button type="button" class="btn btn--sm" (click)="startCreate()">Añadir cerradura</button>
        </div>
      }
    </div>

    <section class="card table-wrap">
      <table class="table">
        <thead><tr><th>Nombre</th><th>Tipo</th><th>Unidad</th><th>Batería</th><th>Pasarela</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          @for (l of locks.data() ?? []; track l.id) {
            <tr>
              <td><strong>{{ l.name }}</strong><br><span class="small muted mono">TTLock {{ l.externalLockId }}</span></td>
              <td>{{ typeLabel[l.lockType] }}</td>
              <td>{{ l.roomNumber ?? '—' }}</td>
              <td>@if (l.batteryLevel !== null) {
                <span class="badge" [class.badge--danger]="l.lowBattery" [class.badge--success]="!l.lowBattery">{{ l.batteryLevel }} %</span>
                <br><span class="small muted">{{ l.batteryUpdatedAt | date: 'd MMM HH:mm' }}</span> } @else { — }</td>
              <td>{{ l.hasGateway ? 'Sí' : 'No (sin apertura remota)' }}</td>
              <td>{{ l.active ? 'Activa' : 'Inactiva' }}</td>
              <td class="right nowrap">
                <button type="button" class="btn btn--sm" [disabled]="!l.active || !l.hasGateway || action.busy()" (click)="unlock(l)">Abrir</button>
                <button type="button" class="btn btn--ghost btn--sm" (click)="showLog(l)">Registro</button>
                @if (isAdmin()) { <button type="button" class="btn btn--ghost btn--sm" (click)="startEdit(l)">Editar</button> }
              </td>
            </tr>
          } @empty { <tr><td colspan="7" class="empty">@if (locks.isLoading()) { Cargando… } @else { No hay cerraduras registradas. }</td></tr> }
        </tbody>
      </table>
    </section>

    @if (editing()) {
      <form class="card stack" (ngSubmit)="save()">
        <h3>{{ form.id ? 'Editar cerradura' : 'Nueva cerradura' }}</h3>
        @if (!form.id && (provider.data() ?? []).length) {
          <div class="field"><label for="lk-prov">Cerradura de la cuenta TTLock</label>
            <select id="lk-prov" name="prov" (change)="pickProvider($any($event.target).value)">
              <option value="">Elegir…</option>
              @for (p of provider.data() ?? []; track p.externalLockId) {
                <option [value]="p.externalLockId" [disabled]="p.registered">{{ p.name }} ({{ p.externalLockId }}){{ p.registered ? ' · ya registrada' : '' }}</option>
              }
            </select></div>
        }
        <div class="grid-3">
          <div class="field"><label for="lk-ext">ID TTLock *</label><input id="lk-ext" type="number" name="ext" [(ngModel)]="form.externalLockId" required></div>
          <div class="field"><label for="lk-name">Nombre *</label><input id="lk-name" name="name" [(ngModel)]="form.name" maxlength="100" required></div>
          <div class="field"><label for="lk-type">Tipo</label>
            <select id="lk-type" name="type" [(ngModel)]="form.lockType">
              @for (t of lockTypes; track t) { <option [value]="t">{{ typeLabel[t] }}</option> }
            </select></div>
          @if (form.lockType === 'ROOM') {
            <div class="field"><label for="lk-room">Unidad *</label>
              <select id="lk-room" name="room" [(ngModel)]="form.roomId">
                <option [ngValue]="null">—</option>
                @for (r of rooms.data() ?? []; track r.id) { <option [value]="r.id">{{ r.number }} · {{ r.roomTypeName }}</option> }
              </select></div>
          }
          <div class="field"><label for="lk-mac">MAC</label><input id="lk-mac" name="mac" [(ngModel)]="form.lockMac" placeholder="AA:BB:CC:DD:EE:FF"></div>
          <div class="field"><label for="lk-gw">ID de pasarela</label><input id="lk-gw" type="number" name="gw" [(ngModel)]="form.gatewayId"></div>
        </div>
        <div class="row">
          <label class="check"><input type="checkbox" name="hg" [(ngModel)]="form.hasGateway"> Conectada a pasarela Wi-Fi (apertura remota)</label>
          <label class="check"><input type="checkbox" name="ac" [(ngModel)]="form.active"> Activa</label>
        </div>
        <div class="row row--end">
          @if (form.id) { <button type="button" class="btn btn--ghost btn--sm" (click)="remove()">Eliminar</button> }
          <button type="button" class="btn btn--secondary btn--sm" (click)="editing.set(false)">Descartar</button>
          <button type="submit" class="btn btn--sm" [disabled]="action.busy()">Guardar</button>
        </div>
      </form>
    }

    @if (logLock(); as l) {
      <section class="card">
        <div class="card__title"><h3>Registro de {{ l.name }} (últimos 7 días)</h3>
          <button type="button" class="btn btn--ghost btn--sm" (click)="logLock.set(null)">Cerrar</button></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Fecha</th><th>Quién</th><th>Resultado</th><th>Detalle</th><th>Latencia</th></tr></thead>
            <tbody>
              @for (a of log.data()?.content ?? []; track a.id) {
                <tr>
                  <td class="nowrap">{{ a.occurredAt | date: 'd MMM HH:mm:ss' }}</td>
                  <td>{{ a.actorType === 'GUEST' ? 'Huésped' : a.actorType === 'STAFF' ? 'Personal' : 'Sistema' }}</td>
                  <td><span class="badge" [class.badge--success]="a.result === 'SUCCESS'" [class.badge--danger]="a.result !== 'SUCCESS'">{{ a.result }}</span></td>
                  <td class="small">{{ a.denialReason ?? a.providerMessage ?? '' }}</td>
                  <td class="small">{{ a.latencyMs !== null ? a.latencyMs + ' ms' : '' }}</td>
                </tr>
              } @empty { <tr><td colspan="5" class="empty">Sin registros.</td></tr> }
            </tbody>
          </table>
        </div>
      </section>
    }
  `,
})
export class LocksPage {
  private readonly api = inject(BackofficeApiService);
  private readonly admin = inject(AdminApiService);
  private readonly session = inject(StaffSessionService);
  protected readonly action = useAction();
  protected readonly typeLabel = LOCK_TYPE;
  protected readonly lockTypes: LockType[] = ['MAIN_ENTRANCE', 'ROOM', 'COMMON_AREA'];

  protected readonly isAdmin = computed(() => {
    this.session.user();
    return this.session.hasRole('ADMIN');
  });
  protected readonly locks = apiResource({ stream: () => this.api.locks() });
  protected readonly rooms = apiResource({ stream: () => this.api.rooms() });
  protected readonly editing = signal(false);
  protected readonly provider = apiResource({
    params: () => (this.editing() && this.isAdmin() ? true : undefined),
    stream: () => this.admin.providerLocks(),
  });
  protected readonly logLock = signal<LockResponse | null>(null);
  protected readonly log = apiResource({
    params: () => this.logLock()?.id,
    stream: ({ params }) => {
      const today = todayInProperty();
      return params
        ? this.api.lockAccessLog(params, startOfDayInstant(addDays(today, -7)), startOfDayInstant(addDays(today, 1)))
        : of(null);
    },
  });

  protected form = this.emptyForm();

  protected async unlock(l: LockResponse): Promise<void> {
    await this.action.run(() => this.api.unlockLock(l.id), `${l.name}: abierta`);
  }

  protected showLog(l: LockResponse): void {
    this.logLock.set(l);
  }

  protected async sync(): Promise<void> {
    const r = await this.action.run(() => this.admin.syncLocks(), (x) => `${x.updated} actualizadas, ${x.failed} con error`);
    if (r) this.locks.reload();
  }

  protected startCreate(): void {
    this.form = this.emptyForm();
    this.editing.set(true);
  }

  protected startEdit(l: LockResponse): void {
    this.form = {
      id: l.id, version: l.version, externalLockId: l.externalLockId, name: l.name, lockType: l.lockType, roomId: l.roomId,
      lockMac: l.lockMac ?? '', gatewayId: l.gatewayId, hasGateway: l.hasGateway, active: l.active,
    };
    this.editing.set(true);
  }

  protected pickProvider(id: string): void {
    const p: ProviderLock | undefined = (this.provider.data() ?? []).find((x) => String(x.externalLockId) === id);
    if (!p) return;
    this.form = { ...this.form, externalLockId: p.externalLockId, name: p.name, lockMac: p.lockMac ?? '', hasGateway: p.hasGateway };
  }

  protected async save(): Promise<void> {
    const f = this.form;
    const request: LockRequest = {
      externalLockId: Number(f.externalLockId),
      name: f.name.trim(),
      lockType: f.lockType,
      roomId: f.lockType === 'ROOM' ? f.roomId : null,
      lockMac: f.lockMac.trim() || null,
      gatewayId: f.gatewayId === null || (f.gatewayId as unknown) === '' ? null : Number(f.gatewayId),
      hasGateway: f.hasGateway,
      active: f.active,
      version: f.id ? f.version : null,
    };
    const result = await this.action.run(
      () => (f.id ? this.admin.updateLock(f.id, request) : this.admin.createLock(request)), 'Cerradura guardada');
    if (result) {
      this.editing.set(false);
      this.locks.reload();
    }
  }

  protected async remove(): Promise<void> {
    if (!this.form.id) return;
    if (await this.action.runOk(() => this.admin.deleteLock(this.form.id), 'Cerradura eliminada')) {
      this.editing.set(false);
      this.locks.reload();
    }
  }

  private emptyForm() {
    return {
      id: '' as string, version: 0, externalLockId: null as number | null, name: '', lockType: 'ROOM' as LockType,
      roomId: null as string | null, lockMac: '', gatewayId: null as number | null, hasGateway: true, active: true,
    };
  }
}
