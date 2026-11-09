import { apiResource } from '../../shared/ui/api-resource';
import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, RESPONSE_INIT, computed, effect, inject, input, signal } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { AMENITY_CATEGORY } from '../../shared/labels';
import { Amenity, AmenityCategory } from '../../core/api/models';
import { PublicApiService } from '../../core/api/public-api.service';
import { problemMessage } from '../../core/api/problem';
import { SiteConfigService } from '../../core/config/site-config.service';
import { SearchFormComponent } from '../shared/search-form.component';

@Component({
  selector: 'app-room-detail-page',
  imports: [CurrencyPipe, RouterLink, SearchFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container page">
      @if (room.isLoading()) {
        <div class="loading"><span class="spinner" aria-label="Cargando"></span></div>
      } @else if (notFound()) {
        <h1>Apartamento no encontrado</h1>
        <p>El apartamento que busca ya no está disponible. <a routerLink="/">Ver todos los apartamentos</a>.</p>
      } @else if (room.error()) {
        <p class="alert alert--danger">{{ error() }}</p>
      } @else if (room.data(); as r) {
        <nav class="small" aria-label="Migas de pan"><a routerLink="/">Inicio</a> › {{ r.name }}</nav>
        <h1>{{ r.name }}</h1>
        @if (r.shortDescription) { <p class="lead muted">{{ r.shortDescription }}</p> }

        @if (r.photos.length) {
          <div class="gallery">
            <img class="gallery__main" [src]="r.photos[activePhoto()].url" [alt]="r.photos[activePhoto()].altText"
                 width="1200" height="760">
            @if (r.photos.length > 1) {
              <div class="gallery__thumbs" role="list">
                @for (p of r.photos; track p.id; let i = $index) {
                  <button type="button" role="listitem" class="thumb" [class.is-active]="i === activePhoto()"
                          (click)="activePhoto.set(i)" [attr.aria-label]="'Ver foto: ' + p.altText">
                    <img [src]="p.url" [alt]="" loading="lazy" width="120" height="80">
                  </button>
                }
              </div>
            }
          </div>
        }

        <div class="layout">
          <div>
            <ul class="facts">
              <li><strong>{{ r.maxOccupancy }}</strong> personas como máximo ({{ r.maxAdults }} adultos, {{ r.maxChildren }} niños)</li>
              <li><strong>{{ r.bedrooms }}</strong> {{ r.bedrooms === 1 ? 'dormitorio' : 'dormitorios' }} · <strong>{{ r.bathrooms }}</strong> {{ r.bathrooms === 1 ? 'baño' : 'baños' }}</li>
              @if (r.bedsDescription) { <li>{{ r.bedsDescription }}</li> }
              @if (r.sizeM2) { <li>{{ r.sizeM2 }} m²</li> }
            </ul>
            @if (r.description) {
              <div class="description">
                @for (paragraph of paragraphs(); track $index) { <p>{{ paragraph }}</p> }
              </div>
            }
            @if (r.amenities.length) {
              <h2>Equipamiento</h2>
              <div class="amenities">
                @for (group of amenityGroups(); track group.category) {
                  <div>
                    <h4>{{ categoryLabel[group.category] }}</h4>
                    <ul>
                      @for (a of group.items; track a.id) { <li>{{ a.name }}</li> }
                    </ul>
                  </div>
                }
              </div>
            }
          </div>
          <aside class="card booking">
            <p class="booking__price">desde <strong>{{ r.fromPrice | currency: r.currency }}</strong> / noche</p>
            <p class="small muted">Entrada desde las {{ site.config().checkInTime }} · salida hasta las {{ site.config().checkOutTime }}</p>
            <app-search-form [compact]="true" />
          </aside>
        </div>
      }
    </div>
  `,
  styles: `
    .page { padding-top: 24px; }
    .lead { font-size: 1.08rem; max-width: 760px; }
    .gallery { margin: 20px 0 28px; }
    .gallery__main { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: var(--radius); }
    .gallery__thumbs { display: flex; gap: 8px; margin-top: 8px; overflow-x: auto; }
    .thumb { padding: 0; border: 2px solid transparent; border-radius: var(--radius-sm); background: none; cursor: pointer; flex: 0 0 auto; }
    .thumb.is-active { border-color: var(--c-brand); }
    .thumb img { width: 96px; height: 64px; object-fit: cover; border-radius: 4px; }
    .layout { display: grid; gap: 32px; grid-template-columns: minmax(0, 1fr) 380px; align-items: start; }
    .facts { list-style: none; padding: 0; margin: 0 0 20px; display: grid; gap: 6px; }
    .description { margin-bottom: 24px; }
    .amenities { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
    .amenities ul { padding-left: 18px; margin: 0; color: var(--c-text-muted); }
    .booking { position: sticky; top: 84px; }
    .booking__price strong { font-size: 1.4rem; color: var(--c-brand); }
    .booking ::ng-deep .search { grid-template-columns: 1fr 1fr; box-shadow: none; padding: 0; }
    .booking ::ng-deep .search__submit { grid-column: 1 / -1; }
    @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } .booking { position: static; } }
  `,
})
export class RoomDetailPage {
  private readonly api = inject(PublicApiService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly isServer = isPlatformServer(inject(PLATFORM_ID));
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });
  protected readonly site = inject(SiteConfigService);
  protected readonly categoryLabel = AMENITY_CATEGORY;

  readonly slug = input.required<string>();
  protected readonly activePhoto = signal(0);
  protected readonly room = apiResource({ params: () => this.slug(), stream: ({ params }) => this.api.roomType(params) });

  protected readonly notFound = computed(() => {
    const e = this.room.error();
    return e instanceof HttpErrorResponse && e.status === 404;
  });
  protected readonly error = computed(() => problemMessage(this.room.error()));
  protected readonly paragraphs = computed(() =>
    (this.room.data()?.description ?? '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
  );
  protected readonly amenityGroups = computed(() => {
    const groups = new Map<AmenityCategory, Amenity[]>();
    for (const a of this.room.data()?.amenities ?? []) {
      groups.set(a.category, [...(groups.get(a.category) ?? []), a]);
    }
    return [...groups.entries()].map(([category, items]) => ({ category, items }));
  });

  constructor() {
    effect(() => {
      const r = this.room.data();
      if (r) {
        this.activePhoto.set(0);
        this.title.setTitle(`${r.name} · ${this.site.config().propertyName}`);
        this.meta.updateTag({ name: 'description', content: r.shortDescription ?? `${r.name} junto a la Plaza Octogonal de Aguilar de la Frontera (Córdoba).` });
        if (r.photos[0]) {
          this.meta.updateTag({ property: 'og:image', content: r.photos[0].url });
        }
      }
      if (this.notFound() && this.isServer && this.responseInit) {
        // Los buscadores deben ver un 404 real, no una página vacía con 200.
        this.responseInit.status = 404;
      }
    });
  }
}
