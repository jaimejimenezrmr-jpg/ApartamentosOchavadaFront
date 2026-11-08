import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { problemMessage } from '../../core/api/problem';
import { StaffSessionService } from '../../core/auth/staff-session.service';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="wrap">
      <form class="card stack login" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <h1>Acceso del personal</h1>
        <div class="field">
          <label for="lg-email">Email</label>
          <input id="lg-email" type="email" formControlName="email" autocomplete="username" required>
        </div>
        <div class="field">
          <label for="lg-pass">Contraseña</label>
          <input id="lg-pass" type="password" formControlName="password" autocomplete="current-password" required>
        </div>
        @if (error()) { <div class="alert alert--danger" role="alert">{{ error() }}</div> }
        <button type="submit" class="btn btn--lg" [disabled]="busy() || form.invalid">
          @if (busy()) { <span class="spinner"></span> } Entrar
        </button>
        <p class="small muted">Tras varios intentos fallidos la cuenta se bloquea temporalmente.</p>
      </form>
    </main>
  `,
  styles: `
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 16px; background: #2b211c; }
    .login { width: min(400px, 100%); }
  `,
})
export class LoginPage {
  private readonly session = inject(StaffSessionService);
  private readonly router = inject(Router);
  readonly returnUrl = input<string>();

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const { email, password } = this.form.getRawValue();
      await this.session.login(email.trim(), password);
      const target = this.returnUrl();
      await this.router.navigateByUrl(target && target.startsWith('/backoffice') ? target : '/backoffice');
    } catch (e) {
      this.error.set(problemMessage(e));
      this.form.controls.password.reset();
    } finally {
      this.busy.set(false);
    }
  }
}
