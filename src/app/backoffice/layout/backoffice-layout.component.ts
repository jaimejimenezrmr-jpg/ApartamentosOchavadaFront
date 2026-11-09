import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { UserRole } from '../../core/api/models';
import { StaffSessionService } from '../../core/auth/staff-session.service';
import { ROLE } from '../../shared/labels';

interface NavItem {
  path: string;
  label: string;
  role: UserRole;
}

const NAV: NavItem[] = [
  { path: 'panel', label: 'Panel', role: 'RECEPTIONIST' },
  { path: 'rack', label: 'Rack', role: 'RECEPTIONIST' },
  { path: 'reservas', label: 'Reservas', role: 'RECEPTIONIST' },
  { path: 'huespedes', label: 'Huéspedes', role: 'RECEPTIONIST' },
  { path: 'limpieza', label: 'Limpieza', role: 'HOUSEKEEPING' },
  { path: 'incidencias', label: 'Incidencias', role: 'RECEPTIONIST' },
  { path: 'objetos-olvidados', label: 'Objetos olvidados', role: 'RECEPTIONIST' },
  { path: 'tarifas', label: 'Tarifas', role: 'RECEPTIONIST' },
  { path: 'facturas', label: 'Facturas', role: 'RECEPTIONIST' },
  { path: 'ses', label: 'SES.HOSPEDAJES', role: 'RECEPTIONIST' },
  { path: 'cerraduras', label: 'Cerraduras', role: 'RECEPTIONIST' },
  { path: 'catalogo', label: 'Catálogo', role: 'ADMIN' },
  { path: 'listas-limpieza', label: 'Listas de limpieza', role: 'ADMIN' },
  { path: 'canal', label: 'Channel manager', role: 'ADMIN' },
  { path: 'usuarios', label: 'Usuarios', role: 'ADMIN' },
];

@Component({
  selector: 'app-backoffice-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell" [class.is-open]="menuOpen()">
      <aside class="side no-print">
        <a routerLink="/backoffice" class="side__brand">Ochavada <span>PMS</span></a>
        <nav aria-label="Backoffice">
          @for (item of nav(); track item.path) {
            <a [routerLink]="item.path" routerLinkActive="is-active" (click)="menuOpen.set(false)">{{ item.label }}</a>
          }
        </nav>
        <div class="side__user">
          <a routerLink="cuenta" class="side__account"><strong>{{ session.user()?.fullName }}</strong></a>
          <span class="small">{{ roleLabel() }} · <a routerLink="cuenta">Mi cuenta</a></span>
          <button type="button" class="btn btn--secondary btn--sm" (click)="session.logout()">Cerrar sesión</button>
        </div>
      </aside>
      <div class="main">
        <header class="topbar no-print">
          <button type="button" class="btn btn--ghost btn--sm burger" (click)="menuOpen.set(!menuOpen())" aria-label="Menú">☰</button>
          @if (session.hasRole('RECEPTIONIST')) {
            <form class="quick" (submit)="$event.preventDefault(); findByCode(code.value); code.value = ''">
              <input #code type="search" placeholder="Ir a localizador…" aria-label="Buscar por localizador">
            </form>
            <a routerLink="reservas/nueva" class="btn btn--sm">Nueva reserva</a>
          }
        </header>
        <main class="content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: `
    .shell { display: grid; grid-template-columns: 220px minmax(0, 1fr); min-height: 100vh; }
    .side { background: #2b211c; color: #f4eee7; display: flex; flex-direction: column; padding: 18px 12px; gap: 18px;
      position: sticky; top: 0; height: 100vh; }
    .side__brand { color: #fff; text-decoration: none; font: 600 1.25rem var(--font-display); padding: 0 8px; }
    .side__brand span { color: var(--c-accent); }
    .side nav { display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
    .side nav a { color: #d9cfc4; text-decoration: none; padding: 8px 10px; border-radius: var(--radius-sm); font-weight: 500; }
    .side nav a:hover { background: rgba(255, 255, 255, 0.06); color: #fff; }
    .side nav a.is-active { background: var(--c-brand); color: #fff; }
    .side__user { margin-top: auto; display: flex; flex-direction: column; gap: 6px; padding: 0 8px; }
    .side__user span { color: #b9ab9e; }
    .side__user a { color: #f4eee7; }
    .side__account { text-decoration: none; }
    .topbar { display: flex; align-items: center; gap: 10px; padding: 10px 20px; background: var(--c-surface);
      border-bottom: 1px solid var(--c-border); position: sticky; top: 0; z-index: 20; }
    .quick { margin-left: auto; width: 220px; }
    .quick input { min-height: 32px; }
    .burger { display: none; }
    .content { padding: 20px; }
    .main { min-width: 0; }
    @media (max-width: 900px) {
      /* minmax(0, …): sin él, la barra superior ensancha la página más que la pantalla del móvil */
      .shell { grid-template-columns: minmax(0, 1fr); }
      .topbar { padding: 8px 14px; }
      .quick { width: auto; flex: 1 1 100px; min-width: 0; }
      .topbar .btn { flex: 0 0 auto; }
      .side { position: fixed; inset: 0 auto 0 0; width: 240px; z-index: 40; transform: translateX(-100%); transition: transform 0.2s; }
      .shell.is-open .side { transform: none; }
      .burger { display: inline-flex; }
      .content { padding: 14px; }
    }
  `,
})
export class BackofficeLayoutComponent {
  protected readonly session = inject(StaffSessionService);
  private readonly router = inject(Router);
  protected readonly menuOpen = signal(false);
  protected readonly nav = computed(() => {
    this.session.user();
    // Con contraseña temporal no se muestra el menú: solo puede ir a «Mi cuenta».
    if (this.session.user()?.passwordChangeRequired) return [];
    return NAV.filter((item) => this.session.hasRole(item.role));
  });
  protected readonly roleLabel = computed(() => {
    const role = this.session.user()?.role;
    return role ? ROLE[role] : '';
  });

  protected findByCode(code: string): void {
    const trimmed = code.trim().toUpperCase();
    if (trimmed) {
      void this.router.navigate(['/backoffice/reservas'], { queryParams: { q: trimmed } });
    }
  }
}
