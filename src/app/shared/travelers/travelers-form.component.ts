import { apiResource } from '../ui/api-resource';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormArray, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { BackofficeApiService } from '../../core/api/backoffice-api.service';
import { DocumentType, TravelerData, TravelerIssue, Uuid } from '../../core/api/models';
import { GuestApiService } from '../../core/api/guest-api.service';
import { problemMessage } from '../../core/api/problem';
import { todayInProperty } from '../../core/util/dates';
import { countries } from '../countries';
import { DOCUMENT_TYPE, RELATIONSHIP } from '../labels';

type TravelerForm = FormGroup<{
  [K in keyof TravelerData]: import('@angular/forms').FormControl<string>;
}>;

const FIELDS: (keyof TravelerData)[] = [
  'firstName', 'lastName1', 'lastName2', 'sex', 'birthDate', 'nationality', 'documentType', 'documentNumber',
  'documentSupportNumber', 'documentIssueDate', 'email', 'phone', 'phoneLandline', 'addressLine', 'addressComplement',
  'postalCode', 'city', 'municipalityCode', 'province', 'countryCode', 'relationship',
];

/**
 * Registro de viajeros (RD 933/2021). El backend valida con las reglas de SES.HOSPEDAJES y devuelve las
 * incidencias por viajero y campo, que se muestran junto a cada control.
 */
@Component({
  selector: 'app-travelers-form',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data.isLoading() && !data.data()) {
      <div class="loading"><span class="spinner"></span></div>
    } @else if (data.error()) {
      <div class="alert alert--danger">{{ loadError() }}</div>
    } @else if (data.data(); as d) {
      <form class="stack" [formGroup]="form" (ngSubmit)="save()" novalidate>
        @if (d.complete) {
          <div class="alert alert--success">Registro completo.@if (!reservationId()) { Gracias: ya puede hacer el check-in el día de llegada. }</div>
        } @else {
          <div class="alert alert--info">
            Registre a los {{ d.requiredTravelers }} viajeros de la reserva. Es obligatorio por ley (Real Decreto 933/2021) y los
            datos se comunican al Ministerio del Interior. Los menores de 14 años no necesitan documento, pero sí el parentesco
            con el adulto responsable.
          </div>
        }
        <div formArrayName="travelers" class="stack">
          @for (group of travelers.controls; track $index; let i = $index) {
            <fieldset class="card stack" [formGroupName]="i">
              <legend>Viajero {{ i + 1 }} @if (i === 0) { <span class="muted small">(titular)</span> }</legend>
              <div class="grid-3">
                <div class="field"><label [for]="id(i, 'fn')">Nombre *</label>
                  <input [id]="id(i, 'fn')" formControlName="firstName" maxlength="100">
                  @if (issue(i, 'firstName')) { <span class="field__error">{{ issue(i, 'firstName') }}</span> }</div>
                <div class="field"><label [for]="id(i, 'l1')">Primer apellido *</label>
                  <input [id]="id(i, 'l1')" formControlName="lastName1" maxlength="100">
                  @if (issue(i, 'lastName1')) { <span class="field__error">{{ issue(i, 'lastName1') }}</span> }</div>
                <div class="field"><label [for]="id(i, 'l2')">Segundo apellido</label>
                  <input [id]="id(i, 'l2')" formControlName="lastName2" maxlength="100">
                  @if (issue(i, 'lastName2')) { <span class="field__error">{{ issue(i, 'lastName2') }}</span> }</div>
                <div class="field"><label [for]="id(i, 'sx')">Sexo *</label>
                  <select [id]="id(i, 'sx')" formControlName="sex">
                    <option value="">—</option><option value="M">Mujer</option><option value="H">Hombre</option><option value="O">Otro</option>
                  </select>
                  @if (issue(i, 'sex')) { <span class="field__error">{{ issue(i, 'sex') }}</span> }</div>
                <div class="field"><label [for]="id(i, 'bd')">Fecha de nacimiento *</label>
                  <input [id]="id(i, 'bd')" type="date" formControlName="birthDate" [max]="today">
                  @if (issue(i, 'birthDate')) { <span class="field__error">{{ issue(i, 'birthDate') }}</span> }</div>
                <div class="field"><label [for]="id(i, 'na')">Nacionalidad *</label>
                  <select [id]="id(i, 'na')" formControlName="nationality">
                    <option value="">—</option>
                    @for (c of countryList; track c.iso3) { <option [value]="c.iso3">{{ c.name }}</option> }
                  </select>
                  @if (issue(i, 'nationality')) { <span class="field__error">{{ issue(i, 'nationality') }}</span> }</div>
                <div class="field"><label [for]="id(i, 'dt')">Documento</label>
                  <select [id]="id(i, 'dt')" formControlName="documentType">
                    <option value="">Sin documento (menor de 14)</option>
                    @for (t of documentTypes; track t) { <option [value]="t">{{ documentLabel[t] }}</option> }
                  </select>
                  @if (issue(i, 'documentType')) { <span class="field__error">{{ issue(i, 'documentType') }}</span> }</div>
                <div class="field"><label [for]="id(i, 'dn')">Número de documento</label>
                  <input [id]="id(i, 'dn')" formControlName="documentNumber" maxlength="30" autocapitalize="characters">
                  @if (issue(i, 'documentNumber')) { <span class="field__error">{{ issue(i, 'documentNumber') }}</span> }</div>
                @if (needsSupportNumber(i)) {
                  <div class="field"><label [for]="id(i, 'ds')">Número de soporte *</label>
                    <input [id]="id(i, 'ds')" formControlName="documentSupportNumber" maxlength="30" autocapitalize="characters">
                    <span class="field__hint">Código de 9 caracteres del DNI/NIE (p. ej. BAA000589).</span>
                    @if (issue(i, 'documentSupportNumber')) { <span class="field__error">{{ issue(i, 'documentSupportNumber') }}</span> }</div>
                }
                <div class="field"><label [for]="id(i, 'di')">Fecha de expedición</label>
                  <input [id]="id(i, 'di')" type="date" formControlName="documentIssueDate" [max]="today">
                  @if (issue(i, 'documentIssueDate')) { <span class="field__error">{{ issue(i, 'documentIssueDate') }}</span> }</div>
                @if (i > 0) {
                  <div class="field"><label [for]="id(i, 'rl')">Parentesco (menores)</label>
                    <select [id]="id(i, 'rl')" formControlName="relationship">
                      <option value="">—</option>
                      @for (r of relationships; track r.code) { <option [value]="r.code">{{ r.label }}</option> }
                    </select>
                    @if (issue(i, 'relationship')) { <span class="field__error">{{ issue(i, 'relationship') }}</span> }</div>
                }
              </div>
              <div class="grid-3">
                <div class="field"><label [for]="id(i, 'em')">Email</label>
                  <input [id]="id(i, 'em')" type="email" formControlName="email" maxlength="254">
                  @if (issue(i, 'email')) { <span class="field__error">{{ issue(i, 'email') }}</span> }</div>
                <div class="field"><label [for]="id(i, 'ph')">Teléfono móvil</label>
                  <input [id]="id(i, 'ph')" type="tel" formControlName="phone" maxlength="30">
                  @if (issue(i, 'phone')) { <span class="field__error">{{ issue(i, 'phone') }}</span> }</div>
                <div class="field"><label [for]="id(i, 'pl')">Teléfono fijo</label>
                  <input [id]="id(i, 'pl')" type="tel" formControlName="phoneLandline" maxlength="30"></div>
              </div>
              <div class="grid-3">
                <div class="field"><label [for]="id(i, 'co')">País de residencia *</label>
                  <select [id]="id(i, 'co')" formControlName="countryCode">
                    <option value="">—</option>
                    @for (c of countryList; track c.iso3) { <option [value]="c.iso3">{{ c.name }}</option> }
                  </select>
                  @if (issue(i, 'countryCode')) { <span class="field__error">{{ issue(i, 'countryCode') }}</span> }</div>
                <div class="field"><label [for]="id(i, 'ad')">Dirección *</label>
                  <input [id]="id(i, 'ad')" formControlName="addressLine" maxlength="250">
                  @if (issue(i, 'addressLine')) { <span class="field__error">{{ issue(i, 'addressLine') }}</span> }</div>
                <div class="field"><label [for]="id(i, 'ac')">Piso, puerta…</label>
                  <input [id]="id(i, 'ac')" formControlName="addressComplement" maxlength="250"></div>
                <div class="field"><label [for]="id(i, 'pc')">Código postal *</label>
                  <input [id]="id(i, 'pc')" formControlName="postalCode" maxlength="20">
                  @if (issue(i, 'postalCode')) { <span class="field__error">{{ issue(i, 'postalCode') }}</span> }</div>
                @if (residesInSpain(i)) {
                  <div class="field"><label [for]="id(i, 'mu')">Código de municipio (INE) *</label>
                    <input [id]="id(i, 'mu')" formControlName="municipalityCode" maxlength="5" inputmode="numeric" placeholder="14002">
                    <span class="field__hint">5 cifras. Puede consultarlo en ine.es.</span>
                    @if (issue(i, 'municipalityCode')) { <span class="field__error">{{ issue(i, 'municipalityCode') }}</span> }</div>
                } @else {
                  <div class="field"><label [for]="id(i, 'ci')">Localidad *</label>
                    <input [id]="id(i, 'ci')" formControlName="city" maxlength="100">
                    @if (issue(i, 'city')) { <span class="field__error">{{ issue(i, 'city') }}</span> }</div>
                }
                <div class="field"><label [for]="id(i, 'pr')">Provincia / región</label>
                  <input [id]="id(i, 'pr')" formControlName="province" maxlength="100"></div>
              </div>
              @for (general of generalIssues(i); track $index) { <p class="field__error">{{ general }}</p> }
            </fieldset>
          }
        </div>
        @if (error()) { <div class="alert alert--danger" role="alert">{{ error() }}</div> }
        @if (savedMessage()) { <div class="alert alert--success" role="status">{{ savedMessage() }}</div> }
        <div class="row">
          @if (travelers.length < d.requiredTravelers + 4) {
            <button type="button" class="btn btn--secondary" (click)="addTraveler()">Añadir viajero</button>
          }
          @if (travelers.length > d.requiredTravelers) {
            <button type="button" class="btn btn--ghost" (click)="removeLast()">Quitar el último</button>
          }
          <span class="grow"></span>
          <button type="submit" class="btn btn--lg" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> } Guardar registro
          </button>
        </div>
      </form>
    }
  `,
})
export class TravelersFormComponent {
  private readonly guestApi = inject(GuestApiService);
  private readonly backofficeApi = inject(BackofficeApiService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Sin reserva: portal del huésped (JWT de huésped). Con reserva: recepción. */
  readonly reservationId = input<Uuid | null>(null);
  readonly saved = output<void>();

  protected readonly today = todayInProperty();
  protected readonly countryList = countries();
  protected readonly documentTypes: DocumentType[] = ['NIF', 'NIE', 'PAS', 'OTRO'];
  protected readonly documentLabel = DOCUMENT_TYPE;
  protected readonly relationships = RELATIONSHIP;

  protected readonly data = apiResource({
    params: () => ({ reservationId: this.reservationId() }),
    stream: ({ params }) =>
      params.reservationId ? this.backofficeApi.travelers(params.reservationId) : this.guestApi.travelers(),
  });
  protected readonly loadError = computed(() => problemMessage(this.data.error()));
  protected readonly issues = signal<TravelerIssue[]>([]);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly savedMessage = signal<string | null>(null);

  protected readonly travelers = this.fb.array<TravelerForm>([]);
  protected readonly form = this.fb.group({ travelers: this.travelers as FormArray<TravelerForm> });

  constructor() {
    effect(() => {
      const d = this.data.data();
      if (!d) return;
      this.travelers.clear();
      const count = Math.max(d.requiredTravelers, d.travelers.length, 1);
      for (let i = 0; i < count; i++) {
        this.travelers.push(this.group(d.travelers[i]));
      }
      this.issues.set(d.issues);
    });
  }

  protected id(index: number, field: string): string {
    return `tv-${index}-${field}`;
  }

  protected issue(index: number, field: keyof TravelerData): string | null {
    return this.issues().find((x) => x.index === index && x.field === field)?.message ?? null;
  }

  protected generalIssues(index: number): string[] {
    return this.issues().filter((x) => x.index === index && !FIELDS.includes(x.field as keyof TravelerData)).map((x) => x.message);
  }

  protected residesInSpain(index: number): boolean {
    return this.travelers.at(index).controls.countryCode.value === 'ESP';
  }

  protected needsSupportNumber(index: number): boolean {
    const type = this.travelers.at(index).controls.documentType.value;
    return type === 'NIF' || type === 'NIE';
  }

  protected addTraveler(): void {
    this.travelers.push(this.group(undefined));
  }

  protected removeLast(): void {
    this.travelers.removeAt(this.travelers.length - 1);
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    this.savedMessage.set(null);
    try {
      const payload = this.travelers.controls.map((g) => this.toData(g));
      const id = this.reservationId();
      const response = await firstValueFrom(
        id ? this.backofficeApi.saveTravelers(id, payload) : this.guestApi.saveTravelers(payload),
      );
      this.data.set(response);
      if (response.complete) {
        this.savedMessage.set('Registro guardado y completo.');
        this.saved.emit();
      } else {
        this.error.set('Datos guardados, pero faltan o hay datos incorrectos. Revise los campos marcados.');
      }
    } catch (e) {
      this.error.set(problemMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  private group(t: TravelerData | undefined): TravelerForm {
    const controls = {} as Record<keyof TravelerData, import('@angular/forms').FormControl<string>>;
    for (const field of FIELDS) {
      controls[field] = this.fb.control(t?.[field] ?? (field === 'countryCode' || field === 'nationality' ? 'ESP' : ''));
    }
    controls.firstName.addValidators([Validators.required]);
    controls.lastName1.addValidators([Validators.required]);
    return this.fb.group(controls) as TravelerForm;
  }

  private toData(g: TravelerForm): TravelerData {
    const v = g.getRawValue();
    const out = {} as Record<keyof TravelerData, string | null>;
    for (const field of FIELDS) {
      const value = v[field].trim();
      out[field] = value === '' ? null : field === 'documentNumber' || field === 'documentSupportNumber' ? value.toUpperCase() : value;
    }
    if (out.countryCode !== 'ESP') {
      out.municipalityCode = null;
    }
    if (out.documentType !== 'NIF' && out.documentType !== 'NIE') {
      out.documentSupportNumber = null;
    }
    return out as unknown as TravelerData;
  }
}
