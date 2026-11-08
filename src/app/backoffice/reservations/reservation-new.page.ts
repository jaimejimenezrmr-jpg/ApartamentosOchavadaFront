import { apiResource } from '../../shared/ui/api-resource';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { AdminApiService } from '../../core/api/admin-api.service';
import { BackofficeApiService } from '../../core/api/backoffice-api.service';
import { GuestSummary, ManualReservationRequest, PaymentMode, ReservationChannel } from '../../core/api/models';
import { fieldErrors, toProblem } from '../../core/api/problem';
import { StaffSessionService } from '../../core/auth/staff-session.service';
import { addDays, todayInProperty } from '../../core/util/dates';
import { countries } from '../../shared/countries';
import { CHANNEL, MANUAL_CHANNELS, PAYMENT_MODE } from '../../shared/labels';
import { useAction } from '../../shared/ui/action';

/** Alta manual (teléfono, mostrador u OTA sin channel manager). */
@Component({
  selector: 'app-reservation-new-page',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Nueva reserva</h1>
    <form class="stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <section class="card stack">
        <h3>Estancia</h3>
        <div class="grid-3">
          <div class="field"><label for="nr-type">Tipología *</label>
            <select id="nr-type" formControlName="roomTypeId" (change)="onTypeChange()">
              <option value="">—</option>
              @for (t of roomTypes(); track t.id) { <option [value]="t.id">{{ t.name }}</option> }
            </select>
            @if (err('roomTypeId')) { <span class="field__error">{{ err('roomTypeId') }}</span> }</div>
          <div class="field"><label for="nr-plan">Tarifa</label>
            <select id="nr-plan" formControlName="ratePlanId">
              <option value="">Sin tarifa (precio pactado)</option>
              @for (p of plans.data() ?? []; track p.id) { <option [value]="p.id">{{ p.name }}{{ p.defaultPlan ? ' (por defecto)' : '' }}</option> }
            </select></div>
          <div class="field"><label for="nr-room">Unidad</label>
            <select id="nr-room" formControlName="roomId">
              <option value="">Asignar automáticamente</option>
              @for (r of rooms.data() ?? []; track r.id) { <option [value]="r.id" [disabled]="r.status !== 'ACTIVE'">{{ r.number }}</option> }
            </select></div>
          <div class="field"><label for="nr-in">Llegada *</label><input id="nr-in" type="date" formControlName="checkIn" [min]="today">
            @if (err('checkIn')) { <span class="field__error">{{ err('checkIn') }}</span> }</div>
          <div class="field"><label for="nr-out">Salida *</label><input id="nr-out" type="date" formControlName="checkOut">
            @if (err('checkOut')) { <span class="field__error">{{ err('checkOut') }}</span> }</div>
          <div class="field"><label for="nr-eta">Hora de llegada</label><input id="nr-eta" type="time" formControlName="expectedArrivalTime"></div>
          <div class="field"><label for="nr-ad">Adultos *</label><input id="nr-ad" type="number" min="1" max="20" formControlName="adults"></div>
          <div class="field"><label for="nr-ch">Niños</label><input id="nr-ch" type="number" min="0" max="20" formControlName="children"></div>
        </div>
      </section>

      <section class="card stack">
        <h3>Canal y pago</h3>
        <div class="grid-3">
          <div class="field"><label for="nr-chn">Canal *</label>
            <select id="nr-chn" formControlName="channel">
              @for (c of channels; track c) { <option [value]="c">{{ channelLabel[c] }}</option> }
            </select></div>
          <div class="field"><label for="nr-ref">Referencia del canal</label><input id="nr-ref" formControlName="channelReference" maxlength="100"></div>
          <div class="field"><label for="nr-pm">Forma de pago</label>
            <select id="nr-pm" formControlName="paymentMode">
              @for (m of paymentModes; track m) { <option [value]="m">{{ paymentLabel[m] }}</option> }
            </select></div>
          <div class="field"><label for="nr-total">Precio total pactado (€)</label>
            <input id="nr-total" type="number" min="0" step="0.01" formControlName="totalAmountOverride" placeholder="Según tarifa">
            @if (err('totalAmountOverride')) { <span class="field__error">{{ err('totalAmountOverride') }}</span> }</div>
        </div>
        <label class="check"><input type="checkbox" formControlName="overrideRestrictions"> Ignorar restricciones de la tarifa (estancia mínima, cierres…)</label>
        @if (restrictions().length) {
          <div class="alert alert--warning">
            <strong>La tarifa no admite esta estancia:</strong>
            <ul>@for (r of restrictions(); track r) { <li>{{ r }}</li> }</ul>
            Puede forzarla marcando «Ignorar restricciones».
          </div>
        }
      </section>

      <section class="card stack">
        <div class="card__title"><h3>Titular</h3>
          <div class="row">
            <input type="search" placeholder="Buscar huésped existente…" #guestQuery (keyup.enter)="$event.preventDefault(); searchGuest(guestQuery.value)">
            <button type="button" class="btn btn--secondary btn--sm" (click)="searchGuest(guestQuery.value)">Buscar</button>
          </div>
        </div>
        @if (guestMatches().length) {
          <ul class="matches">
            @for (g of guestMatches(); track g.id) {
              <li><button type="button" class="btn btn--ghost btn--sm" (click)="pickGuest(g)">{{ g.fullName }} · {{ g.email ?? g.phone ?? '' }}</button></li>
            }
          </ul>
        }
        @if (existingGuest(); as g) {
          <div class="alert alert--info row row--between">
            <span>Huésped existente: <strong>{{ g.fullName }}</strong> {{ g.email ?? '' }}</span>
            <button type="button" class="btn btn--secondary btn--sm" (click)="existingGuest.set(null)">Usar otro</button>
          </div>
        } @else {
          <div class="grid-3" formGroupName="guest">
            <div class="field"><label for="nr-fn">Nombre *</label><input id="nr-fn" formControlName="firstName" maxlength="100">
              @if (err('guest.firstName')) { <span class="field__error">{{ err('guest.firstName') }}</span> }</div>
            <div class="field"><label for="nr-l1">Primer apellido *</label><input id="nr-l1" formControlName="lastName1" maxlength="100">
              @if (err('guest.lastName1')) { <span class="field__error">{{ err('guest.lastName1') }}</span> }</div>
            <div class="field"><label for="nr-l2">Segundo apellido</label><input id="nr-l2" formControlName="lastName2" maxlength="100"></div>
            <div class="field"><label for="nr-em">Email</label><input id="nr-em" type="email" formControlName="email" maxlength="254">
              @if (err('guest.email')) { <span class="field__error">{{ err('guest.email') }}</span> }</div>
            <div class="field"><label for="nr-ph">Teléfono</label><input id="nr-ph" type="tel" formControlName="phone" maxlength="30"></div>
            <div class="field"><label for="nr-co">País</label>
              <select id="nr-co" formControlName="countryCode">
                @for (c of countryList; track c.iso3) { <option [value]="c.iso3">{{ c.name }}</option> }
              </select></div>
          </div>
        }
        <div class="field"><label for="nr-sr">Peticiones del huésped</label><textarea id="nr-sr" formControlName="specialRequests" maxlength="2000"></textarea></div>
        <div class="field"><label for="nr-in2">Notas internas</label><textarea id="nr-in2" formControlName="internalNotes" maxlength="4000"></textarea></div>
        <label class="check"><input type="checkbox" formControlName="sendConfirmation"> Enviar email de confirmación al titular (con el enlace a «Mi estancia»)</label>
      </section>

      @if (generalError()) { <div class="alert alert--danger" role="alert">{{ generalError() }}</div> }
      <div class="row row--end">
        <button type="button" class="btn btn--secondary" (click)="cancel()">Cancelar</button>
        <button type="submit" class="btn btn--lg" [disabled]="action.busy()">Crear reserva</button>
      </div>
    </form>
  `,
  styles: `
    .matches { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }
    .alert ul { margin: 6px 0; }
  `,
})
export class ReservationNewPage {
  private readonly api = inject(BackofficeApiService);
  private readonly admin = inject(AdminApiService);
  private readonly session = inject(StaffSessionService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly action = useAction();

  protected readonly today = todayInProperty();
  protected readonly countryList = countries();
  protected readonly channels: ReservationChannel[] = MANUAL_CHANNELS;
  protected readonly channelLabel = CHANNEL;
  protected readonly paymentModes: PaymentMode[] = ['AT_PROPERTY', 'OTA_COLLECT'];
  protected readonly paymentLabel = PAYMENT_MODE;

  protected readonly form = this.fb.group({
    roomTypeId: ['', Validators.required],
    ratePlanId: [''],
    roomId: [''],
    checkIn: [addDays(this.today, 1), Validators.required],
    checkOut: [addDays(this.today, 3), Validators.required],
    expectedArrivalTime: [''],
    adults: [2, [Validators.required, Validators.min(1), Validators.max(20)]],
    children: [0, [Validators.min(0), Validators.max(20)]],
    channel: ['PHONE' as ReservationChannel],
    channelReference: [''],
    paymentMode: ['AT_PROPERTY' as PaymentMode],
    totalAmountOverride: [null as number | null],
    overrideRestrictions: [false],
    guest: this.fb.group({
      firstName: [''],
      lastName1: [''],
      lastName2: [''],
      email: ['', Validators.email],
      phone: [''],
      countryCode: ['ESP'],
    }),
    specialRequests: [''],
    internalNotes: [''],
    sendConfirmation: [true],
  });

  /** Las tipologías completas solo las ve ADMIN; recepción las deduce de los planes. */
  private readonly allPlans = apiResource({ stream: () => this.api.ratePlans() });
  private readonly adminTypes = apiResource({
    stream: () => (this.session.hasRole('ADMIN') ? this.admin.roomTypes() : of([])),
  });
  protected readonly roomTypes = computed(() => {
    const admin = this.adminTypes.data() ?? [];
    if (admin.length) return admin.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name }));
    const seen = new Map<string, string>();
    for (const p of this.allPlans.data() ?? []) seen.set(p.roomTypeId, p.roomTypeName);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  });

  private readonly selectedType = toSignal(this.form.controls.roomTypeId.valueChanges, { initialValue: '' });
  protected readonly plans = apiResource({
    params: () => this.selectedType() || undefined,
    stream: ({ params }) => this.api.ratePlans(params),
  });
  protected readonly rooms = apiResource({
    params: () => this.selectedType() || undefined,
    stream: ({ params }) => this.api.rooms(params),
  });

  protected readonly existingGuest = signal<GuestSummary | null>(null);
  protected readonly guestMatches = signal<GuestSummary[]>([]);
  protected readonly restrictions = signal<string[]>([]);
  protected readonly generalError = signal<string | null>(null);
  private readonly serverErrors = signal<Record<string, string>>({});

  protected err(path: string): string | null {
    return this.serverErrors()[path] ?? null;
  }

  constructor() {
    // Al cargar los planes de la tipología elegida se preselecciona el plan por defecto.
    effect(() => {
      const plans = this.plans.data();
      if (plans && !this.form.controls.ratePlanId.value) {
        const def = plans.find((p) => p.defaultPlan && p.active);
        if (def) this.form.controls.ratePlanId.setValue(def.id);
      }
    });
  }

  protected onTypeChange(): void {
    this.form.patchValue({ ratePlanId: '', roomId: '' });
  }

  protected async searchGuest(q: string): Promise<void> {
    if (q.trim().length < 2) return;
    const page = await this.action.run(() => this.api.searchGuests(q.trim()));
    this.guestMatches.set(page?.content ?? []);
  }

  protected pickGuest(g: GuestSummary): void {
    this.existingGuest.set(g);
    this.guestMatches.set([]);
  }

  protected async submit(): Promise<void> {
    this.serverErrors.set({});
    this.generalError.set(null);
    this.restrictions.set([]);
    const v = this.form.getRawValue();
    if (!v.roomTypeId) {
      this.serverErrors.set({ roomTypeId: 'Elija la tipología' });
      return;
    }
    const guest = this.existingGuest();
    if (!guest && (!v.guest.firstName.trim() || !v.guest.lastName1.trim())) {
      this.serverErrors.set({ 'guest.firstName': 'Obligatorio', 'guest.lastName1': 'Obligatorio' });
      return;
    }
    const request: ManualReservationRequest = {
      roomTypeId: v.roomTypeId,
      ratePlanId: v.ratePlanId || null,
      roomId: v.roomId || null,
      checkIn: v.checkIn,
      checkOut: v.checkOut,
      adults: Number(v.adults),
      children: Number(v.children) || 0,
      channel: v.channel,
      channelReference: v.channelReference.trim() || null,
      guestId: guest?.id ?? null,
      guest: guest ? null : {
        firstName: v.guest.firstName.trim(),
        lastName1: v.guest.lastName1.trim(),
        lastName2: v.guest.lastName2.trim() || null,
        email: v.guest.email.trim() || null,
        phone: v.guest.phone.trim() || null,
        countryCode: v.guest.countryCode || null,
      },
      totalAmountOverride: v.totalAmountOverride === null || (v.totalAmountOverride as unknown) === '' ? null : Number(v.totalAmountOverride),
      paymentMode: v.paymentMode,
      specialRequests: v.specialRequests.trim() || null,
      internalNotes: v.internalNotes.trim() || null,
      expectedArrivalTime: v.expectedArrivalTime || null,
      locale: null,
      overrideRestrictions: v.overrideRestrictions,
      sendConfirmation: v.sendConfirmation,
    };
    try {
      const created = await firstValueFrom(this.api.createReservation(request));
      await this.router.navigate(['/backoffice/reservas', created.id]);
    } catch (error) {
      const problem = toProblem(error);
      this.serverErrors.set(fieldErrors(error));
      this.restrictions.set(problem.restrictions.map((r) => r.message));
      this.generalError.set(problem.detail);
    }
  }

  protected cancel(): void {
    void this.router.navigate(['/backoffice/reservas']);
  }
}
