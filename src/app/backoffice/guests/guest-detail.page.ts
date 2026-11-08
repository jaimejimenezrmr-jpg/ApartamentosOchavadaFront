import { apiResource } from '../../shared/ui/api-resource';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BackofficeApiService } from '../../core/api/backoffice-api.service';
import { DocumentType, GuestDetail, GuestRequest } from '../../core/api/models';
import { fieldErrors, problemMessage } from '../../core/api/problem';
import { countries } from '../../shared/countries';
import { DOCUMENT_TYPE, RESERVATION_STATUS, reservationTone } from '../../shared/labels';
import { ToastService } from '../../shared/ui/toast.service';

type Editable = Omit<GuestRequest, 'version' | 'marketingConsent'> & { marketingConsent: boolean };

const TEXT_FIELDS = [
  'firstName', 'lastName1', 'lastName2', 'sex', 'birthDate', 'nationality', 'documentType', 'documentNumber',
  'documentSupportNumber', 'documentIssueDate', 'email', 'phone', 'phoneLandline', 'addressLine', 'addressComplement',
  'postalCode', 'city', 'municipalityCode', 'province', 'countryCode', 'preferredLocale', 'notes',
] as const;

@Component({
  selector: 'app-guest-detail-page',
  imports: [FormsModule, RouterLink, CurrencyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (guest.error()) {
      <div class="alert alert--danger">{{ loadError() }}</div>
    } @else if (guest.data(); as g) {
      <h1>{{ g.firstName }} {{ g.lastName1 }} {{ g.lastName2 ?? '' }}</h1>
      <div class="cols">
        <form class="card stack" (ngSubmit)="save(g)">
          <h3>Ficha (RD 933/2021)</h3>
          <div class="grid-3">
            <div class="field"><label for="g-fn">Nombre</label><input id="g-fn" name="fn" [(ngModel)]="f.firstName" required maxlength="100">
              @if (errors()['firstName']) { <span class="field__error">{{ errors()['firstName'] }}</span> }</div>
            <div class="field"><label for="g-l1">Primer apellido</label><input id="g-l1" name="l1" [(ngModel)]="f.lastName1" required maxlength="100">
              @if (errors()['lastName1']) { <span class="field__error">{{ errors()['lastName1'] }}</span> }</div>
            <div class="field"><label for="g-l2">Segundo apellido</label><input id="g-l2" name="l2" [(ngModel)]="f.lastName2" maxlength="100"></div>
            <div class="field"><label for="g-sx">Sexo</label>
              <select id="g-sx" name="sx" [(ngModel)]="f.sex"><option [ngValue]="null">—</option><option value="M">Mujer</option><option value="H">Hombre</option><option value="O">Otro</option></select></div>
            <div class="field"><label for="g-bd">Nacimiento</label><input id="g-bd" type="date" name="bd" [(ngModel)]="f.birthDate"></div>
            <div class="field"><label for="g-na">Nacionalidad</label>
              <select id="g-na" name="na" [(ngModel)]="f.nationality"><option [ngValue]="null">—</option>
                @for (c of countryList; track c.iso3) { <option [value]="c.iso3">{{ c.name }}</option> }</select></div>
            <div class="field"><label for="g-dt">Documento</label>
              <select id="g-dt" name="dt" [(ngModel)]="f.documentType"><option [ngValue]="null">—</option>
                @for (t of documentTypes; track t) { <option [value]="t">{{ documentLabel[t] }}</option> }</select></div>
            <div class="field"><label for="g-dn">Número</label><input id="g-dn" name="dn" [(ngModel)]="f.documentNumber" maxlength="30">
              @if (errors()['documentNumber']) { <span class="field__error">{{ errors()['documentNumber'] }}</span> }</div>
            <div class="field"><label for="g-ds">Nº de soporte</label><input id="g-ds" name="ds" [(ngModel)]="f.documentSupportNumber" maxlength="30"></div>
            <div class="field"><label for="g-di">Expedición</label><input id="g-di" type="date" name="di" [(ngModel)]="f.documentIssueDate"></div>
            <div class="field"><label for="g-em">Email</label><input id="g-em" type="email" name="em" [(ngModel)]="f.email" maxlength="254">
              @if (errors()['email']) { <span class="field__error">{{ errors()['email'] }}</span> }</div>
            <div class="field"><label for="g-ph">Móvil</label><input id="g-ph" name="ph" [(ngModel)]="f.phone" maxlength="30"></div>
            <div class="field"><label for="g-pl">Fijo</label><input id="g-pl" name="pl" [(ngModel)]="f.phoneLandline" maxlength="30"></div>
            <div class="field"><label for="g-co">País de residencia</label>
              <select id="g-co" name="co" [(ngModel)]="f.countryCode"><option [ngValue]="null">—</option>
                @for (c of countryList; track c.iso3) { <option [value]="c.iso3">{{ c.name }}</option> }</select></div>
            <div class="field"><label for="g-ad">Dirección</label><input id="g-ad" name="ad" [(ngModel)]="f.addressLine" maxlength="250"></div>
            <div class="field"><label for="g-ac">Complemento</label><input id="g-ac" name="ac" [(ngModel)]="f.addressComplement" maxlength="250"></div>
            <div class="field"><label for="g-pc">C. postal</label><input id="g-pc" name="pc" [(ngModel)]="f.postalCode" maxlength="20"></div>
            <div class="field"><label for="g-ci">Localidad</label><input id="g-ci" name="ci" [(ngModel)]="f.city" maxlength="100"></div>
            <div class="field"><label for="g-mu">Municipio INE</label><input id="g-mu" name="mu" [(ngModel)]="f.municipalityCode" maxlength="5">
              @if (errors()['municipalityCode']) { <span class="field__error">{{ errors()['municipalityCode'] }}</span> }</div>
            <div class="field"><label for="g-pr">Provincia</label><input id="g-pr" name="pr" [(ngModel)]="f.province" maxlength="100"></div>
            <div class="field"><label for="g-lo">Idioma</label>
              <select id="g-lo" name="lo" [(ngModel)]="f.preferredLocale"><option value="es">Español</option><option value="en">Inglés</option></select></div>
          </div>
          <div class="field"><label for="g-no">Notas internas</label><textarea id="g-no" name="no" [(ngModel)]="f.notes" maxlength="4000"></textarea></div>
          <label class="check"><input type="checkbox" name="mk" [(ngModel)]="f.marketingConsent"> Acepta comunicaciones comerciales</label>
          @if (g.privacyAcceptedAt) { <p class="small muted">Política de privacidad aceptada el {{ g.privacyAcceptedAt | date: 'd MMM y' }}.</p> }
          @if (error()) { <div class="alert alert--danger">{{ error() }}</div> }
          <div class="row row--end"><button type="submit" class="btn" [disabled]="saving()">Guardar</button></div>
        </form>
        <section class="card">
          <h3>Estancias</h3>
          <div class="table-wrap">
            <table class="table">
              <tbody>
                @for (s of g.stays; track s.reservationId) {
                  <tr class="is-link" [routerLink]="['/backoffice/reservas', s.reservationId]">
                    <td><span class="mono">{{ s.code }}</span><br><span class="small muted">{{ s.roomTypeName }}{{ s.holder ? '' : ' · acompañante' }}</span></td>
                    <td class="nowrap">{{ s.checkIn | date: 'd MMM y' }}</td>
                    <td><span class="badge badge--{{ tone(s.status) }}">{{ statusLabel[s.status] }}</span></td>
                    <td class="num">{{ s.totalAmount | currency }}</td>
                  </tr>
                } @empty { <tr><td class="empty">Sin estancias.</td></tr> }
              </tbody>
            </table>
          </div>
        </section>
      </div>
    } @else {
      <div class="loading"><span class="spinner"></span></div>
    }
  `,
  styles: `
    .cols { display: grid; gap: 16px; grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr); align-items: start; }
    .cols .card + .card { margin-top: 0; }
    @media (max-width: 1100px) { .cols { grid-template-columns: 1fr; } }
  `,
})
export class GuestDetailPage {
  private readonly api = inject(BackofficeApiService);
  private readonly toast = inject(ToastService);
  protected readonly countryList = countries();
  protected readonly documentTypes: DocumentType[] = ['NIF', 'NIE', 'PAS', 'OTRO'];
  protected readonly documentLabel = DOCUMENT_TYPE;
  protected readonly statusLabel = RESERVATION_STATUS;
  protected readonly tone = reservationTone;

  readonly id = input.required<string>();
  protected readonly guest = apiResource({ params: () => this.id(), stream: ({ params }) => this.api.guest(params) });
  protected readonly loadError = computed(() => problemMessage(this.guest.error()));
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errors = signal<Record<string, string>>({});
  protected f = {} as Editable;

  constructor() {
    effect(() => {
      const g = this.guest.data();
      if (g) this.f = this.toEditable(g);
    });
  }

  private toEditable(g: GuestDetail): Editable {
    const e = { marketingConsent: g.marketingConsent } as Editable;
    for (const k of TEXT_FIELDS) {
      (e as unknown as Record<string, unknown>)[k] = g[k] ?? null;
    }
    e.preferredLocale = g.preferredLocale;
    return e;
  }

  protected async save(g: GuestDetail): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    this.errors.set({});
    const request = { ...this.f, version: g.version } as GuestRequest;
    for (const k of TEXT_FIELDS) {
      const v = request[k];
      (request as unknown as Record<string, unknown>)[k] = typeof v === 'string' ? v.trim() || null : v;
    }
    try {
      const updated = await firstValueFrom(this.api.updateGuest(g.id, request));
      this.guest.set(updated);
      this.toast.success('Ficha guardada');
    } catch (e) {
      this.errors.set(fieldErrors(e));
      this.error.set(problemMessage(e));
    } finally {
      this.saving.set(false);
    }
  }
}
