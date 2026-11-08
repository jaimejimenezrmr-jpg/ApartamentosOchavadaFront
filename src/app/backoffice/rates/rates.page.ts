import { apiResource } from '../../shared/ui/api-resource';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/api/admin-api.service';
import { BackofficeApiService } from '../../core/api/backoffice-api.service';
import { ClearableField, DailyRateBulkRequest, DayOfWeek, IsoDate, RateCalendarDay, RateSeasonResponse } from '../../core/api/models';
import { problemMessage } from '../../core/api/problem';
import { StaffSessionService } from '../../core/auth/staff-session.service';
import { addDays, addMonths, startOfMonth, todayInProperty, weekdayIndex } from '../../core/util/dates';
import { DAY_OF_WEEK, PRICE_SOURCE } from '../../shared/labels';
import { useAction } from '../../shared/ui/action';

type Tri = '' | 'true' | 'false';

@Component({
  selector: 'app-rates-page',
  imports: [CurrencyPipe, DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row row--between head">
      <h1>Tarifas y restricciones</h1>
      <select [ngModel]="planId()" (ngModelChange)="planId.set($event)" aria-label="Plan de tarifa" class="plan-select">
        @for (group of planGroups(); track group.roomType) {
          <optgroup [label]="group.roomType">
            @for (p of group.plans; track p.id) { <option [value]="p.id">{{ p.name }}{{ p.active ? '' : ' (inactivo)' }}</option> }
          </optgroup>
        }
      </select>
    </div>

    @if (!planId()) {
      <p class="empty">No hay planes de tarifa. Créelos en Catálogo.</p>
    } @else {
      <div class="row month-nav">
        <button type="button" class="btn btn--secondary btn--sm" (click)="month.set(addMonths(month(), -1))">‹</button>
        <strong class="month-label">{{ month() | date: 'MMMM y' }}</strong>
        <button type="button" class="btn btn--secondary btn--sm" (click)="month.set(addMonths(month(), 1))">›</button>
        <span class="grow"></span>
        @if (isAdmin()) { <span class="small muted">Pulse un día y después otro para seleccionar un rango.</span> }
      </div>

      @if (calendar.error()) {
        <div class="alert alert--danger">{{ calendarError() }}</div>
      } @else {
        <div class="cal" [class.is-loading]="calendar.isLoading()">
          @for (d of weekdayHeaders; track d) { <div class="cal__head">{{ d }}</div> }
          @for (blank of leadingBlanks(); track $index) { <div></div> }
          @for (day of calendar.data()?.days ?? []; track day.date) {
            <button type="button" class="cal__day" [class.is-selected]="inSelection(day.date)" [class.is-past]="day.date < today"
                    [class.is-closed]="day.stopSell || day.availableUnits === 0" (click)="pick(day.date)"
                    [title]="tooltip(day)">
              <span class="cal__n">{{ day.date | date: 'd' }}</span>
              <strong>{{ day.price | currency: calendar.data()!.currency: 'symbol': '1.0-0' }}</strong>
              <span class="cal__meta">
                @if (day.minStay > 1) { <span>{{ day.minStay }}n</span> }
                @if (day.closedToArrival) { <span title="Cerrado a llegadas">CTA</span> }
                @if (day.closedToDeparture) { <span title="Cerrado a salidas">CTD</span> }
                @if (day.stopSell) { <span class="stop">STOP</span> }
              </span>
              <span class="cal__avail" [class.zero]="day.availableUnits === 0">{{ day.availableUnits }} libres</span>
              @if (day.priceSource !== 'BASE') { <span class="cal__src" [class]="'src-' + day.priceSource"></span> }
            </button>
          }
        </div>
        <p class="legend small muted">
          <span class="src-SEASON dot"></span> Temporada · <span class="src-DAILY_OVERRIDE dot"></span> Ajuste diario · sin marca = precio base del plan
        </p>
      }

      @if (isAdmin()) {
        <form class="card stack" (ngSubmit)="applyBulk()">
          <h3>Cambiar precio y restricciones</h3>
          <div class="grid-3">
            <div class="field"><label for="bk-from">Primera noche</label><input id="bk-from" type="date" name="from" [(ngModel)]="bulk.firstNight" required></div>
            <div class="field"><label for="bk-to">Última noche</label><input id="bk-to" type="date" name="to" [(ngModel)]="bulk.lastNight" required></div>
            <div class="field"><span class="label">Solo estos días</span>
              <div class="row dows">
                @for (d of daysOfWeek; track d.value) {
                  <label class="check"><input type="checkbox" [checked]="bulk.days.includes(d.value)" (change)="toggleDay(d.value)">{{ d.short }}</label>
                }
              </div></div>
            <div class="field"><label for="bk-price">Precio por noche (€)</label><input id="bk-price" type="number" min="0" step="0.01" name="price" [(ngModel)]="bulk.price" placeholder="Sin cambios"></div>
            <div class="field"><label for="bk-min">Estancia mínima</label><input id="bk-min" type="number" min="1" max="365" name="min" [(ngModel)]="bulk.minStay" placeholder="Sin cambios"></div>
            <div class="field"><label for="bk-max">Estancia máxima</label><input id="bk-max" type="number" min="1" max="365" name="max" [(ngModel)]="bulk.maxStay" placeholder="Sin cambios"></div>
            <div class="field"><label for="bk-cta">Cerrado a llegadas</label>
              <select id="bk-cta" name="cta" [(ngModel)]="bulk.cta"><option value="">Sin cambios</option><option value="true">Sí</option><option value="false">No</option></select></div>
            <div class="field"><label for="bk-ctd">Cerrado a salidas</label>
              <select id="bk-ctd" name="ctd" [(ngModel)]="bulk.ctd"><option value="">Sin cambios</option><option value="true">Sí</option><option value="false">No</option></select></div>
            <div class="field"><label for="bk-stop">Stop-sell</label>
              <select id="bk-stop" name="stop" [(ngModel)]="bulk.stop"><option value="">Sin cambios</option><option value="true">Cerrar venta</option><option value="false">Abrir venta</option></select></div>
          </div>
          <div class="row">
            <span class="small muted">Volver al valor de temporada/plan:</span>
            <label class="check"><input type="checkbox" name="cp" [(ngModel)]="bulk.clearPrice"> precio</label>
            <label class="check"><input type="checkbox" name="cmin" [(ngModel)]="bulk.clearMin"> mínima</label>
            <label class="check"><input type="checkbox" name="cmax" [(ngModel)]="bulk.clearMax"> máxima</label>
          </div>
          <div class="row row--end"><button type="submit" class="btn" [disabled]="action.busy() || !bulk.firstNight || !bulk.lastNight">Aplicar</button></div>
        </form>
      }

      <section class="card">
        <div class="card__title"><h3>Temporadas</h3></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Nombre</th><th>Noches</th><th class="num">Precio</th><th class="num">Fin de semana</th><th>Mín.</th><th>Máx.</th><th></th></tr></thead>
            <tbody>
              @for (s of seasons.data() ?? []; track s.id) {
                <tr>
                  <td>{{ s.name }}</td>
                  <td class="nowrap">{{ s.firstNight | date: 'd MMM y' }} → {{ s.lastNight | date: 'd MMM y' }}</td>
                  <td class="num">{{ s.nightlyPrice | currency }}</td>
                  <td class="num">{{ s.weekendPrice !== null ? (s.weekendPrice | currency) : '—' }}</td>
                  <td>{{ s.minStay ?? '—' }}</td><td>{{ s.maxStay ?? '—' }}</td>
                  <td class="right">
                    @if (isAdmin()) {
                      <button type="button" class="btn btn--ghost btn--sm" (click)="editSeason(s)">Editar</button>
                      <button type="button" class="btn btn--ghost btn--sm" (click)="deleteSeason(s)">Borrar</button>
                    }
                  </td>
                </tr>
              } @empty { <tr><td colspan="7" class="empty">Sin temporadas: se aplica el precio base del plan.</td></tr> }
            </tbody>
          </table>
        </div>
        @if (isAdmin()) {
          <form class="stack season-form" (ngSubmit)="saveSeason()">
            <h4>{{ season.id ? 'Editar temporada' : 'Nueva temporada' }}</h4>
            <div class="grid-3">
              <div class="field"><label for="ss-n">Nombre</label><input id="ss-n" name="n" [(ngModel)]="season.name" maxlength="100" required></div>
              <div class="field"><label for="ss-f">Primera noche</label><input id="ss-f" type="date" name="f" [(ngModel)]="season.firstNight" required></div>
              <div class="field"><label for="ss-l">Última noche</label><input id="ss-l" type="date" name="l" [(ngModel)]="season.lastNight" required></div>
              <div class="field"><label for="ss-p">Precio (€)</label><input id="ss-p" type="number" min="0" step="0.01" name="p" [(ngModel)]="season.nightlyPrice" required></div>
              <div class="field"><label for="ss-w">Fin de semana (€)</label><input id="ss-w" type="number" min="0" step="0.01" name="w" [(ngModel)]="season.weekendPrice"></div>
              <div class="field"><label for="ss-mi">Estancia mín.</label><input id="ss-mi" type="number" min="1" name="mi" [(ngModel)]="season.minStay"></div>
              <div class="field"><label for="ss-ma">Estancia máx.</label><input id="ss-ma" type="number" min="1" name="ma" [(ngModel)]="season.maxStay"></div>
            </div>
            <div class="row row--end">
              @if (season.id) { <button type="button" class="btn btn--secondary btn--sm" (click)="resetSeason()">Descartar</button> }
              <button type="submit" class="btn btn--sm" [disabled]="action.busy()">{{ season.id ? 'Guardar' : 'Crear temporada' }}</button>
            </div>
          </form>
        }
      </section>
    }
  `,
  styles: `
    .head { margin-bottom: 12px; }
    .head h1 { margin: 0; }
    .plan-select { width: auto; min-width: 260px; }
    .month-nav { margin-bottom: 10px; }
    .month-label { text-transform: capitalize; min-width: 140px; text-align: center; }
    .cal { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
    .cal.is-loading { opacity: 0.6; }
    .cal__head { text-align: center; font-size: 0.76rem; color: var(--c-text-muted); font-weight: 600; padding: 4px 0; }
    .cal__day { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 1px; min-height: 86px; padding: 6px 8px;
      border: 1px solid var(--c-border); border-radius: var(--radius-sm); background: var(--c-surface); font: inherit; text-align: left; cursor: pointer; }
    .cal__day.is-selected { border-color: var(--c-brand); background: var(--c-brand-soft); }
    .cal__day.is-past { opacity: 0.55; }
    .cal__day.is-closed { background: repeating-linear-gradient(135deg, #fff, #fff 8px, #fbeceb 8px, #fbeceb 16px); }
    .cal__n { font-size: 0.75rem; color: var(--c-text-muted); }
    .cal__meta { display: flex; gap: 4px; font-size: 0.68rem; font-weight: 600; color: var(--c-warning); }
    .cal__meta .stop { color: var(--c-danger); }
    .cal__avail { margin-top: auto; font-size: 0.72rem; color: var(--c-text-muted); }
    .cal__avail.zero { color: var(--c-danger); font-weight: 600; }
    .cal__src, .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .cal__src { position: absolute; top: 8px; right: 8px; }
    .src-SEASON, .src-SEASON_WEEKEND { background: var(--c-info); }
    .src-DAILY_OVERRIDE { background: var(--c-accent); }
    .legend { margin: 8px 0 16px; display: flex; gap: 6px; align-items: center; }
    .dows { gap: 6px; }
    .season-form { margin-top: 16px; border-top: 1px solid var(--c-border); padding-top: 12px; }
  `,
})
export class RatesPage {
  private readonly api = inject(BackofficeApiService);
  private readonly admin = inject(AdminApiService);
  private readonly session = inject(StaffSessionService);
  protected readonly action = useAction();
  protected readonly addMonths = addMonths;
  protected readonly daysOfWeek = DAY_OF_WEEK;
  protected readonly weekdayHeaders = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  protected readonly today = todayInProperty();

  protected readonly plans = apiResource({ stream: () => this.api.ratePlans() });
  protected readonly planGroups = computed(() => {
    const groups = new Map<string, NonNullable<ReturnType<typeof this.plans.value>>>();
    for (const p of this.plans.data() ?? []) groups.set(p.roomTypeName, [...(groups.get(p.roomTypeName) ?? []), p]);
    return [...groups.entries()].map(([roomType, plans]) => ({ roomType, plans }));
  });
  protected readonly planId = signal<string>('');
  protected readonly month = signal<IsoDate>(startOfMonth(this.today));
  protected readonly calendar = apiResource({
    params: () => (this.planId() ? { id: this.planId(), from: this.month(), to: addDays(addMonths(this.month(), 1), -1) } : undefined),
    stream: ({ params }) => this.api.rateCalendar(params.id, params.from, params.to),
  });
  protected readonly calendarError = computed(() => problemMessage(this.calendar.error()));
  protected readonly leadingBlanks = computed(() => Array.from({ length: weekdayIndex(this.month()) }));
  protected readonly seasons = apiResource({
    params: () => this.planId() || undefined,
    stream: ({ params }) => this.api.seasons(params),
  });
  protected readonly isAdmin = computed(() => {
    this.session.user();
    return this.session.hasRole('ADMIN');
  });

  private selectionAnchor: IsoDate | null = null;
  protected bulk = this.emptyBulk();
  protected season = this.emptySeason();

  constructor() {
    effect(() => {
      const plans = this.plans.data();
      if (plans?.length && !this.planId()) {
        this.planId.set((plans.find((p) => p.defaultPlan && p.active) ?? plans[0]).id);
      }
    });
    effect(() => {
      this.planId();
      this.resetSeason();
    });
  }

  protected tooltip(day: RateCalendarDay): string {
    return `${day.date} · ${PRICE_SOURCE[day.priceSource]} · mín. ${day.minStay}${day.maxStay ? ` · máx. ${day.maxStay}` : ''}`;
  }

  protected inSelection(date: IsoDate): boolean {
    return !!this.bulk.firstNight && !!this.bulk.lastNight && date >= this.bulk.firstNight && date <= this.bulk.lastNight;
  }

  protected pick(date: IsoDate): void {
    if (!this.isAdmin()) return;
    if (!this.selectionAnchor) {
      this.selectionAnchor = date;
      this.bulk.firstNight = date;
      this.bulk.lastNight = date;
    } else {
      const a = this.selectionAnchor;
      this.bulk.firstNight = a < date ? a : date;
      this.bulk.lastNight = a < date ? date : a;
      this.selectionAnchor = null;
    }
    this.bulk = { ...this.bulk };
  }

  protected toggleDay(day: DayOfWeek): void {
    this.bulk.days = this.bulk.days.includes(day) ? this.bulk.days.filter((d) => d !== day) : [...this.bulk.days, day];
  }

  protected async applyBulk(): Promise<void> {
    const b = this.bulk;
    const clear: ClearableField[] = [];
    if (b.clearPrice) clear.push('PRICE');
    if (b.clearMin) clear.push('MIN_STAY');
    if (b.clearMax) clear.push('MAX_STAY');
    const request: DailyRateBulkRequest = {
      firstNight: b.firstNight,
      lastNight: b.lastNight,
      daysOfWeek: b.days.length ? b.days : null,
      price: num(b.price),
      minStay: num(b.minStay),
      maxStay: num(b.maxStay),
      closedToArrival: tri(b.cta),
      closedToDeparture: tri(b.ctd),
      stopSell: tri(b.stop),
      clear: clear.length ? clear : null,
    };
    const result = await this.action.run(() => this.admin.applyDailyRates(this.planId(), request),
      (r) => `${r.affectedDays} día(s) actualizados`);
    if (result) {
      this.bulk = this.emptyBulk();
      this.calendar.reload();
    }
  }

  protected editSeason(s: RateSeasonResponse): void {
    this.season = { ...s, weekendPrice: s.weekendPrice, minStay: s.minStay, maxStay: s.maxStay };
  }

  protected resetSeason(): void {
    this.season = this.emptySeason();
  }

  protected async saveSeason(): Promise<void> {
    const s = this.season;
    const request = {
      name: s.name.trim(),
      firstNight: s.firstNight,
      lastNight: s.lastNight,
      nightlyPrice: Number(s.nightlyPrice),
      weekendPrice: num(s.weekendPrice),
      minStay: num(s.minStay),
      maxStay: num(s.maxStay),
      version: s.id ? s.version : null,
    };
    const result = await this.action.run(
      () => (s.id ? this.admin.updateSeason(this.planId(), s.id, request) : this.admin.createSeason(this.planId(), request)),
      s.id ? 'Temporada guardada' : 'Temporada creada',
    );
    if (result) {
      this.resetSeason();
      this.seasons.reload();
      this.calendar.reload();
    }
  }

  protected async deleteSeason(s: RateSeasonResponse): Promise<void> {
    if (await this.action.runOk(() => this.admin.deleteSeason(this.planId(), s.id), 'Temporada eliminada')) {
      this.seasons.reload();
      this.calendar.reload();
    }
  }

  private emptyBulk() {
    return {
      firstNight: '' as IsoDate, lastNight: '' as IsoDate, days: [] as DayOfWeek[],
      price: null as number | null, minStay: null as number | null, maxStay: null as number | null,
      cta: '' as Tri, ctd: '' as Tri, stop: '' as Tri, clearPrice: false, clearMin: false, clearMax: false,
    };
  }

  private emptySeason() {
    return {
      id: '' as string, version: 0, name: '', firstNight: '' as IsoDate, lastNight: '' as IsoDate,
      nightlyPrice: null as number | null, weekendPrice: null as number | null, minStay: null as number | null, maxStay: null as number | null,
    };
  }
}

function num(value: unknown): number | null {
  return value === null || value === undefined || value === '' ? null : Number(value);
}

function tri(value: Tri): boolean | null {
  return value === '' ? null : value === 'true';
}
