import { apiResource } from '../../shared/ui/api-resource';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { PublicApiService } from '../../core/api/public-api.service';
import { problemMessage } from '../../core/api/problem';
import { SiteConfigService } from '../../core/config/site-config.service';
import { RoomCardComponent } from '../shared/room-card.component';
import { SearchFormComponent } from '../shared/search-form.component';

@Component({
  selector: 'app-home-page',
  imports: [SearchFormComponent, RoomCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero">
      <div class="container hero__inner">
        <p class="hero__eyebrow">Aguilar de la Frontera · Córdoba</p>
        <h1>Apartamentos junto a la Plaza Ochavada</h1>
        <p class="hero__lead">
          Apartamentos turísticos a un paso de la Plaza Ochavada, una de las pocas plazas octogonales de España, en el
          corazón de la Campiña cordobesa. Reserve directamente con nosotros: mejor precio, sin comisiones y con acceso
          digital a su apartamento.
        </p>
        <app-search-form />
      </div>
    </section>

    <section class="container section" id="apartamentos" aria-labelledby="apartamentos-titulo">
      <h2 id="apartamentos-titulo">Nuestros apartamentos</h2>
      @if (rooms.isLoading()) {
        <div class="loading"><span class="spinner" aria-label="Cargando"></span></div>
      } @else if (rooms.error()) {
        <p class="alert alert--danger">{{ errorMessage() }}</p>
      } @else if (rooms.data()?.length) {
        <div class="rooms">
          @for (room of rooms.data(); track room.slug) {
            <app-room-card [room]="room" />
          }
        </div>
      } @else {
        <p class="empty">Muy pronto publicaremos nuestros apartamentos.</p>
      }
    </section>

    <section class="container section" id="entorno" aria-labelledby="entorno-titulo">
      <div class="place">
        <div>
          <h2 id="entorno-titulo">La Plaza Ochavada</h2>
          <p>
            Oficialmente Plaza de San José, todo el mundo la conoce como <strong>la Ochavada</strong> por su planta de ocho
            lados. Proyectada en 1806 con trazado neoclásico, es uno de los escasos ejemplos de plaza octogonal que existen
            en España y el corazón de la vida de Aguilar de la Frontera: en ella se encuentra el Ayuntamiento y en sus
            calles cercanas, nuestros apartamentos.
          </p>
          <p class="muted">{{ site.config().address }}</p>
        </div>
        <ul class="sights">
          <li>
            <h3>Torre del Reloj</h3>
            <p class="muted">Joya del barroco cordobés terminada en 1774 y declarada monumento histórico-artístico nacional.</p>
          </li>
          <li>
            <h3>Parroquia del Soterraño</h3>
            <p class="muted">Templo gótico-mudéjar del siglo XVI levantado junto al antiguo castillo, sobre una cueva que le da nombre.</p>
          </li>
          <li>
            <h3>Laguna de Zóñar</h3>
            <p class="muted">A unos 6 km, en la Reserva Natural de las Lagunas del Sur de Córdoba: ideal para pasear y observar aves.</p>
          </li>
        </ul>
      </div>
    </section>

    <section class="container section">
      <div class="perks">
        <div class="card card--flat">
          <h3>Reserva directa</h3>
          <p class="muted">El mejor precio disponible y condiciones claras, sin intermediarios.</p>
        </div>
        <div class="card card--flat">
          <h3>Llegada autónoma</h3>
          <p class="muted">Complete el registro de viajeros online y abra la puerta desde el móvil el día de llegada.</p>
        </div>
        <div class="card card--flat">
          <h3>En pleno centro</h3>
          <p class="muted">Junto a la Plaza Ochavada y la Torre del Reloj, cerca de la parroquia del Soterraño y a unos
            minutos en coche de la Laguna de Zóñar.</p>
        </div>
      </div>
    </section>
  `,
  styles: `
    .hero { background: linear-gradient(160deg, var(--c-brand-strong), var(--c-brand) 55%, #9c5a3c); color: #fff; padding: 64px 0 72px; }
    .hero__inner { display: flex; flex-direction: column; gap: 14px; }
    .hero__eyebrow { text-transform: uppercase; letter-spacing: 0.14em; font-size: 0.8rem; margin: 0; opacity: 0.85; }
    .hero h1 { max-width: 760px; margin: 0; }
    .hero__lead { max-width: 640px; font-size: 1.06rem; opacity: 0.92; margin-bottom: 12px; }
    .hero app-search-form { color: var(--c-text); }
    .section { padding-top: 48px; }
    .rooms { display: grid; gap: 22px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
    .place { display: grid; gap: 32px; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); align-items: start; }
    .sights { list-style: none; padding: 0; margin: 0; display: grid; gap: 14px; }
    .sights li { border-left: 3px solid var(--c-accent); padding-left: 14px; }
    .sights h3 { margin-bottom: 2px; }
    .sights p { margin: 0; }
    @media (max-width: 860px) { .place { grid-template-columns: 1fr; } }
    .perks { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
  `,
})
export class HomePage {
  private readonly api = inject(PublicApiService);
  protected readonly site = inject(SiteConfigService);
  protected readonly rooms = apiResource({ stream: () => this.api.roomTypes() });

  constructor() {
    const site = this.site.config();
    inject(Title).setTitle(`${site.propertyName} · Apartamentos turísticos en Aguilar de la Frontera`);
    inject(Meta).updateTag({
      name: 'description',
      content: 'Apartamentos turísticos junto a la Plaza Ochavada de Aguilar de la Frontera (Córdoba). Reserva directa, llegada autónoma y el mejor precio.',
    });
  }

  protected errorMessage(): string {
    return problemMessage(this.rooms.error());
  }
}
