import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicRoomTypeSummary } from '../../core/api/models';

@Component({
  selector: 'app-room-card',
  imports: [RouterLink, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="room">
      <a [routerLink]="['/apartamentos', room().slug]" class="room__media" tabindex="-1" aria-hidden="true">
        @if (room().coverPhoto; as photo) {
          <img [src]="photo.url" [alt]="photo.altText" loading="lazy" width="640" height="420">
        } @else {
          <div class="room__placeholder">{{ room().name }}</div>
        }
      </a>
      <div class="room__body">
        <h3><a [routerLink]="['/apartamentos', room().slug]">{{ room().name }}</a></h3>
        @if (room().shortDescription) { <p class="muted">{{ room().shortDescription }}</p> }
        <ul class="room__facts small">
          <li>Hasta {{ room().maxOccupancy }} personas</li>
          <li>{{ room().bedrooms }} {{ room().bedrooms === 1 ? 'dormitorio' : 'dormitorios' }}</li>
          <li>{{ room().bathrooms }} {{ room().bathrooms === 1 ? 'baño' : 'baños' }}</li>
          @if (room().sizeM2) { <li>{{ room().sizeM2 }} m²</li> }
        </ul>
        <p class="room__price">desde <strong>{{ room().fromPrice | currency: room().currency }}</strong> / noche</p>
      </div>
    </article>
  `,
  styles: `
    .room { background: var(--c-surface); border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow);
      display: flex; flex-direction: column; height: 100%; }
    .room__media img, .room__placeholder { aspect-ratio: 16 / 10; width: 100%; object-fit: cover; }
    .room__placeholder { display: grid; place-items: center; background: var(--c-brand-soft); color: var(--c-brand);
      font: 600 1.2rem var(--font-display); }
    .room__body { padding: 16px 18px 18px; display: flex; flex-direction: column; flex: 1; }
    .room__body h3 a { color: var(--c-text); text-decoration: none; }
    .room__facts { list-style: none; padding: 0; margin: 0 0 12px; display: flex; flex-wrap: wrap; gap: 4px 14px; color: var(--c-text-muted); }
    .room__price { margin: auto 0 0; }
    .room__price strong { font-size: 1.15rem; color: var(--c-brand); }
  `,
})
export class RoomCardComponent {
  readonly room = input.required<PublicRoomTypeSummary>();
}
