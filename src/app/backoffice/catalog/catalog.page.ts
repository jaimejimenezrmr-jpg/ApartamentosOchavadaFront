import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { AmenitiesComponent } from './amenities.component';
import { RatePlansComponent } from './rate-plans.component';
import { RoomTypesComponent } from './room-types.component';
import { RoomsComponent } from './rooms.component';

type Tab = 'types' | 'rooms' | 'plans' | 'amenities';

@Component({
  selector: 'app-catalog-page',
  imports: [RoomTypesComponent, RoomsComponent, RatePlansComponent, AmenitiesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Catálogo</h1>
    <nav class="tabs">
      <button type="button" [class.is-active]="tab() === 'types'" (click)="tab.set('types')">Tipologías</button>
      <button type="button" [class.is-active]="tab() === 'rooms'" (click)="tab.set('rooms')">Unidades</button>
      <button type="button" [class.is-active]="tab() === 'plans'" (click)="tab.set('plans')">Planes de tarifa</button>
      <button type="button" [class.is-active]="tab() === 'amenities'" (click)="tab.set('amenities')">Servicios</button>
    </nav>
    @switch (tab()) {
      @case ('types') { <app-room-types /> }
      @case ('rooms') { <app-rooms /> }
      @case ('plans') { <app-rate-plans /> }
      @case ('amenities') { <app-amenities /> }
    }
  `,
})
export class CatalogPage {
  protected readonly tab = signal<Tab>('types');
}
