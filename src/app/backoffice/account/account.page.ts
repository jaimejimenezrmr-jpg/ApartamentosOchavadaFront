import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { fieldErrors, problemMessage } from '../../core/api/problem';
import { StaffSessionService } from '../../core/auth/staff-session.service';
import { ROLE } from '../../shared/labels';
import { ToastService } from '../../shared/ui/toast.service';
import { passwordProblem } from './password-rules';

/** «Mi cuenta»: datos del usuario y cambio de contraseña (obligatorio si la actual es temporal). */
@Component({
  selector: 'app-account-page',
  imports: [ReactiveFormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Mi cuenta</h1>
    @if (user(); as u) {
      @if (u.passwordChangeRequired) {
        <div class="alert alert--warning">
          Está usando una contraseña temporal. Elija una contraseña propia para empezar a usar el backoffice.
        </div>
      }
      <div class="cols">
        <section class="card">
          <h3>Datos</h3>
          <dl class="kv">
            <dt>Nombre</dt><dd>{{ u.fullName }}</dd>
            <dt>Email</dt><dd>{{ u.email }}</dd>
            @if (u.phone) { <dt>Teléfono</dt><dd>{{ u.phone }}</dd> }
            <dt>Perfil</dt><dd>{{ roleLabel[u.role] }}</dd>
            @if (u.lastLoginAt) { <dt>Último acceso</dt><dd>{{ u.lastLoginAt | date: 'd MMM y, HH:mm' }}</dd> }
            @if (u.passwordChangedAt && !u.passwordChangeRequired) {
              <dt>Contraseña cambiada</dt><dd>{{ u.passwordChangedAt | date: 'd MMM y' }}</dd>
            }
          </dl>
          <p class="small muted">Para cambiar su nombre, email o perfil, pídalo a la administración.</p>
        </section>

        <form class="card stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <h3>{{ u.passwordChangeRequired ? 'Elegir contraseña' : 'Cambiar contraseña' }}</h3>
          <div class="field">
            <label for="ac-cur">{{ u.passwordChangeRequired ? 'Contraseña temporal' : 'Contraseña actual' }}</label>
            <input id="ac-cur" type="password" formControlName="currentPassword" autocomplete="current-password">
            @if (errors()['currentPassword']) { <span class="field__error">{{ errors()['currentPassword'] }}</span> }
          </div>
          <div class="field">
            <label for="ac-new">Nueva contraseña</label>
            <input id="ac-new" type="password" formControlName="newPassword" autocomplete="new-password">
            <span class="field__hint">Entre 12 y 64 caracteres. Mejor una frase fácil de recordar que una palabra con símbolos.</span>
            @if (newProblem()) { <span class="field__error">{{ newProblem() }}</span> }
            @if (errors()['newPassword']) { <span class="field__error">{{ errors()['newPassword'] }}</span> }
          </div>
          <div class="field">
            <label for="ac-rep">Repita la nueva contraseña</label>
            <input id="ac-rep" type="password" formControlName="repeat" autocomplete="new-password">
            @if (mismatch()) { <span class="field__error">No coincide</span> }
          </div>
          @if (error()) { <div class="alert alert--danger" role="alert">{{ error() }}</div> }
          <p class="small muted">Al cambiarla se cerrará la sesión en el resto de dispositivos.</p>
          <div class="row row--end">
            <button type="submit" class="btn" [disabled]="busy() || !canSubmit()">
              @if (busy()) { <span class="spinner"></span> } Guardar contraseña
            </button>
          </div>
        </form>
      </div>
    }
  `,
  styles: `
    .cols { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); align-items: start; }
    .cols .card + .card { margin-top: 0; }
    .alert { margin-bottom: 16px; }
  `,
})
export class AccountPage {
  private readonly session = inject(StaffSessionService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly roleLabel = ROLE;
  protected readonly user = this.session.user;

  protected readonly form = inject(NonNullableFormBuilder).group({
    currentPassword: ['', Validators.required],
    newPassword: ['', Validators.required],
    repeat: ['', Validators.required],
  });
  private readonly values = signal(this.form.getRawValue());
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errors = signal<Record<string, string>>({});

  protected readonly newProblem = computed(() => {
    const v = this.values().newPassword;
    return v ? passwordProblem(v, this.user()?.email ?? null) : null;
  });
  protected readonly mismatch = computed(() => !!this.values().repeat && this.values().repeat !== this.values().newPassword);
  protected readonly canSubmit = computed(() => {
    const v = this.values();
    return !!v.currentPassword && !!v.newPassword && !this.newProblem() && v.repeat === v.newPassword;
  });

  constructor() {
    this.form.valueChanges.subscribe(() => this.values.set(this.form.getRawValue()));
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    const wasTemporary = !!this.user()?.passwordChangeRequired;
    const { currentPassword, newPassword } = this.form.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    this.errors.set({});
    try {
      await this.session.changePassword(currentPassword, newPassword);
      this.form.reset();
      this.toast.success('Contraseña cambiada');
      if (wasTemporary) {
        await this.router.navigateByUrl('/backoffice');
      }
    } catch (e) {
      this.errors.set(fieldErrors(e));
      this.error.set(problemMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
