import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SiteConfigService } from '../../core/config/site-config.service';

@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip" href="#contenido">Saltar al contenido</a>
    <header class="header">
      @if (site.config().testMode) {
        <div class="test-banner" role="note">
          <div class="container">
            <strong>Web en pruebas.</strong> Los apartamentos todavía no están disponibles: las reservas que se hagan
            ahora no son reales y no se cobra nada.
          </div>
        </div>
      }
      <div class="container header__inner">
        <a routerLink="/" class="brand" aria-label="{{ site.config().propertyName }}, inicio">
          <span class="brand__mark" aria-hidden="true">O</span>
          <span class="brand__name">{{ site.config().propertyName }}</span>
        </a>
        <button type="button" class="menu-toggle" [attr.aria-expanded]="menuOpen()" aria-controls="nav-principal"
                (click)="menuOpen.set(!menuOpen())">
          <span class="sr-only">Menú</span>☰
        </button>
        <nav id="nav-principal" class="nav" [class.is-open]="menuOpen()" aria-label="Principal">
          <a routerLink="/" fragment="apartamentos" (click)="menuOpen.set(false)">Apartamentos</a>
          <a routerLink="/buscar" routerLinkActive="is-active" (click)="menuOpen.set(false)">Disponibilidad</a>
          <a routerLink="/mi-estancia" routerLinkActive="is-active" (click)="menuOpen.set(false)">Mi estancia</a>
          <a routerLink="/buscar" class="btn btn--sm" (click)="menuOpen.set(false)">Reservar</a>
        </nav>
      </div>
    </header>

    <main id="contenido">
      <router-outlet />
    </main>

    <footer class="footer">
      <div class="container footer__inner">
        <div>
          <strong>{{ site.config().propertyName }}</strong>
          <p class="muted">{{ site.config().address }}</p>
          @if (site.config().tourismRegistry) {
            <p class="muted small">Registro de Turismo de Andalucía: {{ site.config().tourismRegistry }}</p>
          }
        </div>
        <div class="stack small">
          @if (site.config().phone) {
            <a [href]="'tel:' + site.config().phone.replace(' ', '')">{{ site.config().phone }}</a>
          }
          @if (site.config().email) {
            <a [href]="'mailto:' + site.config().email">{{ site.config().email }}</a>
          }
          <span class="muted">Entrada desde las {{ site.config().checkInTime }} · Salida hasta las {{ site.config().checkOutTime }}</span>
        </div>
        <nav class="stack small" aria-label="Información legal">
          <a routerLink="/condiciones">Condiciones de reserva</a>
          <a routerLink="/privacidad">Privacidad</a>
          <a routerLink="/aviso-legal">Aviso legal</a>
        </nav>
      </div>
    </footer>
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 100vh; }
    main { flex: 1 0 auto; }
    .skip { position: absolute; left: -999px; top: 8px; background: #fff; padding: 8px 12px; z-index: 100; }
    .skip:focus { left: 8px; }
    .header { background: var(--c-surface); border-bottom: 1px solid var(--c-border); position: sticky; top: 0; z-index: 50; }
    .header__inner { display: flex; align-items: center; justify-content: space-between; min-height: 64px; gap: 16px; }
    .test-banner { background: #b45309; color: #fff; font-size: 0.92rem; line-height: 1.4; padding: 8px 0; text-align: center; }
    .test-banner strong { text-transform: uppercase; letter-spacing: 0.04em; margin-right: 4px; }
    .brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--c-text); }
    .brand__mark { width: 34px; height: 34px; border-radius: 50%; background: var(--c-brand); color: #fff;
      display: grid; place-items: center; font: 600 1.1rem var(--font-display); }
    .brand__name { font: 600 1.15rem var(--font-display); }
    .nav { display: flex; align-items: center; gap: 22px; }
    .nav a:not(.btn) { color: var(--c-text); text-decoration: none; font-weight: 500; }
    .nav a.is-active:not(.btn) { color: var(--c-brand); }
    .menu-toggle { display: none; background: none; border: 1px solid var(--c-border); border-radius: var(--radius-sm);
      width: 40px; height: 40px; font-size: 1.2rem; cursor: pointer; }
    .footer { margin-top: 56px; background: var(--c-surface-alt); border-top: 1px solid var(--c-border); padding: 32px 0; }
    .footer__inner { display: grid; gap: 24px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); overflow-wrap: anywhere; }
    @media (max-width: 760px) {
      .menu-toggle { display: block; }
      .test-banner { font-size: 0.82rem; padding: 6px 0; }
      .nav { display: none; position: absolute; top: 100%; left: 0; right: 0; flex-direction: column; align-items: stretch;
        background: var(--c-surface); border-bottom: 1px solid var(--c-border); padding: 12px 16px 16px; gap: 12px; }
      .nav.is-open { display: flex; }
    }
  `,
})
export class PublicLayoutComponent {
  protected readonly site = inject(SiteConfigService);
  protected readonly menuOpen = signal(false);

  constructor() {
    // Mientras la web está en pruebas, que los buscadores no la indexen.
    if (this.site.config().testMode) {
      inject(Meta).updateTag({ name: 'robots', content: 'noindex, nofollow' });
    }
  }
}
