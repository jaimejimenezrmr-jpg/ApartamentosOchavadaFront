import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/api/admin-api.service';
import { StaffUser, StaffUserWithTemporaryPassword, UserRole } from '../../core/api/models';
import { problemMessage } from '../../core/api/problem';
import { StaffSessionService } from '../../core/auth/staff-session.service';
import { ROLE } from '../../shared/labels';
import { apiResource } from '../../shared/ui/api-resource';
import { useAction } from '../../shared/ui/action';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog.component';
import { ToastService } from '../../shared/ui/toast.service';

type Draft = { id: string | null; email: string; fullName: string; phone: string; role: UserRole; enabled: boolean; version: number };

/**
 * Usuarios del backoffice (solo ADMIN). Las altas y los reseteos generan una contraseña temporal que se
 * muestra una única vez: hay que comunicarla al empleado, que la cambiará en su primer acceso.
 */
@Component({
  selector: 'app-users-page',
  imports: [DatePipe, FormsModule, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row row--between">
      <h1>Usuarios</h1>
      <button type="button" class="btn" (click)="startCreate()">Nuevo usuario</button>
    </div>
    <p class="muted small">
      <strong>Administración</strong>: todo, incluidos catálogo, usuarios y channel manager ·
      <strong>Recepción</strong>: reservas, rack, huéspedes, cobros, facturas, SES y cerraduras ·
      <strong>Limpieza</strong>: solo el tablero de limpieza.
    </p>

    @if (issued(); as i) {
      <section class="card temp" role="status">
        <h3>Contraseña temporal de {{ i.user.fullName }}</h3>
        <p>Entréguesela por un canal seguro (en persona o por teléfono). <strong>No se volverá a mostrar.</strong>
          Al entrar en {{ origin }}/backoffice con <strong>{{ i.user.email }}</strong> se le pedirá que elija la suya.</p>
        <div class="row">
          <code class="temp__pwd">{{ i.temporaryPassword }}</code>
          <button type="button" class="btn btn--secondary btn--sm" (click)="copy(i.temporaryPassword)">Copiar</button>
          <button type="button" class="btn btn--ghost btn--sm" (click)="issued.set(null)">Hecho</button>
        </div>
      </section>
    }

    @if (draft(); as d) {
      <form class="card stack" (ngSubmit)="save(d)">
        <h3>{{ d.id ? 'Editar ' + d.fullName : 'Nuevo usuario' }}</h3>
        <div class="grid-3">
          <div class="field"><label for="us-email">Email *</label>
            <input id="us-email" type="email" name="email" [(ngModel)]="d.email" [disabled]="!!d.id" maxlength="254" required></div>
          <div class="field"><label for="us-name">Nombre completo *</label>
            <input id="us-name" name="name" [(ngModel)]="d.fullName" maxlength="150" required></div>
          <div class="field"><label for="us-phone">Teléfono</label>
            <input id="us-phone" type="tel" name="phone" [(ngModel)]="d.phone" maxlength="30"></div>
          <div class="field"><label for="us-role">Perfil *</label>
            <select id="us-role" name="role" [(ngModel)]="d.role" [disabled]="d.id === myId()">
              @for (r of roles; track r) { <option [value]="r">{{ roleLabel[r] }}</option> }
            </select></div>
        </div>
        @if (d.id) {
          <label class="check"><input type="checkbox" name="enabled" [(ngModel)]="d.enabled" [disabled]="d.id === myId()">
            Activo (desactivarlo cierra sus sesiones al instante e impide volver a entrar)</label>
        } @else {
          <p class="small muted">Se generará una contraseña temporal que verá a continuación.</p>
        }
        <div class="row row--end">
          <button type="button" class="btn btn--secondary btn--sm" (click)="draft.set(null)">Cancelar</button>
          <button type="submit" class="btn btn--sm" [disabled]="action.busy() || !d.email.trim() || !d.fullName.trim()">
            {{ d.id ? 'Guardar' : 'Crear usuario' }}</button>
        </div>
      </form>
    }

    @if (users.error()) {
      <div class="alert alert--danger">{{ error() }}</div>
    } @else {
      <section class="card table-wrap">
        <table class="table">
          <thead><tr><th>Nombre</th><th>Email</th><th>Perfil</th><th>Estado</th><th>Último acceso</th><th></th></tr></thead>
          <tbody>
            @for (u of users.data() ?? []; track u.id) {
              <tr [class.is-off]="!u.enabled">
                <td><strong>{{ u.fullName }}</strong>@if (u.id === myId()) { <span class="small muted"> (usted)</span> }
                  @if (u.phone) { <br><span class="small muted">{{ u.phone }}</span> }</td>
                <td>{{ u.email }}</td>
                <td>{{ roleLabel[u.role] }}</td>
                <td class="badges">
                  @if (!u.enabled) { <span class="badge badge--danger">Desactivado</span> }
                  @else if (u.locked) { <span class="badge badge--warning">Bloqueado hasta las {{ u.lockedUntil | date: 'HH:mm' }}</span> }
                  @else if (u.passwordChangeRequired) { <span class="badge badge--info">Pendiente de primer acceso</span> }
                  @else { <span class="badge badge--success">Activo</span> }
                </td>
                <td class="small">{{ u.lastLoginAt ? (u.lastLoginAt | date: 'd MMM y, HH:mm') : 'Nunca' }}</td>
                <td class="right nowrap">
                  <button type="button" class="btn btn--ghost btn--sm" (click)="startEdit(u)">Editar</button>
                  @if (u.locked) { <button type="button" class="btn btn--ghost btn--sm" (click)="unlock(u)">Desbloquear</button> }
                  @if (u.id !== myId() && u.enabled) {
                    <button type="button" class="btn btn--ghost btn--sm" (click)="ask('reset', u)">Resetear contraseña</button>
                    <button type="button" class="btn btn--ghost btn--sm" (click)="ask('revoke', u)">Cerrar sesiones</button>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="empty">@if (users.isLoading()) { Cargando… } @else { No hay usuarios. }</td></tr>
            }
          </tbody>
        </table>
      </section>
    }

    <app-confirm-dialog #confirm [title]="confirmTitle()" [message]="confirmMessage()" [confirmLabel]="confirmLabel()"
                        [danger]="true" (confirmed)="runPending()" />
  `,
  styles: `
    .temp { border-color: var(--c-accent); background: #fffaf0; margin-bottom: 16px; }
    .temp__pwd { font-size: 1.25rem; padding: 6px 12px; background: var(--c-surface); border: 1px dashed var(--c-accent);
      border-radius: var(--radius-sm); letter-spacing: 0.04em; user-select: all; }
    tr.is-off td { color: var(--c-text-muted); }
    .badges .badge { white-space: normal; }
  `,
})
export class UsersPage {
  private readonly api = inject(AdminApiService);
  private readonly session = inject(StaffSessionService);
  private readonly toast = inject(ToastService);
  protected readonly action = useAction();
  private readonly confirmDialog = viewChild.required<ConfirmDialogComponent>('confirm');

  protected readonly roleLabel = ROLE;
  protected readonly roles: UserRole[] = ['RECEPTIONIST', 'HOUSEKEEPING', 'ADMIN'];
  protected readonly origin = typeof location !== 'undefined' ? location.origin : '';
  protected readonly myId = computed(() => this.session.user()?.id ?? null);

  protected readonly users = apiResource({ stream: () => this.api.users() });
  protected readonly error = computed(() => problemMessage(this.users.error()));
  protected readonly draft = signal<Draft | null>(null);
  protected readonly issued = signal<StaffUserWithTemporaryPassword | null>(null);

  private readonly pending = signal<{ kind: 'reset' | 'revoke'; user: StaffUser } | null>(null);
  protected readonly confirmTitle = computed(() =>
    this.pending()?.kind === 'reset' ? `Resetear la contraseña de ${this.pending()?.user.fullName}` : `Cerrar las sesiones de ${this.pending()?.user.fullName}`);
  protected readonly confirmMessage = computed(() =>
    this.pending()?.kind === 'reset'
      ? 'Se generará una contraseña temporal nueva y se cerrarán todas sus sesiones. La actual dejará de funcionar.'
      : 'Tendrá que volver a iniciar sesión en todos sus dispositivos (útil si ha perdido el móvil).');
  protected readonly confirmLabel = computed(() => (this.pending()?.kind === 'reset' ? 'Resetear' : 'Cerrar sesiones'));

  protected startCreate(): void {
    this.issued.set(null);
    this.draft.set({ id: null, email: '', fullName: '', phone: '', role: 'RECEPTIONIST', enabled: true, version: 0 });
  }

  protected startEdit(u: StaffUser): void {
    this.draft.set({ id: u.id, email: u.email, fullName: u.fullName, phone: u.phone ?? '', role: u.role, enabled: u.enabled, version: u.version });
  }

  protected async save(d: Draft): Promise<void> {
    if (d.id) {
      const updated = await this.action.run(() => this.api.updateUser(d.id!, {
        fullName: d.fullName.trim(), phone: d.phone.trim() || null, role: d.role, enabled: d.enabled, version: d.version,
      }), 'Usuario guardado');
      if (updated) {
        this.draft.set(null);
        this.users.reload();
      }
      return;
    }
    const created = await this.action.run(() => this.api.createUser({
      email: d.email.trim(), fullName: d.fullName.trim(), phone: d.phone.trim() || null, role: d.role,
    }), 'Usuario creado');
    if (created) {
      this.draft.set(null);
      this.issued.set(created);
      this.users.reload();
    }
  }

  protected async unlock(u: StaffUser): Promise<void> {
    if (await this.action.run(() => this.api.unlockUser(u.id), `${u.fullName} desbloqueado`)) this.users.reload();
  }

  protected ask(kind: 'reset' | 'revoke', user: StaffUser): void {
    this.pending.set({ kind, user });
    this.confirmDialog().open();
  }

  protected async runPending(): Promise<void> {
    const p = this.pending();
    this.pending.set(null);
    if (!p) return;
    if (p.kind === 'reset') {
      const result = await this.action.run(() => this.api.resetUserPassword(p.user.id), 'Contraseña reseteada');
      if (result) this.issued.set(result);
    } else {
      await this.action.run(() => this.api.revokeUserSessions(p.user.id), 'Sesiones cerradas');
    }
    this.users.reload();
  }

  protected async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.toast.success('Copiada al portapapeles');
    } catch {
      this.toast.info('Selecciónela y cópiela manualmente');
    }
  }
}
