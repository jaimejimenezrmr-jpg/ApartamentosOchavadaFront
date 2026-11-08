import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IsoDate } from '../../core/api/models';
import { addDays, isIsoDate, nightsBetween, todayInProperty } from '../../core/util/dates';

export const MAX_NIGHTS = 30;
export const MAX_GUESTS = 20;

/** Buscador de fechas y ocupación. Navega a `/buscar` con los criterios en la URL (enlazable y compartible). */
@Component({
  selector: 'app-search-form',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="search" [class.search--compact]="compact()" (ngSubmit)="submit()" novalidate>
      <div class="field">
        <label for="sf-in">Llegada</label>
        <input id="sf-in" type="date" name="checkIn" [min]="today" [ngModel]="checkIn()" (ngModelChange)="setCheckIn($event)" required>
      </div>
      <div class="field">
        <label for="sf-out">Salida</label>
        <input id="sf-out" type="date" name="checkOut" [min]="minCheckOut()" [ngModel]="checkOut()" (ngModelChange)="checkOut.set($event)" required>
      </div>
      <div class="field">
        <label for="sf-ad">Adultos</label>
        <select id="sf-ad" name="adults" [ngModel]="adults()" (ngModelChange)="adults.set(+$event)">
          @for (n of adultOptions; track n) { <option [ngValue]="n">{{ n }}</option> }
        </select>
      </div>
      <div class="field">
        <label for="sf-ch">Niños</label>
        <select id="sf-ch" name="children" [ngModel]="children()" (ngModelChange)="children.set(+$event)">
          @for (n of childOptions; track n) { <option [ngValue]="n">{{ n }}</option> }
        </select>
      </div>
      <button type="submit" class="btn btn--lg search__submit">Ver disponibilidad</button>
      @if (error()) {
        <p class="field__error search__error" role="alert">{{ error() }}</p>
      }
    </form>
  `,
  styles: `
    .search { display: grid; gap: 12px; grid-template-columns: 1.2fr 1.2fr 0.8fr 0.8fr auto; align-items: end;
      background: var(--c-surface); padding: 16px; border-radius: var(--radius); box-shadow: var(--shadow); }
    .search__error { grid-column: 1 / -1; margin: 0; }
    @media (max-width: 860px) { .search { grid-template-columns: 1fr 1fr; } .search__submit { grid-column: 1 / -1; } }
  `,
})
export class SearchFormComponent {
  private readonly router = inject(Router);

  readonly initialCheckIn = input<IsoDate | null>(null);
  readonly initialCheckOut = input<IsoDate | null>(null);
  readonly initialAdults = input<number | null>(null);
  readonly initialChildren = input<number | null>(null);
  readonly compact = input(false);

  protected readonly today = todayInProperty();
  protected readonly checkIn = signal<IsoDate>(addDays(this.today, 7));
  protected readonly checkOut = signal<IsoDate>(addDays(this.today, 9));
  protected readonly adults = signal(2);
  protected readonly children = signal(0);
  protected readonly error = signal<string | null>(null);
  protected readonly minCheckOut = computed(() => (isIsoDate(this.checkIn()) ? addDays(this.checkIn(), 1) : this.today));
  protected readonly adultOptions = Array.from({ length: 8 }, (_, i) => i + 1);
  protected readonly childOptions = Array.from({ length: 7 }, (_, i) => i);

  constructor() {
    effect(() => {
      const ci = this.initialCheckIn();
      const co = this.initialCheckOut();
      if (ci && isIsoDate(ci)) this.checkIn.set(ci);
      if (co && isIsoDate(co)) this.checkOut.set(co);
      const a = this.initialAdults();
      const c = this.initialChildren();
      if (a) this.adults.set(a);
      if (c !== null) this.children.set(c);
    });
  }

  protected setCheckIn(value: IsoDate): void {
    this.checkIn.set(value);
    if (isIsoDate(value) && (!isIsoDate(this.checkOut()) || this.checkOut() <= value)) {
      this.checkOut.set(addDays(value, 2));
    }
  }

  protected submit(): void {
    const message = validateStay(this.checkIn(), this.checkOut(), this.today);
    this.error.set(message);
    if (message) return;
    void this.router.navigate(['/buscar'], {
      queryParams: { checkIn: this.checkIn(), checkOut: this.checkOut(), adults: this.adults(), children: this.children() },
    });
  }
}

/** Validación de fechas en el cliente (el backend vuelve a validarlas). */
export function validateStay(checkIn: string, checkOut: string, today: IsoDate): string | null {
  if (!isIsoDate(checkIn) || !isIsoDate(checkOut)) return 'Indique las fechas de llegada y salida.';
  if (checkIn < today) return 'La fecha de llegada no puede ser anterior a hoy.';
  if (checkOut <= checkIn) return 'La salida debe ser posterior a la llegada.';
  if (nightsBetween(checkIn, checkOut) > MAX_NIGHTS) return `La estancia máxima es de ${MAX_NIGHTS} noches.`;
  return null;
}
